import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyMigrations, pendingMigrations } from "@/lib/db/migrations";
import { applyPendingMigrations, backupDatabase, restoreDatabase } from "@/lib/services/database-maintenance.mjs";
import { applySchema, migrationIds } from "@/test/schema";

const temporaryDirectories: string[] = [];

function createDirectory() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dhbw-mgmt-maintenance-"));
  temporaryDirectories.push(directory);
  return directory;
}

/** A migrated database that is still open in WAL mode, like the one of the running application. */
function createRunningDatabase(directory: string, email = "admin@dhbw-loerrach.de") {
  const databasePath = path.join(directory, "dhbw-mgmt.sqlite");
  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec("CREATE TABLE _migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
  applySchema(sqlite);
  const record = sqlite.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)");
  for (const migrationId of migrationIds()) record.run(migrationId, new Date().toISOString());
  sqlite.prepare("INSERT INTO user (id, name, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)").run("account-1", email, email, 1, 1);
  return { databasePath, sqlite };
}

/** A versioned migration set whose second step builds on the first, so the order becomes observable. */
function createMigrations(directory: string, steps: Record<string, string>) {
  const migrationsDirectory = path.join(directory, "migrations");
  mkdirSync(migrationsDirectory);
  for (const [id, statements] of Object.entries(steps)) {
    writeFileSync(path.join(migrationsDirectory, `${id}.sql`), statements);
  }
  return migrationsDirectory;
}

/** The database a restore set aside, failing the test when it reports none. */
function openReplacedDatabase(replacedPath: string | null) {
  if (replacedPath === null) throw new Error("Die Wiederherstellung hat keine ersetzte Datenbank gemeldet.");
  return new Database(replacedPath, { readonly: true });
}

afterEach(() => {
  vi.useRealTimers();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("backupDatabase", () => {
  it("snapshots the data a still running database has written to its write-ahead log", async () => {
    const directory = createDirectory();
    const { databasePath } = createRunningDatabase(directory);
    const snapshotPath = path.join(directory, "snapshot.sqlite");

    await backupDatabase({ databasePath, targetPath: snapshotPath });

    const snapshot = new Database(snapshotPath, { readonly: true });
    expect(snapshot.prepare("SELECT email FROM user").pluck().all()).toEqual(["admin@dhbw-loerrach.de"]);
    snapshot.close();
  });

  it("reports which migrations the snapshot belongs to", async () => {
    const directory = createDirectory();
    const { databasePath } = createRunningDatabase(directory);

    const report = await backupDatabase({ databasePath, targetPath: path.join(directory, "snapshot.sqlite") });

    expect(report.migrations).toEqual(["0000_initial", "0001_foreign_key_indexes", "0002_published_course_search_keys"]);
  });

  it("names the migration state in the order the migrations were applied", async () => {
    const directory = createDirectory();
    // Read back as text, "10_" would come before "2_" and the operator would log an order that
    // never happened. The state named here is the one the runbook has them write down.
    const migrationsDirectory = createMigrations(directory, {
      "2_areas": "CREATE TABLE areas (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);",
      "10_area_note": "ALTER TABLE areas ADD COLUMN note TEXT;",
    });
    const databasePath = path.join(directory, "dhbw-mgmt.sqlite");
    applyPendingMigrations({ databasePath, migrationsDirectory });

    const report = await backupDatabase({ databasePath, targetPath: path.join(directory, "snapshot.sqlite") });

    expect(report.migrations).toEqual(["2_areas", "10_area_note"]);
  });

  it("refuses a snapshot whose foreign keys are broken", async () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory);
    // A study program without its area could only appear through a defect outside the application.
    sqlite.pragma("foreign_keys = OFF");
    sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)")
      .run("program-1", "unbekannter-bereich", "Wirtschaftsinformatik", "WWI", 6);

    await expect(backupDatabase({ databasePath, targetPath: path.join(directory, "snapshot.sqlite") }))
      .rejects.toThrow(/Fremdschlüssel/u);
  });

  it("never overwrites an existing snapshot", async () => {
    const directory = createDirectory();
    const { databasePath } = createRunningDatabase(directory);
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    await backupDatabase({ databasePath, targetPath: snapshotPath });

    await expect(backupDatabase({ databasePath, targetPath: snapshotPath })).rejects.toThrow(/existiert bereits/u);
  });
});

