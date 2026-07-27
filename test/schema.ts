import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { compareMigrationIds, isMigrationFileName } from "@/lib/db/migration-order.mjs";

const migrationsDirectory = path.join(process.cwd(), "migrations");

/** Every migration on disk, in the order the operational command applies them. */
export function migrationIds() {
  return readdirSync(migrationsDirectory)
    .filter(isMigrationFileName)
    .map((fileName) => fileName.slice(0, -".sql".length))
    .sort(compareMigrationIds);
}

/**
 * Builds the production schema in a test database. Tests run against every migration rather than the
 * initial one alone, so a migration that changes how the application behaves is covered by the tests
 * of that behaviour instead of only by the tests of the migration mechanism.
 */
export function applySchema(sqlite: Database.Database) {
  for (const migrationId of migrationIds()) {
    sqlite.exec(readFileSync(path.join(migrationsDirectory, `${migrationId}.sql`), "utf8"));
  }
}
