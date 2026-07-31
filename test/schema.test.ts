import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { applySchema, applySchemaThrough } from "@/test/schema";

/** Whether the database carries a schema object of that kind under that name. */
function hasSchemaObject(sqlite: Database.Database, kind: "table" | "index", name: string) {
  return sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?").pluck().get(kind, name) === 1;
}

function databaseWithCourse() {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt)
      VALUES ('editor', 'Editor', 'editor@test.invalid', 0, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO areas VALUES ('area', 'Technik', 'technik');
    INSERT INTO programs VALUES ('program', 'area', 'Informatik', 'TIF', 6);
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
      VALUES ('course', 'program', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');
  `);
  return sqlite;
}

function expectCheckFailure(action: () => unknown): void {
  expect(action).toThrow(/CHECK constraint failed/u);
}

function expectUniqueFailure(action: () => unknown): void {
  expect(action).toThrow(/UNIQUE constraint failed/u);
}

describe("applySchemaThrough", () => {
  it("stops at the named migration while the full build goes on past it", () => {
    // The course tables arrive with the initial schema; the foreign-key indexes separate the two builds.
    const limited = new Database(":memory:");
    applySchemaThrough(limited, "0000_initial");
    const complete = new Database(":memory:");
    applySchema(complete);

    expect(hasSchemaObject(limited, "table", "courses")).toBe(true);
    expect(hasSchemaObject(limited, "index", "course_phases_by_course")).toBe(false);
    expect(hasSchemaObject(complete, "index", "course_phases_by_course")).toBe(true);
  });

  it("refuses a migration it does not know instead of applying all of them", () => {
    const sqlite = new Database(":memory:");

    // A name no migration on disk resembles: the message lists the known ones, so a name close to a
    // real one would match that list and the assertion would no longer show what was rejected.
    expect(() => applySchemaThrough(sqlite, "9999_erfunden")).toThrow(/9999_erfunden/u);
    // A build that silently fell back to everything would leave a usable schema behind, and the test
    // that meant to observe the old state would pass against the new one.
    expect(hasSchemaObject(sqlite, "table", "courses")).toBe(false);
  });
});

describe("course planning schema", () => {
  it("has one set of course-owned data tables with foreign-key indexes", () => {
    const sqlite = new Database(":memory:");
    applySchema(sqlite);

    for (const table of ["courses", "course_phases", "course_events"]) {
      expect(hasSchemaObject(sqlite, "table", table)).toBe(true);
    }
    for (const table of ["block_plans", "draft_phases", "draft_events", "published_courses", "published_phases", "published_events", "published_versions", "published_course_snapshots"]) {
      expect(hasSchemaObject(sqlite, "table", table)).toBe(false);
    }
    for (const index of ["course_phases_by_course", "course_events_by_course"]) {
      expect(hasSchemaObject(sqlite, "index", index)).toBe(true);
    }
  });

  it("restricts every stored boolean to zero or one", () => {
    const sqlite = databaseWithCourse();

    expectCheckFailure(() => sqlite.prepare("UPDATE user SET emailVerified = 2 WHERE id = 'editor'").run());
    expectCheckFailure(() => sqlite.prepare("UPDATE user SET system_admin = -1 WHERE id = 'editor'").run());
    expectCheckFailure(() => sqlite.prepare(`INSERT INTO course_events
      (id, course_id, title, description, category, start_date, end_date, provisional)
      VALUES ('event', 'course', 'Prüfung', NULL, 'EXAM', '2027-01-01', NULL, 2)`).run());
  });

  it("restricts phase semesters to whole numbers from one through seven", () => {
    const sqlite = databaseWithCourse();
    const insert = sqlite.prepare(`INSERT INTO course_phases
      (id, course_id, semester, phase_type, start_date, end_date) VALUES (?, 'course', ?, 'THEORY', '2026-10-01', '2026-10-02')`);

    for (const [id, semester] of [["zero", 0], ["fraction", 1.5], ["eight", 8]] as const) {
      expectCheckFailure(() => insert.run(id, semester));
    }
    expect(insert.run("seven", 7).changes).toBe(1);
  });

  it("accepts only real calendar days in canonical form", () => {
    const sqlite = databaseWithCourse();

    expectCheckFailure(() => sqlite.prepare("UPDATE courses SET study_start = '2026-02-31' WHERE id = 'course'").run());
    expectCheckFailure(() => sqlite.prepare("UPDATE courses SET study_end = '2029-9-30' WHERE id = 'course'").run());
    expectCheckFailure(() => sqlite.prepare(`INSERT INTO course_phases
      (id, course_id, semester, phase_type, start_date, end_date)
      VALUES ('phase', 'course', 1, 'THEORY', '2026-02-29', '2027-01-01')`).run());
    expectCheckFailure(() => sqlite.prepare(`INSERT INTO course_events
      (id, course_id, title, description, category, start_date, end_date, provisional)
      VALUES ('event', 'course', 'Prüfung', NULL, 'EXAM', '2027-01-01', '2027-02-30', 0)`).run());
  });

  it("enforces required domain texts and their documented maximum lengths", () => {
    const sqlite = databaseWithCourse();

    expectCheckFailure(() => sqlite.prepare("UPDATE user SET email = ? WHERE id = 'editor'").run(" "));
    expectCheckFailure(() => sqlite.prepare("UPDATE user SET email = ? WHERE id = 'editor'").run(`${"a".repeat(243)}@example.invalid`));
    expectCheckFailure(() => sqlite.prepare("UPDATE areas SET name = ? WHERE id = 'area'").run(" "));
    expectCheckFailure(() => sqlite.prepare("UPDATE areas SET name = ? WHERE id = 'area'").run("a".repeat(121)));
    expectCheckFailure(() => sqlite.prepare("UPDATE areas SET normalized_name = ' ' WHERE id = 'area'").run());
    expectCheckFailure(() => sqlite.prepare("UPDATE programs SET name = ' ' WHERE id = 'program'").run());
    expectCheckFailure(() => sqlite.prepare("UPDATE programs SET name = ? WHERE id = 'program'").run("p".repeat(161)));
    expectCheckFailure(() => sqlite.prepare("UPDATE programs SET abbreviation = ' ' WHERE id = 'program'").run());
    expectCheckFailure(() => sqlite.prepare("UPDATE programs SET abbreviation = ? WHERE id = 'program'").run("a".repeat(21)));
    expectCheckFailure(() => sqlite.prepare("UPDATE courses SET code = ' ' WHERE id = 'course'").run());
    expectCheckFailure(() => sqlite.prepare("UPDATE courses SET code = ? WHERE id = 'course'").run("c".repeat(33)));
    expectCheckFailure(() => sqlite.prepare("UPDATE courses SET normalized_code = ' ' WHERE id = 'course'").run());

    const insertEvent = sqlite.prepare(`INSERT INTO course_events
      (id, course_id, title, description, category, start_date, end_date, provisional)
      VALUES (?, 'course', ?, ?, 'EXAM', '2027-01-01', NULL, 0)`);
    expectCheckFailure(() => insertEvent.run("empty-title", " ", null));
    expectCheckFailure(() => insertEvent.run("long-title", "t".repeat(161), null));
    expectCheckFailure(() => insertEvent.run("empty-description", "Prüfung", " "));
    expectCheckFailure(() => insertEvent.run("long-description", "Prüfung", "d".repeat(2001)));
  });

  it("keeps login addresses, program abbreviations and password-link hashes unambiguous", () => {
    const sqlite = databaseWithCourse();
    sqlite.prepare(`INSERT INTO user
      (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt)
      VALUES ('other', 'Other', 'other@test.invalid', 0, 'NONE', 1, 'ACTIVE', 0, 0)`).run();

    expectUniqueFailure(() => sqlite.prepare(`INSERT INTO user
      (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt)
      VALUES ('same-email', 'Same', 'EDITOR@test.invalid', 0, 'NONE', 1, 'ACTIVE', 0, 0)`).run());
    expectUniqueFailure(() => sqlite.prepare(`INSERT INTO programs
      (id, area_id, name, abbreviation, semesters) VALUES ('same-abbreviation', 'area', 'Andere Informatik', 'tif', 6)`).run());

    sqlite.prepare(`INSERT INTO password_links (id, user_id, token_hash, expires_at, created_at)
      VALUES ('link-editor', 'editor', 'same-hash', '2026-08-07T00:00:00.000Z', '2026-07-31T00:00:00.000Z')`).run();
    expectUniqueFailure(() => sqlite.prepare(`INSERT INTO password_links (id, user_id, token_hash, expires_at, created_at)
      VALUES ('link-other', 'other', 'same-hash', '2026-08-07T00:00:00.000Z', '2026-07-31T00:00:00.000Z')`).run());
  });
});