describe("applyPendingMigrations", () => {
  it("applies pending migrations in their versioned order", () => {
    const directory = createDirectory();
    const migrationsDirectory = createMigrations(directory, {
      "0000_initial": "CREATE TABLE areas (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);",
      "0001_area_note": "ALTER TABLE areas ADD COLUMN note TEXT;",
    });
    const databasePath = path.join(directory, "dhbw-mgmt.sqlite");

    expect(applyPendingMigrations({ databasePath, migrationsDirectory })).toEqual(["0000_initial", "0001_area_note"]);

    const sqlite = new Database(databasePath, { readonly: true });
    const columns = sqlite.prepare("PRAGMA table_info(areas)").all() as { name: string }[];
    expect(columns.map((column) => column.name)).toContain("note");
    sqlite.close();
  });

  it("orders migrations by their version number, not by their file name", () => {
    const directory = createDirectory();
    // Sorted as text, "10_" would run before "2_" and alter a table that does not exist yet.
    const migrationsDirectory = createMigrations(directory, {
      "2_areas": "CREATE TABLE areas (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);",
      "10_area_note": "ALTER TABLE areas ADD COLUMN note TEXT;",
    });
    const databasePath = path.join(directory, "dhbw-mgmt.sqlite");

    expect(applyPendingMigrations({ databasePath, migrationsDirectory })).toEqual(["2_areas", "10_area_note"]);
  });

  it("applies nothing when the database is already on the current version", () => {
    const directory = createDirectory();
    const migrationsDirectory = createMigrations(directory, {
      "0000_initial": "CREATE TABLE areas (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);",
    });
    const databasePath = path.join(directory, "dhbw-mgmt.sqlite");
    applyPendingMigrations({ databasePath, migrationsDirectory });

    expect(applyPendingMigrations({ databasePath, migrationsDirectory })).toEqual([]);
  });

  it("keeps the last working state when a migration fails", () => {
    const directory = createDirectory();
    const migrationsDirectory = createMigrations(directory, {
      "0000_initial": "CREATE TABLE areas (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);",
      "0001_area_note": "ALTER TABLE areas ADD COLUMN note TEXT; ALTER TABLE unbekannt ADD COLUMN note TEXT;",
    });
    const databasePath = path.join(directory, "dhbw-mgmt.sqlite");

    expect(() => applyPendingMigrations({ databasePath, migrationsDirectory })).toThrow();

    const sqlite = new Database(databasePath, { readonly: true });
    const columns = sqlite.prepare("PRAGMA table_info(areas)").all() as { name: string }[];
    expect(columns.map((column) => column.name)).not.toContain("note");
    expect(sqlite.prepare("SELECT id FROM _migrations").pluck().all()).toEqual(["0000_initial"]);
    sqlite.close();
  });
});

