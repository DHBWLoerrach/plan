import "server-only";

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { compareMigrationIds, isMigrationFileName } from "@/lib/db/migration-order.mjs";

/**
 * The migration handling of the running application. It reads the same files and the same
 * bookkeeping table as the operational command in `lib/services/database-maintenance.mjs`, and
 * shares its naming and ordering rules with it; only the directory access is its own, because the
 * bundler can trace file access only where it resolves the directory statically — an injectable
 * directory would pull the whole project into the build output.
 */
const migrationsDirectory = path.join(process.cwd(), "migrations");

function migrationIdsOnDisk() {
  return readdirSync(migrationsDirectory)
    .filter(isMigrationFileName)
    .map((fileName) => fileName.slice(0, -".sql".length))
    .sort(compareMigrationIds);
}

/** @returns the migrations the database has not seen yet, without changing anything. */
export function pendingMigrations(sqlite: Database.Database) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
  const applied = new Set(sqlite.prepare("SELECT id FROM _migrations").pluck().all() as string[]);
  return migrationIdsOnDisk().filter((migrationId) => !applied.has(migrationId));
}

/**
 * Applies the pending migrations, each with its bookkeeping entry in one transaction. The list was read before the
 * write lock, so another process may have applied a migration while this one waited; it is skipped then.
 */
export function applyMigrations(sqlite: Database.Database, migrationIds: string[]) {
  const recorded = sqlite.prepare("SELECT 1 FROM _migrations WHERE id = ?");
  for (const migrationId of migrationIds) {
    const statements = readFileSync(path.join(migrationsDirectory, `${migrationId}.sql`), "utf8");
    sqlite.transaction(() => {
      if (recorded.get(migrationId)) return;
      sqlite.exec(statements);
      sqlite.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run(migrationId, new Date().toISOString());
    }).immediate();
  }
}
