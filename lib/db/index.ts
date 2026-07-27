import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { applyMigrations, pendingMigrations } from "@/lib/db/migrations";
import { seedMasterData } from "@/lib/db/seed";

const databasePath = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "dhbw-mgmt.sqlite");
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function createDatabase() {
  // `next build` imports this module to collect the routes, but renders no page that reads data —
  // every page is dynamic. Opening the configured file here would create, migrate and seed a
  // database inside the image, which would then shadow the one on the volume. The build gets an
  // empty database with no schema instead: anything that did query during the build fails on the
  // missing table rather than silently baking data in.
  if (isBuildPhase) return new Database(":memory:");

  mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("journal_mode = WAL");
  // WAL is persistent, but a file system that cannot provide it would silently fall back and make
  // online backups inconsistent, so the start refuses instead.
  if (sqlite.pragma("journal_mode", { simple: true }) !== "wal") {
    throw new Error("Die SQLite-Datenbank läuft nicht im WAL-Modus.");
  }

  // A production migration belongs into the operational path, where the application is stopped and a
  // backup is taken first; a start that migrates on its own would leave that backup unmade. Outside
  // production the start migrates, so a fresh checkout runs without a separate command.
  const pending = pendingMigrations(sqlite);
  if (pending.length > 0) {
    if (process.env.NODE_ENV === "production") throw new Error(`Ausstehende Migrationen: ${pending.join(", ")}. Führen Sie zuerst npm run migrate:db aus.`);
    applyMigrations(sqlite, pending);
  }

  seedMasterData(sqlite);
  return sqlite;
}

const globalDatabase = globalThis as typeof globalThis & { dhbwSqlite?: Database.Database };
export const sqlite = globalDatabase.dhbwSqlite ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalDatabase.dhbwSqlite = sqlite;

export const db = drizzle(sqlite);