describe("restoreDatabase", () => {
  it("puts the snapshot in place and keeps the replaced database aside", async () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory, "vorher@dhbw-loerrach.de");
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    await backupDatabase({ databasePath, targetPath: snapshotPath });
    sqlite.prepare("UPDATE user SET email = ? WHERE id = ?").run("nachher@dhbw-loerrach.de", "account-1");
    sqlite.close();

    const report = restoreDatabase({ snapshotPath, databasePath, migrationsDirectory: path.join(process.cwd(), "migrations") });

    const restored = new Database(databasePath, { readonly: true });
    expect(restored.prepare("SELECT email FROM user").pluck().all()).toEqual(["vorher@dhbw-loerrach.de"]);
    restored.close();
    const replaced = openReplacedDatabase(report.replacedPath);
    expect(replaced.prepare("SELECT email FROM user").pluck().all()).toEqual(["nachher@dhbw-loerrach.de"]);
    replaced.close();
  });

  it("reports no replaced database when there was none to replace", async () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory);
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    await backupDatabase({ databasePath, targetPath: snapshotPath });
    sqlite.close();
    // The first restore on a fresh volume: the snapshot arrives where no database is yet.
    const emptyDatabasePath = path.join(directory, "leeres-volume.sqlite");

    const report = restoreDatabase({ snapshotPath, databasePath: emptyDatabasePath, migrationsDirectory: path.join(process.cwd(), "migrations") });

    expect(report.replacedPath).toBeNull();
    expect(existsSync(emptyDatabasePath)).toBe(true);
  });

  it("puts the database back when a move fails halfway through", async () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory, "vorher@dhbw-loerrach.de");
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    await backupDatabase({ databasePath, targetPath: snapshotPath });
    sqlite.close();
    writeFileSync(`${databasePath}-wal`, "Journalinhalt");
    // The names carry the restore's own timestamp, so the clock stands still while the destination
    // of the journal move is blocked by a directory: moving a file onto one fails with EISDIR.
    const now = new Date("2026-07-27T08:00:00.000Z");
    vi.useFakeTimers({ now });
    const replacedPath = `${databasePath}.ersetzt-${now.toISOString().replace(/[:.]/gu, "-")}`;
    mkdirSync(`${replacedPath}-wal`);

    expect(() => restoreDatabase({ snapshotPath, databasePath, migrationsDirectory: path.join(process.cwd(), "migrations") })).toThrow();

    const untouched = new Database(databasePath, { readonly: true });
    expect(untouched.prepare("SELECT email FROM user").pluck().all()).toEqual(["vorher@dhbw-loerrach.de"]);
    untouched.close();
    expect(readFileSync(`${databasePath}-wal`, "utf8")).toBe("Journalinhalt");
    expect(existsSync(replacedPath)).toBe(false);
  });

  it("drops the write-ahead log of the replaced database", async () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory);
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    await backupDatabase({ databasePath, targetPath: snapshotPath });
    sqlite.close();
    // A crashed application leaves a write-ahead log that does not belong to the restored file.
    writeFileSync(`${databasePath}-wal`, "veralteter Journalinhalt");

    restoreDatabase({ snapshotPath, databasePath, migrationsDirectory: path.join(process.cwd(), "migrations") });

    expect(existsSync(`${databasePath}-wal`)).toBe(false);
  });

  it("keeps the replaced database complete, with the journal it was still writing to", async () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory, "vorher@dhbw-loerrach.de");
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    await backupDatabase({ databasePath, targetPath: snapshotPath });
    // The connection stays open, so this write lives in the write-ahead log and not yet in the
    // database file itself — exactly the state a running application is replaced in.
    sqlite.prepare("UPDATE user SET email = ? WHERE id = ?").run("nachher@dhbw-loerrach.de", "account-1");

    const report = restoreDatabase({ snapshotPath, databasePath, migrationsDirectory: path.join(process.cwd(), "migrations") });

    const replaced = openReplacedDatabase(report.replacedPath);
    expect(replaced.prepare("SELECT email FROM user").pluck().all()).toEqual(["nachher@dhbw-loerrach.de"]);
    replaced.close();
    sqlite.close();
  });

  it("refuses a snapshot of a newer application version", async () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory);
    sqlite.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run("0001_kommende_version", new Date().toISOString());
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    await backupDatabase({ databasePath, targetPath: snapshotPath });
    sqlite.close();

    expect(() => restoreDatabase({ snapshotPath, databasePath, migrationsDirectory: path.join(process.cwd(), "migrations") }))
      .toThrow(/unbekannte Migrationen/u);
  });

  it("leaves the database in place when the snapshot fails its check", async () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory, "vorher@dhbw-loerrach.de");
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    await backupDatabase({ databasePath, targetPath: snapshotPath });
    sqlite.close();
    const damaged = new Database(snapshotPath);
    damaged.pragma("foreign_keys = OFF");
    damaged.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)")
      .run("program-1", "unbekannter-bereich", "Wirtschaftsinformatik", "WWI", 6);
    damaged.close();

    expect(() => restoreDatabase({ snapshotPath, databasePath, migrationsDirectory: path.join(process.cwd(), "migrations") }))
      .toThrow(/Fremdschlüssel/u);

    const untouched = new Database(databasePath, { readonly: true });
    expect(untouched.prepare("SELECT email FROM user").pluck().all()).toEqual(["vorher@dhbw-loerrach.de"]);
    untouched.close();
  });
});

