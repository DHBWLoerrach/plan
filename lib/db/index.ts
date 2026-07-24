import "server-only";

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { seedMasterData } from "@/lib/db/seed";

const databasePath = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "dhbw-mgmt.sqlite");

function createDatabase() {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
  const applied = sqlite.prepare("SELECT 1 FROM _migrations WHERE id = ?").get("0000_initial");
  if (!applied) {
    sqlite.exec(readFileSync(path.join(process.cwd(), "drizzle/0000_initial.sql"), "utf8"));
    sqlite.prepare("INSERT OR IGNORE INTO _migrations (id, applied_at) VALUES (?, ?)").run("0000_initial", new Date().toISOString());
  }
  seedMasterData(sqlite);
  return sqlite;
}

const globalDatabase = globalThis as typeof globalThis & { dhbwSqlite?: Database.Database };
export const sqlite = globalDatabase.dhbwSqlite ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalDatabase.dhbwSqlite = sqlite;

export const db = drizzle(sqlite);
