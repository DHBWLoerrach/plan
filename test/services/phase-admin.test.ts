import { readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { attachCourse, createBlockPlanFromCourse } from "@/lib/services/block-plan-admin";
import { createCourse } from "@/lib/services/course-admin";
import { createDraftPhases, deleteDraftPhase, updateDraftPhase } from "@/lib/services/phase-admin";

const databases: Database.Database[] = [];

function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  sqlite.exec(readFileSync(path.join(process.cwd(), "drizzle/0000_initial.sql"), "utf8"));
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-01", "Technik", "technik");
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)").run("prog-tif", "area-01", "Informatik", "TIF", 6);
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES ('admin', 'admin', 'admin@example.test', 0, 'NONE', 1, 'ACTIVE', ?, ?)").run(Date.now(), Date.now());
  return sqlite;
}

function insertEditor(sqlite: Database.Database, id: string, areaIds: string[]) {
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES (?, ?, ?, 0, 'AREA_EDITOR', 0, 'ACTIVE', ?, ?)").run(
    id, `${id}@example.test`, `${id}@example.test`, Date.now(), Date.now(),
  );
  for (const areaId of areaIds) sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run(id, areaId);
}

function addCourse(sqlite: Database.Database, code: string) {
  return createCourse(sqlite, { accountId: "admin", code, programId: "prog-tif", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
}

/** A block plan with two assigned courses — the usual starting point for a phase created for one or both of them. */
function createPlanWithCourses(sqlite: Database.Database) {
  const first = addCourse(sqlite, "TIF26A");
  const second = addCourse(sqlite, "TIF26B");
  const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: first });
  attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: second });
  return { blockPlanId, first, second };
}

/** A structurally valid phase for the given courses; single fields get overridden per test. */
function validPhase(courseIds: string[]) {
  return { courseIds, semester: "1", type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" };
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createDraftPhases", () => {
  it("creates one independent phase per selected course and records the draft change", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first, second } = createPlanWithCourses(sqlite);

    const phaseIds = createDraftPhases(sqlite, {
      accountId: "admin",
      blockPlanId,
      ...validPhase([first, second]),
      now: new Date("2026-08-01T09:00:00.000Z"),
    });

    expect(phaseIds).toHaveLength(2);
    expect(new Set(phaseIds).size).toBe(2);
    expect(sqlite.prepare(`SELECT course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate
      FROM draft_phases WHERE block_plan_id = ? ORDER BY course_id`).all(blockPlanId)).toEqual(
      [first, second].toSorted().map((courseId) => ({ courseId, semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" })),
    );
    expect(sqlite.prepare("SELECT draft_updated_at AS at, draft_updated_by_account_id AS by FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({
      at: "2026-08-01T09:00:00.000Z", by: "admin",
    });
  });

  it("lets phases of the same type follow one another directly and keeps them separate", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first]) });

    createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first]), startDate: "2027-01-01", endDate: "2027-03-31" });

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases WHERE course_id = ?").get(first)).toEqual({ count: 2 });
  });

  it("accepts a phase covering a single day and rejects an end date before the start date", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);

    createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first]), startDate: "2026-10-01", endDate: "2026-10-01" });

    expect(() => createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first]), endDate: "2026-09-30" }))
      .toThrow(expect.objectContaining({ field: "endDate", message: "Das Enddatum darf nicht vor dem Startdatum liegen." }));
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 1 });
  });

  it("rejects a semester outside the study duration, an unknown phase type and an invalid calendar day", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const phase = { accountId: "admin", blockPlanId, ...validPhase([first]) };

    expect(() => createDraftPhases(sqlite, { ...phase, semester: "0" })).toThrow(expect.objectContaining({ field: "semester" }));
    expect(() => createDraftPhases(sqlite, { ...phase, semester: "7" })).toThrow(expect.objectContaining({ field: "semester" }));
    expect(() => createDraftPhases(sqlite, { ...phase, semester: "1,5" })).toThrow(expect.objectContaining({ field: "semester" }));
    expect(() => createDraftPhases(sqlite, { ...phase, type: "URLAUB" })).toThrow(expect.objectContaining({ field: "type" }));
    expect(() => createDraftPhases(sqlite, { ...phase, startDate: "2026-02-30" })).toThrow(expect.objectContaining({ field: "startDate" }));
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 0 });
  });

  it("requires at least one course and accepts only courses of this block plan", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const unassigned = addCourse(sqlite, "TIF26C");
    const phase = { accountId: "admin", blockPlanId, ...validPhase([first]) };

    expect(() => createDraftPhases(sqlite, { ...phase, courseIds: [] })).toThrow(expect.objectContaining({ field: "courseIds" }));
    expect(() => createDraftPhases(sqlite, { ...phase, courseIds: [first, unassigned] })).toThrow("gehört nicht zu diesem Blockplan");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 0 });
  });

  it("creates one phase per course even when a course is selected twice", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);

    createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first, first]) });

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 1 });
  });

  it("rejects an unknown block plan and an account without permission for its area", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    insertEditor(sqlite, "editor", []);

    expect(() => createDraftPhases(sqlite, { accountId: "admin", blockPlanId: "unknown", ...validPhase([first]) })).toThrow("Blockplan wurde nicht gefunden");
    expect(() => createDraftPhases(sqlite, { accountId: "editor", blockPlanId, ...validPhase([first]) })).toThrow("nicht zur Bearbeitung dieses Bereichs");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 0 });
  });
});

