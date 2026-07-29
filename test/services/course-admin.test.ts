
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createCourse, deleteCourse, updateCourse } from "@/lib/services/course-admin";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-01", "Technik", "technik");
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-02", "Wirtschaft", "wirtschaft");
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)").run("prog-tif", "area-01", "Informatik", "TIF", 6);
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)").run("prog-wwi", "area-02", "Wirtschaftsinformatik", "WWI", 6);
  return sqlite;
}

function insertEditor(sqlite: Database.Database, id: string, areaIds: string[]) {
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES (?, ?, ?, 0, 'AREA_EDITOR', 0, 'ACTIVE', ?, ?)").run(
    id, `${id}@example.test`, `${id}@example.test`, Date.now(), Date.now(),
  );
  for (const areaId of areaIds) sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run(id, areaId);
}

function insertAdmin(sqlite: Database.Database, id: string) {
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES (?, ?, ?, 0, 'NONE', 1, 'ACTIVE', ?, ?)").run(
    id, `${id}@example.test`, `${id}@example.test`, Date.now(), Date.now(),
  );
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createCourse", () => {
  it("trims and case-folds the code and stores a course for the managing area", () => {
    const sqlite = createDatabase();
    insertEditor(sqlite, "editor", ["area-01"]);

    const id = createCourse(sqlite, { accountId: "editor", code: "  TIF24A  ", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });

    expect(sqlite.prepare("SELECT code, normalized_code AS normalizedCode, block_plan_id AS blockPlanId, study_start AS studyStart FROM courses WHERE id = ?").get(id)).toEqual({
      code: "TIF24A", normalizedCode: "tif24a", blockPlanId: null, studyStart: "2024-10-01",
    });
  });

  it("can prepare a new course for the hidden technical planning layer", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");

    const id = createCourse(sqlite, { accountId: "admin", createTechnicalPlan: true, code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });

    expect(sqlite.prepare(`SELECT plan.area_id AS areaId FROM courses course
      JOIN block_plans plan ON plan.id = course.block_plan_id WHERE course.id = ?`).get(id)).toEqual({ areaId: "area-01" });
  });

  it("rejects a duplicate code regardless of case", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    expect(() => createCourse(sqlite, { accountId: "admin", code: "tif24a", programId: "prog-wwi", studyStart: "2024-10-01", studyEnd: "2027-09-30" })).toThrow("bereits vergeben");
  });

  it("rejects invalid calendar days and an inverted study period", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    expect(() => createCourse(sqlite, { accountId: "admin", code: "A", programId: "prog-tif", studyStart: "2024-02-30", studyEnd: "2027-09-30" })).toThrow("gültiger Kalendertag");
    expect(() => createCourse(sqlite, { accountId: "admin", code: "A", programId: "prog-tif", studyStart: "2027-09-30", studyEnd: "2024-10-01" })).toThrow("vor dem Studienende");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM courses").get()).toEqual({ count: 0 });
  });

  it("rejects an empty code, an over-long code and an unknown program", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    expect(() => createCourse(sqlite, { accountId: "admin", code: "   ", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" })).toThrow("erforderlich");
    expect(() => createCourse(sqlite, { accountId: "admin", code: "x".repeat(33), programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" })).toThrow("höchstens 32");
    expect(() => createCourse(sqlite, { accountId: "admin", code: "A", programId: "prog-x", studyStart: "2024-10-01", studyEnd: "2027-09-30" })).toThrow("Studiengang");
  });

  it("rejects an editor without permission for the program's area", () => {
    const sqlite = createDatabase();
    insertEditor(sqlite, "editor", ["area-02"]);
    expect(() => createCourse(sqlite, { accountId: "editor", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" })).toThrow("nicht zur Bearbeitung dieses Bereichs");
  });
});

describe("updateCourse", () => {
  it("changes all four fields for an unassigned course", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });

    updateCourse(sqlite, { accountId: "admin", courseId: id, code: "WWI25B", programId: "prog-wwi", studyStart: "2025-10-01", studyEnd: "2028-09-30" });

    expect(sqlite.prepare("SELECT code, normalized_code AS normalizedCode, program_id AS programId, study_start AS studyStart FROM courses WHERE id = ?").get(id)).toEqual({
      code: "WWI25B", normalizedCode: "wwi25b", programId: "prog-wwi", studyStart: "2025-10-01",
    });
  });

  it("rejects a code that collides with another course", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    const second = createCourse(sqlite, { accountId: "admin", code: "TIF24B", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    expect(() => updateCourse(sqlite, { accountId: "admin", courseId: second, code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" })).toThrow("bereits vergeben");
  });

  it("rejects changing an assigned course so it no longer fits its block plan and touches the draft otherwise", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    sqlite.prepare("INSERT INTO block_plans (id, area_id, name, normalized_name, draft_updated_at) VALUES (?, ?, NULL, NULL, ?)").run("plan-1", "area-01", "2020-01-01T00:00:00.000Z");
    const anchor = createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    const sibling = createCourse(sqlite, { accountId: "admin", code: "TIF24B", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    sqlite.prepare("UPDATE courses SET block_plan_id = 'plan-1' WHERE id IN (?, ?)").run(anchor, sibling);

    // Different area / year than the sibling breaks block plan consistency.
    expect(() => updateCourse(sqlite, { accountId: "admin", courseId: sibling, code: "TIF24B", programId: "prog-wwi", studyStart: "2024-10-01", studyEnd: "2027-09-30" })).toThrow("Bereich des zugeordneten Blockplans");
    expect(() => updateCourse(sqlite, { accountId: "admin", courseId: sibling, code: "TIF24B", programId: "prog-tif", studyStart: "2025-10-01", studyEnd: "2028-09-30" })).toThrow("Jahrgang");

    updateCourse(sqlite, { accountId: "admin", courseId: sibling, code: "TIF24C", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30", now: new Date("2030-05-05T00:00:00.000Z") });
    expect(sqlite.prepare("SELECT draft_updated_at AS at, draft_updated_by_account_id AS by FROM block_plans WHERE id = 'plan-1'").get()).toEqual({
      at: "2030-05-05T00:00:00.000Z", by: "admin",
    });
  });

  it("refuses a study period that would leave a saved course phase outside it", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    sqlite.prepare("INSERT INTO block_plans (id, area_id, draft_updated_at) VALUES ('plan-1', 'area-01', '2020-01-01T00:00:00.000Z')").run();
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    sqlite.prepare("UPDATE courses SET block_plan_id = 'plan-1' WHERE id = ?").run(id);
    sqlite.prepare("INSERT INTO draft_phases (id, block_plan_id, course_id, semester, phase_type, start_date, end_date) VALUES ('ph-1', 'plan-1', ?, 1, 'THEORY', '2024-10-01', '2025-03-31')").run(id);
    const course = { accountId: "admin", courseId: id, code: "TIF24A", programId: "prog-tif" };

    expect(() => updateCourse(sqlite, { ...course, studyStart: "2024-11-01", studyEnd: "2027-09-30" })).toThrow("muss alle Kursphasen des Kurses umfassen");
    expect(() => updateCourse(sqlite, { ...course, studyStart: "2024-10-01", studyEnd: "2025-03-30" })).toThrow("muss alle Kursphasen des Kurses umfassen");
    expect(sqlite.prepare("SELECT study_start AS studyStart, study_end AS studyEnd FROM courses WHERE id = ?").get(id)).toEqual({ studyStart: "2024-10-01", studyEnd: "2027-09-30" });

    // Widening the study period keeps every phase inside it, so it stays allowed.
    updateCourse(sqlite, { ...course, studyStart: "2024-09-01", studyEnd: "2027-10-31" });
    expect(sqlite.prepare("SELECT study_start AS studyStart, study_end AS studyEnd FROM courses WHERE id = ?").get(id)).toEqual({ studyStart: "2024-09-01", studyEnd: "2027-10-31" });
  });
});

describe("deleteCourse", () => {
  it("deletes an unassigned course", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    deleteCourse(sqlite, { accountId: "admin", courseId: id });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM courses").get()).toEqual({ count: 0 });
  });

  it("refuses to delete a publicly visible course and names the blocking block plan", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    sqlite.prepare("INSERT INTO block_plans (id, area_id, draft_updated_at) VALUES ('plan-1', 'area-01', '2020-01-01T00:00:00.000Z')").run();
    sqlite.prepare("INSERT INTO published_versions (id, block_plan_id, published_at, block_plan_name, area_name) VALUES ('ver-1', 'plan-1', '2024-01-01', '2024 · TIF24A', 'Technik')").run();
    sqlite.prepare("INSERT INTO published_course_snapshots (id, version_id, source_course_id, code, program_name, program_abbreviation, study_start, study_end, semesters) VALUES ('snap-1', 'ver-1', ?, 'TIF24A', 'Informatik', 'TIF', '2024-10-01', '2027-09-30', 6)").run(id);

    expect(() => deleteCourse(sqlite, { accountId: "admin", courseId: id })).toThrow("2024 · TIF24A");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM courses").get()).toEqual({ count: 1 });
  });

  it("refuses to delete the last course of a block plan", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    sqlite.prepare("INSERT INTO block_plans (id, area_id, draft_updated_at) VALUES ('plan-1', 'area-01', '2020-01-01T00:00:00.000Z')").run();
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    sqlite.prepare("UPDATE courses SET block_plan_id = 'plan-1' WHERE id = ?").run(id);
    expect(() => deleteCourse(sqlite, { accountId: "admin", courseId: id })).toThrow("letzte Kurs");
  });

  it("detaches an assigned non-last course, clearing its phases and event links", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    sqlite.prepare("INSERT INTO block_plans (id, area_id, draft_updated_at) VALUES ('plan-1', 'area-01', '2020-01-01T00:00:00.000Z')").run();
    const keep = createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    const drop = createCourse(sqlite, { accountId: "admin", code: "TIF24B", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    sqlite.prepare("UPDATE courses SET block_plan_id = 'plan-1' WHERE id IN (?, ?)").run(keep, drop);
    sqlite.prepare("INSERT INTO draft_phases (id, block_plan_id, course_id, semester, phase_type, start_date, end_date) VALUES ('ph-1', 'plan-1', ?, 1, 'THEORY', '2024-10-01', '2025-03-31')").run(drop);
    sqlite.prepare("INSERT INTO draft_events (id, block_plan_id, title, category, start_date, provisional) VALUES ('ev-1', 'plan-1', 'Prüfung', 'EXAM', '2025-01-10', 0)").run();
    sqlite.prepare("INSERT INTO draft_event_courses (event_id, course_id) VALUES ('ev-1', ?), ('ev-1', ?)").run(keep, drop);

    deleteCourse(sqlite, { accountId: "admin", courseId: drop });

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM courses WHERE id = ?").get(drop)).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT course_id AS courseId FROM draft_event_courses").all()).toEqual([{ courseId: keep }]);
  });

  it("refuses to delete an assigned course that would leave an event without any course", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    sqlite.prepare("INSERT INTO block_plans (id, area_id, draft_updated_at) VALUES ('plan-1', 'area-01', '2020-01-01T00:00:00.000Z')").run();
    const keep = createCourse(sqlite, { accountId: "admin", code: "TIF24A", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    const drop = createCourse(sqlite, { accountId: "admin", code: "TIF24B", programId: "prog-tif", studyStart: "2024-10-01", studyEnd: "2027-09-30" });
    sqlite.prepare("UPDATE courses SET block_plan_id = 'plan-1' WHERE id IN (?, ?)").run(keep, drop);
    sqlite.prepare("INSERT INTO draft_events (id, block_plan_id, title, category, start_date, provisional) VALUES ('ev-1', 'plan-1', 'Nur B', 'EXAM', '2025-01-10', 0)").run();
    sqlite.prepare("INSERT INTO draft_event_courses (event_id, course_id) VALUES ('ev-1', ?)").run(drop);

    expect(() => deleteCourse(sqlite, { accountId: "admin", courseId: drop })).toThrow("Nur B");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM courses WHERE id = ?").get(drop)).toEqual({ count: 1 });
  });
});
