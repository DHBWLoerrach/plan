import "server-only";

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

/**
 * The migration handling of the running application. It repeats the little the operational command
 * in `lib/services/database-maintenance.mjs` also does, because the bundler can only trace file
 * access whose directory it resolves statically — an injectable directory would pull the whole
 * project into the build output. Both read the same files and the same bookkeeping table.
 */
const migrationsDirectory = path.join(process.cwd(), "migrations");

function migrationIdsOnDisk() {
  return readdirSync(migrationsDirectory)
    .filter((fileName) => /^\d+_.+\.sql$/u.test(fileName))
    .sort()
    .map((fileName) => fileName.slice(0, -".sql".length));
}

/** @returns the migrations the database has not seen yet, without changing anything. */
export function pendingMigrations(sqlite: Database.Database) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
  const applied = new Set(sqlite.prepare("SELECT id FROM _migrations").pluck().all() as string[]);
  return migrationIdsOnDisk().filter((migrationId) => !applied.has(migrationId));
}

/** Applies the pending migrations, each with its bookkeeping entry in one transaction. */
export function applyMigrations(sqlite: Database.Database, migrationIds: string[]) {
  for (const migrationId of migrationIds) {
    const statements = readFileSync(path.join(migrationsDirectory, `${migrationId}.sql`), "utf8");
    sqlite.transaction(() => {
      sqlite.exec(statements);
      sqlite.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run(migrationId, new Date().toISOString());
    })();
  }
}