describe("updateDraftPhase", () => {
  it("changes only the edited phase and leaves the jointly created one of the other course untouched", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first, second } = createPlanWithCourses(sqlite);
    const [edited, untouched] = createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first, second]) });

    updateDraftPhase(sqlite, {
      accountId: "admin",
      phaseId: edited,
      semester: "2",
      type: "PRACTICE",
      startDate: "2027-01-04",
      endDate: "2027-03-31",
      now: new Date("2026-09-09T07:00:00.000Z"),
    });

    expect(sqlite.prepare("SELECT course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM draft_phases WHERE id = ?").get(edited)).toEqual({
      courseId: first, semester: 2, type: "PRACTICE", startDate: "2027-01-04", endDate: "2027-03-31",
    });
    expect(sqlite.prepare("SELECT course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM draft_phases WHERE id = ?").get(untouched)).toEqual({
      courseId: second, semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31",
    });
    expect(sqlite.prepare("SELECT draft_updated_at AS at FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({ at: "2026-09-09T07:00:00.000Z" });
  });

  it("keeps the stored phase unchanged when the new details violate a structural rule", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const [phaseId] = createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first]) });
    const change = { accountId: "admin", phaseId, semester: "2", type: "PRACTICE", startDate: "2027-01-04", endDate: "2027-03-31" };

    expect(() => updateDraftPhase(sqlite, { ...change, semester: "9" })).toThrow(expect.objectContaining({ field: "semester" }));
    expect(() => updateDraftPhase(sqlite, { ...change, endDate: "2027-01-03" })).toThrow(expect.objectContaining({ field: "endDate" }));
    expect(sqlite.prepare("SELECT semester, phase_type AS type, start_date AS startDate FROM draft_phases WHERE id = ?").get(phaseId)).toEqual({
      semester: 1, type: "THEORY", startDate: "2026-10-01",
    });
  });

  it("rejects an unknown phase and an account without permission for its area", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const [phaseId] = createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first]) });
    insertEditor(sqlite, "editor", []);
    const change = { semester: "2", type: "PRACTICE", startDate: "2027-01-04", endDate: "2027-03-31" };

    expect(() => updateDraftPhase(sqlite, { accountId: "admin", phaseId: "unknown", ...change })).toThrow("Kursphase wurde nicht gefunden");
    expect(() => updateDraftPhase(sqlite, { accountId: "editor", phaseId, ...change })).toThrow("nicht zur Bearbeitung dieses Bereichs");
  });
});

describe("deleteDraftPhase", () => {
  it("removes only the selected phase and records the draft change", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first, second } = createPlanWithCourses(sqlite);
    const [dropped, kept] = createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first, second]) });

    deleteDraftPhase(sqlite, { accountId: "admin", phaseId: dropped, now: new Date("2026-10-10T11:00:00.000Z") });

    expect(sqlite.prepare("SELECT id FROM draft_phases").all()).toEqual([{ id: kept }]);
    expect(sqlite.prepare("SELECT draft_updated_at AS at FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({ at: "2026-10-10T11:00:00.000Z" });
  });

  it("rejects an unknown phase and an account without permission for its area", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const [phaseId] = createDraftPhases(sqlite, { accountId: "admin", blockPlanId, ...validPhase([first]) });
    insertEditor(sqlite, "editor", []);

    expect(() => deleteDraftPhase(sqlite, { accountId: "admin", phaseId: "unknown" })).toThrow("Kursphase wurde nicht gefunden");
    expect(() => deleteDraftPhase(sqlite, { accountId: "editor", phaseId })).toThrow("nicht zur Bearbeitung dieses Bereichs");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 1 });
  });
});
