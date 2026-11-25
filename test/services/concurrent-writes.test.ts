import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";

import { createCourseEvent, updateCourseEvent } from "@/lib/services/event-admin";
import { applySchema } from "@/test/schema";

const directories: string[] = [];
const databases: Database.Database[] = [];

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function open(file: string, busyTimeout: number) {
  const sqlite = new Database(file);
  databases.push(sqlite);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma(`busy_timeout = ${busyTimeout}`);
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}

/**
 * The application's connection, with another connection writing the moment a transaction has read for the first
 * time — the gap a second process writes into, like a development helper running the master data seed or an
 * operational command beside the running application. A transaction that began deferred holds a stale snapshot after
 * that write and fails at once, busy timeout or not; one that took the write lock first keeps the other one waiting.
 */
function withWriteAfterFirstRead(sqlite: Database.Database, other: Database.Database) {
  // What became of the other write: still to come, written, or refused with this SQLite code.
  const attempt = { outcome: "not attempted" };
  const writeOnce = () => {
    if (attempt.outcome !== "not attempted" || !sqlite.inTransaction) return;
    try {
      other.prepare("UPDATE users SET updated_at = updated_at + 1").run();
      attempt.outcome = "written";
    } catch (error) {
      // A real second process would wait for the lock instead of being refused.
      attempt.outcome = error instanceof Database.SqliteError ? error.code : String(error);
    }
  };
  const wrap = (statement: Database.Statement): Database.Statement => new Proxy(statement, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        if (result === target) return wrap(target);
        if (property === "get" || property === "all") writeOnce();
        return result;
      };
    },
  });
  const connection = new Proxy(sqlite, {
    get(target, property) {
      if (property === "prepare") return (source: string) => wrap(target.prepare(source));
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { connection, attempt };
}

it("saves while another connection writes during the save, instead of failing with a locked database", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "plan-concurrent-"));
  directories.push(directory);
  const file = path.join(directory, "app.sqlite");
  const sqlite = open(file, 5000);
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area', 'Technik', 'technik');
    INSERT INTO programs VALUES ('program', 'area', 'Informatik', 'TIF', 6);
    INSERT INTO users VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
      ('course', 'program', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);
  const details = { title: "Prüfung", description: "", category: "EXAM", startDate: "2026-12-01", endDate: "", provisional: false };
  const [eventId] = createCourseEvent(sqlite, { accountId: "editor", sourceCourseId: "course", targetCourseIds: [], ...details });
  // The other connection gives up at once: in this single thread it could never get the lock by waiting.
  const other = open(file, 0);

  const { connection, attempt } = withWriteAfterFirstRead(sqlite, other);

  updateCourseEvent(connection, { accountId: "editor", eventId, ...details, title: "Prüfung verlegt" });

  // The other write did happen inside the save, and met the lock the save had already taken.
  expect(attempt.outcome).toBe("SQLITE_BUSY");
  expect(sqlite.prepare("SELECT title FROM course_events").pluck().get()).toBe("Prüfung verlegt");
});
