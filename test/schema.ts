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
  apply(sqlite, migrationIds());
}

/**
 * Builds the schema as it stood right after `migrationId`, that migration included. A test of a data
 * migration needs this: it sets up a state in the old model, applies the migration that follows and
 * checks the outcome — which the full build leaves no moment for.
 *
 * Named by the full migration id rather than its version number, because two migrations may share a
 * number and the bookkeeping table records the id as well.
 */
export function applySchemaThrough(sqlite: Database.Database, migrationId: string) {
  const ordered = migrationIds();
  const position = ordered.indexOf(migrationId);
  // A name nobody recognises would otherwise build the whole schema, and a test written against the
  // old model would silently assert against the new one.
  if (position === -1) throw new Error(`Unbekannte Migration: ${migrationId}. Vorhanden sind: ${ordered.join(", ")}.`);
  apply(sqlite, ordered.slice(0, position + 1));
}

function apply(sqlite: Database.Database, ids: string[]) {
  for (const migrationId of ids) {
    sqlite.exec(readFileSync(path.join(migrationsDirectory, `${migrationId}.sql`), "utf8"));
  }
}
