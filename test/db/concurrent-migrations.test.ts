import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, expect, it, vi } from "vitest";

import { applyMigrations, pendingMigrations } from "@/lib/db/migrations";
import { applyPendingMigrations } from "@/lib/services/database-maintenance.mjs";
import { migrationIds } from "@/test/schema";

// Runs once, right after a connection has read which migrations are applied: the moment a run alongside has to commit
// in, so the run under test holds a stale list and only learns better under the write lock.
const afterAppliedRead = vi.hoisted(() => ({ hook: null as (() => void) | null }));

vi.mock("better-sqlite3", async (importOriginal) => {
  const Real = (await importOriginal<{ default: typeof import("better-sqlite3") }>()).default;
  const watch = (statement: Database.Statement): Database.Statement => new Proxy(statement, {
    get(inner, property) {
      const value = Reflect.get(inner, property, inner);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = value.apply(inner, args);
        if (result === inner) return watch(inner);
        if (property === "all" && afterAppliedRead.hook) {
          const hook = afterAppliedRead.hook;
          afterAppliedRead.hook = null;
          hook();
        }
        return result;
      };
    },
  });
  const watched = new Proxy(Real, {
    construct(target, args) {
      const sqlite = Reflect.construct(target, args) as Database.Database;
      return new Proxy(sqlite, {
        get(inner, property) {
          if (property === "prepare") {
            return (source: string) => (source === "SELECT id FROM _migrations" ? watch(inner.prepare(source)) : inner.prepare(source));
          }
          const value = Reflect.get(inner, property, inner);
          return typeof value === "function" ? value.bind(inner) : value;
        },
      });
    },
  });
  return { default: watched };
});

const migrationsDirectory = path.join(process.cwd(), "migrations");
const directories: string[] = [];
const databases: Database.Database[] = [];

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function databaseFile() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dhbw-mgmt-migrations-"));
  directories.push(directory);
  return path.join(directory, "app.sqlite");
}

function open(file: string) {
  const sqlite = new Database(file);
  databases.push(sqlite);
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}

function recordedMigrations(file: string) {
  return new Set(open(file).prepare("SELECT id FROM _migrations").pluck().all());
}

// A second run that has applied every migration under the write lock and commits a moment after it is released.
function migrateAlongside(file: string, milliseconds: number) {
  const migrations = migrationIds().map((id) => ({ id, statements: readFileSync(path.join(migrationsDirectory, `${id}.sql`), "utf8") }));
  const started = new Int32Array(new SharedArrayBuffer(4));
  const worker = new Worker(`
    const { parentPort, workerData } = require("node:worker_threads");
    const Database = require(workerData.driver);
    const sqlite = new Database(workerData.file);
    sqlite.exec("BEGIN IMMEDIATE");
    for (const { id, statements } of workerData.migrations) {
      sqlite.exec(statements);
      sqlite.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run(id, new Date().toISOString());
    }
    parentPort.postMessage("holding");
    Atomics.wait(workerData.started, 0, 0, 5000);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, workerData.milliseconds);
    sqlite.exec("COMMIT");
    sqlite.close();
  `, { eval: true, workerData: { file, milliseconds, migrations, started, driver: createRequire(import.meta.url).resolve("better-sqlite3") } });
  const finished = new Promise<void>((resolve, reject) => { worker.once("exit", () => resolve()); worker.once("error", reject); });
  const holding = new Promise<void>((resolve, reject) => { worker.once("message", () => resolve()); worker.once("error", reject); });
  return {
    holding,
    finished,
    /** Lets the other run commit a moment from now. */
    release: () => { Atomics.store(started, 0, 1); Atomics.notify(started, 0); },
  };
}

it("skips at start a migration another process applied after the pending ones were read", () => {
  const file = databaseFile();
  const first = open(file);
  const second = open(file);
  const readBeforehand = pendingMigrations(second);
  expect(readBeforehand).toEqual(migrationIds());

  applyMigrations(first, pendingMigrations(first));
  applyMigrations(second, readBeforehand);

  expect(recordedMigrations(file)).toEqual(new Set(migrationIds()));
});

it("skips in the command a migration a run alongside applied while it waited for the lock", async () => {
  const file = databaseFile();
  open(file).exec("CREATE TABLE _migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");

  const alongside = migrateAlongside(file, 100);
  await alongside.holding;
  let readWhileHeld: unknown[] | null = null;
  afterAppliedRead.hook = () => {
    readWhileHeld = open(file).prepare("SELECT id FROM _migrations").pluck().all();
    alongside.release();
  };
  const applied = applyPendingMigrations({ databasePath: file, migrationsDirectory });
  await alongside.finished;

  // The command read its list while the other run still held its migrations uncommitted.
  expect(readWhileHeld).toEqual([]);
  expect(applied).toEqual([]);
  expect(recordedMigrations(file)).toEqual(new Set(migrationIds()));
});