describe("operational commands", () => {
  function runCommand(script: string, argumentsList: string[], databasePath: string) {
    return execFileSync(process.execPath, [path.join(process.cwd(), "scripts", script), ...argumentsList], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: databasePath },
    });
  }

  it("backs the database up and names the migration state of the snapshot", () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory);
    sqlite.close();
    const snapshotPath = path.join(directory, "snapshot.sqlite");

    const output = runCommand("backup-db.mjs", ["--to", snapshotPath], databasePath);

    expect(output).toContain(snapshotPath);
    expect(output).toContain("0000_initial");
    expect(existsSync(snapshotPath)).toBe(true);
  });

  it("migrates an empty database to the current schema", () => {
    const directory = createDirectory();
    const databasePath = path.join(directory, "dhbw-mgmt.sqlite");

    const output = runCommand("migrate-db.mjs", [], databasePath);

    expect(output).toContain("0000_initial");
    const sqlite = new Database(databasePath, { readonly: true });
    expect(sqlite.prepare("SELECT id FROM _migrations").pluck().all()).toEqual(["0000_initial", "0001_foreign_key_indexes", "0002_published_course_search_keys"]);
    sqlite.close();
  });

  it("restores a snapshot the operator points at", () => {
    const directory = createDirectory();
    const { databasePath, sqlite } = createRunningDatabase(directory, "vorher@dhbw-loerrach.de");
    const snapshotPath = path.join(directory, "snapshot.sqlite");
    sqlite.close();
    runCommand("backup-db.mjs", ["--to", snapshotPath], databasePath);
    rmSync(databasePath);

    const output = runCommand("restore-db.mjs", ["--from", snapshotPath], databasePath);

    expect(output).toContain("0000_initial");
    const restored = new Database(databasePath, { readonly: true });
    expect(restored.prepare("SELECT email FROM user").pluck().all()).toEqual(["vorher@dhbw-loerrach.de"]);
    restored.close();
  });

  it("refuses to migrate without a configured database", () => {
    expect(() => runCommand("migrate-db.mjs", [], "")).toThrow(/DATABASE_URL/u);
  });
});

describe("migration state of command and application start", () => {
  it("leaves the same schema and the same bookkeeping behind", () => {
    const directory = createDirectory();
    const migrationsDirectory = path.join(process.cwd(), "migrations");
    const byCommandPath = path.join(directory, "befehl.sqlite");
    const byStartPath = path.join(directory, "start.sqlite");

    applyPendingMigrations({ databasePath: byCommandPath, migrationsDirectory });
    const byStart = new Database(byStartPath);
    applyMigrations(byStart, pendingMigrations(byStart));

    const byCommand = new Database(byCommandPath, { readonly: true });
    const schemaOf = (sqlite: Database.Database) => sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all();
    expect(schemaOf(byStart)).toEqual(schemaOf(byCommand));
    expect(byStart.prepare("SELECT id FROM _migrations ORDER BY id").pluck().all())
      .toEqual(byCommand.prepare("SELECT id FROM _migrations ORDER BY id").pluck().all());
    expect(pendingMigrations(byStart)).toEqual([]);
    byStart.close();
    byCommand.close();
  });
});
