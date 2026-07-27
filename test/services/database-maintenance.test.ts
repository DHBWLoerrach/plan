import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { applyMigrations, pendingMigrations } from "@/lib/db/migrations";
import { applyPendingMigrations, backupDatabase, restoreDatabase } from "@/lib/services/database-maintenance.mjs";

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
  sqlite.exec(readFileSync(path.join(process.cwd(), "migrations/0000_initial.sql"), "utf8"));
  sqlite.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run("0000_initial", new Date().toISOString());
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

afterEach(() => {
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

    expect(report.migrations).toEqual(["0000_initial"]);
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
    const replaced = new Database(report.replacedPath, { readonly: true });
    expect(replaced.prepare("SELECT email FROM user").pluck().all()).toEqual(["nachher@dhbw-loerrach.de"]);
    replaced.close();
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
    expect(sqlite.prepare("SELECT id FROM _migrations").pluck().all()).toEqual(["0000_initial"]);
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

