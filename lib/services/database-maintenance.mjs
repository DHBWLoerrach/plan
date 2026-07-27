import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

/**
 * @typedef {object} MigrationInput
 * @property {string} databasePath
 * @property {string} migrationsDirectory
 */

/**
 * Applies every versioned migration the database has not seen yet, in file name order. Each
 * migration runs in its own transaction together with its bookkeeping entry, so an interrupted run
 * leaves the database on the last migration that completed. In production this is the only way
 * migrations run; the application start refuses an unmigrated database instead of migrating it.
 *
 * @param {MigrationInput} input
 * @returns {string[]} The migrations applied by this run, in the order they were applied.
 */
export function applyPendingMigrations(input) {
  if (!input.databasePath) throw new Error("DATABASE_URL muss auf die SQLite-Datenbank zeigen.");
  mkdirSync(path.dirname(input.databasePath), { recursive: true });
  const sqlite = new Database(input.databasePath);
  try {
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");

    const alreadyApplied = new Set(appliedMigrationIds(sqlite));
    const appliedNow = [];
    for (const migrationId of migrationIdsOnDisk(input.migrationsDirectory)) {
      if (alreadyApplied.has(migrationId)) continue;
      const statements = readFileSync(path.join(input.migrationsDirectory, `${migrationId}.sql`), "utf8");
      sqlite.transaction(() => {
        sqlite.exec(statements);
        sqlite.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run(migrationId, new Date().toISOString());
      })();
      appliedNow.push(migrationId);
    }
    return appliedNow;
  } finally {
    sqlite.close();
  }
}

/**
 * @param {string} migrationsDirectory
 * @returns {string[]}
 */
function migrationIdsOnDisk(migrationsDirectory) {
  return readdirSync(migrationsDirectory)
    .filter((fileName) => /^\d+_.+\.sql$/u.test(fileName))
    // By version number, not as text: sorted as text "10_" would run before "2_".
    .sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10))
    .map((fileName) => fileName.slice(0, -".sql".length));
}

/**
 * @typedef {object} BackupInput
 * @property {string} databasePath
 * @property {string} targetPath
 */

/**
 * @typedef {object} BackupReport
 * @property {string} targetPath
 * @property {string[]} migrations The migrations the snapshot was taken at, so a restore can pick the matching image.
 */

/**
 * Writes a consistent snapshot of the database with the SQLite Online Backup API and verifies it.
 * The application may keep running and writing; the snapshot contains everything committed up to its
 * completion. A snapshot that fails a check stays on disk unusable rather than replacing a good one,
 * so the command never overwrites an existing file.
 *
 * @param {BackupInput} input
 * @returns {Promise<BackupReport>}
 */
export async function backupDatabase(input) {
  if (!input.databasePath || !existsSync(input.databasePath)) throw new Error("DATABASE_URL muss auf eine vorhandene SQLite-Datenbank zeigen.");
  if (!input.targetPath) throw new Error("Ein Zielpfad für die Sicherung ist erforderlich.");
  if (existsSync(input.targetPath)) throw new Error(`Die Zieldatei ${input.targetPath} existiert bereits.`);

  const sqlite = new Database(input.databasePath, { readonly: true });
  try {
    await sqlite.backup(input.targetPath);
  } finally {
    sqlite.close();
  }

  const snapshot = new Database(input.targetPath, { readonly: true });
  try {
    assertDatabaseIntegrity(snapshot);
    return { targetPath: input.targetPath, migrations: appliedMigrationIds(snapshot) };
  } finally {
    snapshot.close();
  }
}

/**
 * @param {import("better-sqlite3").Database} sqlite
 * @returns {void}
 */
function assertDatabaseIntegrity(sqlite) {
  if (sqlite.pragma("integrity_check", { simple: true }) !== "ok") {
    throw new Error("Die SQLite-Integritätsprüfung ist fehlgeschlagen.");
  }
  if (sqlite.prepare("PRAGMA foreign_key_check").all().length > 0) {
    throw new Error("Die SQLite-Fremdschlüsselintegrität ist verletzt.");
  }
}

/**
 * @param {import("better-sqlite3").Database} sqlite
 * @returns {string[]}
 */
function appliedMigrationIds(sqlite) {
  const migrationTable = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migrations'").get();
  if (!migrationTable) throw new Error("Die Migrationstabelle fehlt. Die Datenbank ist nicht migriert.");
  return /** @type {string[]} */ (sqlite.prepare("SELECT id FROM _migrations ORDER BY id").pluck().all());
}

/**
 * @typedef {object} RestoreInput
 * @property {string} snapshotPath
 * @property {string} databasePath
 * @property {string} migrationsDirectory
 */

/**
 * @typedef {object} RestoreReport
 * @property {string} replacedPath The database that was in place before, kept for inspection.
 * @property {string[]} migrations The migrations of the restored snapshot.
 */

/**
 * Puts a verified snapshot back in place. The application must be stopped: the command replaces the
 * database file and drops the write-ahead log of the replaced database, which would otherwise be
 * applied on top of the restored content. The replaced database is renamed rather than deleted, so a
 * restore started by mistake stays reversible.
 *
 * @param {RestoreInput} input
 * @returns {RestoreReport}
 */
export function restoreDatabase(input) {
  if (!input.snapshotPath || !existsSync(input.snapshotPath)) throw new Error("Der angegebene Snapshot existiert nicht.");
  if (!input.databasePath) throw new Error("DATABASE_URL muss auf die wiederherzustellende SQLite-Datenbank zeigen.");

  const snapshot = new Database(input.snapshotPath, { readonly: true });
  let migrations;
  try {
    assertDatabaseIntegrity(snapshot);
    migrations = appliedMigrationIds(snapshot);
  } finally {
    snapshot.close();
  }
  assertMigrationsKnown(migrations, input.migrationsDirectory);

  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const replacedPath = `${input.databasePath}.ersetzt-${timestamp}`;
  const incomingPath = `${input.databasePath}.neu-${timestamp}`;

  // The copy happens before anything is touched: a full disk or a missing permission then leaves the
  // database where it is. Only renames follow, which the file system completes or not at all.
  copyFileSync(input.snapshotPath, incomingPath);
  try {
    if (existsSync(input.databasePath)) renameSync(input.databasePath, replacedPath);
    // The journal moves with the database it belongs to. Deleting it would drop everything the
    // application had not checkpointed yet and leave an incomplete copy behind; leaving it in place
    // would apply those writes on top of the restored snapshot.
    for (const suffix of ["-wal", "-shm"]) {
      if (existsSync(`${input.databasePath}${suffix}`)) renameSync(`${input.databasePath}${suffix}`, `${replacedPath}${suffix}`);
    }
    renameSync(incomingPath, input.databasePath);
  } catch (error) {
    rmSync(incomingPath, { force: true });
    throw error;
  }
  return { replacedPath, migrations };
}

/**
 * Catches a snapshot whose schema is newer than this image: starting on it would work against a
 * schema the code was never written for. Two application versions that share the same migrations are
 * indistinguishable here — the database records migrations, not application versions.
 *
 * @param {string[]} migrations
 * @param {string} migrationsDirectory
 * @returns {void}
 */
function assertMigrationsKnown(migrations, migrationsDirectory) {
  const known = new Set(migrationIdsOnDisk(migrationsDirectory));
  const unknown = migrations.filter((migrationId) => !known.has(migrationId));
  if (unknown.length > 0) {
    throw new Error(`Der Snapshot enthält unbekannte Migrationen: ${unknown.join(", ")}. Sein Schema ist neuer als diese Anwendungsversion.`);
  }
}
