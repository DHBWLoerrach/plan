import { readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { attachCourse, createBlockPlanFromCourse, deleteBlockPlan, detachCourse, listAttachableCourses, renameBlockPlan } from "@/lib/services/block-plan-admin";
import { createCourse } from "@/lib/services/course-admin";

const databases: Database.Database[] = [];

function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  sqlite.exec(readFileSync(path.join(process.cwd(), "drizzle/0000_initial.sql"), "utf8"));
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-01", "Technik", "technik");
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-02", "Wirtschaft", "wirtschaft");
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)").run("prog-tif", "area-01", "Informatik", "TIF", 6);
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)").run("prog-mec", "area-01", "Maschinenbau", "MEC", 7);
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

function addCourse(sqlite: Database.Database, code: string, options: { programId?: string; studyStart?: string; studyEnd?: string } = {}) {
  return createCourse(sqlite, {
    accountId: "admin",
    code,
    programId: options.programId ?? "prog-tif",
    studyStart: options.studyStart ?? "2024-10-01",
    studyEnd: options.studyEnd ?? "2027-09-30",
  });
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createBlockPlanFromCourse", () => {
  it("creates the block plan and assigns the first course in one operation", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const courseId = addCourse(sqlite, "TIF24A");

    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId, now: new Date("2026-03-01T10:00:00.000Z") });

    expect(sqlite.prepare("SELECT area_id AS areaId, name, normalized_name AS normalizedName, has_ever_been_published AS published, draft_updated_at AS draftUpdatedAt, draft_updated_by_account_id AS draftUpdatedBy FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({
      areaId: "area-01", name: null, normalizedName: null, published: 0, draftUpdatedAt: "2026-03-01T10:00:00.000Z", draftUpdatedBy: "admin",
    });
    expect(sqlite.prepare("SELECT block_plan_id AS blockPlanId FROM courses WHERE id = ?").get(courseId)).toEqual({ blockPlanId });
  });

  it("rejects a course that already belongs to a block plan and leaves no block plan behind", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const courseId = addCourse(sqlite, "TIF24A");
    createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId });

    expect(() => createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId })).toThrow("bereits einem Blockplan zugeordnet");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM block_plans").get()).toEqual({ count: 1 });
  });

  it("rejects an editor without permission for the course's area", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    insertEditor(sqlite, "editor", ["area-02"]);
    const courseId = addCourse(sqlite, "TIF24A");

    expect(() => createBlockPlanFromCourse(sqlite, { accountId: "editor", courseId })).toThrow("nicht zur Bearbeitung dieses Bereichs");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM block_plans").get()).toEqual({ count: 0 });
  });
});

describe("attachCourse", () => {
  it("assigns a matching course and records the draft change", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const first = addCourse(sqlite, "TIF24A");
    const second = addCourse(sqlite, "TIF24B", { studyStart: "2024-09-01", studyEnd: "2027-08-31" });
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: first, now: new Date("2026-03-01T10:00:00.000Z") });

    attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: second, now: new Date("2026-03-02T09:00:00.000Z") });

    expect(sqlite.prepare("SELECT id FROM courses WHERE block_plan_id = ? ORDER BY code").all(blockPlanId)).toEqual([{ id: first }, { id: second }]);
    expect(sqlite.prepare("SELECT draft_updated_at AS at, draft_updated_by_account_id AS by FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({
      at: "2026-03-02T09:00:00.000Z", by: "admin",
    });
  });

  it("rejects a course from another area, another year or another study duration", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const first = addCourse(sqlite, "TIF24A");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: first });
    const otherArea = addCourse(sqlite, "WWI24A", { programId: "prog-wwi" });
    const otherYear = addCourse(sqlite, "TIF25A", { studyStart: "2025-10-01", studyEnd: "2028-09-30" });
    const otherDuration = addCourse(sqlite, "MEC24A", { programId: "prog-mec" });

    expect(() => attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: otherArea })).toThrow("Bereich");
    expect(() => attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: otherYear })).toThrow("Jahrgang");
    expect(() => attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: otherDuration })).toThrow("Semesteranzahl");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM courses WHERE block_plan_id = ?").get(blockPlanId)).toEqual({ count: 1 });
  });

  it("rejects a twenty-first course", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const first = addCourse(sqlite, "TIF24-01");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: first });
    for (let index = 2; index <= 20; index += 1) {
      attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: addCourse(sqlite, `TIF24-${index}`) });
    }

    const surplus = addCourse(sqlite, "TIF24-21");
    expect(() => attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: surplus })).toThrow("höchstens 20 Kurse");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM courses WHERE block_plan_id = ?").get(blockPlanId)).toEqual({ count: 20 });
  });
});

describe("detachCourse", () => {
  it("detaches a course and drops its phases and event links in this draft", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const keep = addCourse(sqlite, "TIF24A");
    const drop = addCourse(sqlite, "TIF24B");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: keep });
    attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: drop });
    sqlite.prepare("INSERT INTO draft_phases (id, block_plan_id, course_id, semester, phase_type, start_date, end_date) VALUES ('ph-1', ?, ?, 1, 'THEORY', '2024-10-01', '2025-03-31')").run(blockPlanId, drop);
    sqlite.prepare("INSERT INTO draft_events (id, block_plan_id, title, category, start_date, provisional) VALUES ('ev-1', ?, 'Prüfung', 'EXAM', '2025-01-10', 0)").run(blockPlanId);
    sqlite.prepare("INSERT INTO draft_event_courses (event_id, course_id) VALUES ('ev-1', ?), ('ev-1', ?)").run(keep, drop);

    detachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: drop, now: new Date("2026-04-01T08:00:00.000Z") });

    expect(sqlite.prepare("SELECT block_plan_id AS blockPlanId FROM courses WHERE id = ?").get(drop)).toEqual({ blockPlanId: null });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT course_id AS courseId FROM draft_event_courses").all()).toEqual([{ courseId: keep }]);
    expect(sqlite.prepare("SELECT draft_updated_at AS at FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({ at: "2026-04-01T08:00:00.000Z" });
  });

  it("refuses to detach the last course of a block plan", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const only = addCourse(sqlite, "TIF24A");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: only });

    expect(() => detachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: only })).toThrow("letzte Kurs");
    expect(sqlite.prepare("SELECT block_plan_id AS blockPlanId FROM courses WHERE id = ?").get(only)).toEqual({ blockPlanId });
  });

  it("refuses to detach a course that would leave an event without any course", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const keep = addCourse(sqlite, "TIF24A");
    const drop = addCourse(sqlite, "TIF24B");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: keep });
    attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: drop });
    sqlite.prepare("INSERT INTO draft_events (id, block_plan_id, title, category, start_date, provisional) VALUES ('ev-1', ?, 'Nur B', 'EXAM', '2025-01-10', 0)").run(blockPlanId);
    sqlite.prepare("INSERT INTO draft_event_courses (event_id, course_id) VALUES ('ev-1', ?)").run(drop);

    expect(() => detachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: drop })).toThrow("Nur B");
    expect(sqlite.prepare("SELECT block_plan_id AS blockPlanId FROM courses WHERE id = ?").get(drop)).toEqual({ blockPlanId });
  });

  it("rejects a course that belongs to another block plan", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const own = addCourse(sqlite, "TIF24A");
    const foreign = addCourse(sqlite, "TIF24B");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: own });
    createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: foreign });

    expect(() => detachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: foreign })).toThrow("nicht diesem Blockplan");
  });
});

describe("renameBlockPlan", () => {
  it("stores a trimmed, whitespace-collapsed name and records the draft change", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "TIF24A") });

    renameBlockPlan(sqlite, { accountId: "admin", blockPlanId, name: "  Technik   Jahrgang 2024 ", now: new Date("2026-05-01T12:00:00.000Z") });

    expect(sqlite.prepare("SELECT name, normalized_name AS normalizedName, draft_updated_at AS at FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({
      name: "Technik Jahrgang 2024", normalizedName: "technik jahrgang 2024", at: "2026-05-01T12:00:00.000Z",
    });
  });

  it("clears the name when the given designation is empty", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "TIF24A") });
    renameBlockPlan(sqlite, { accountId: "admin", blockPlanId, name: "Technik 2024" });

    renameBlockPlan(sqlite, { accountId: "admin", blockPlanId, name: "   " });

    expect(sqlite.prepare("SELECT name, normalized_name AS normalizedName FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({ name: null, normalizedName: null });
  });

  it("rejects a name already used in the same area regardless of case, but allows it in another area", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const taken = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "TIF24A") });
    const other = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "TIF24B") });
    const elsewhere = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "WWI24A", { programId: "prog-wwi" }) });
    renameBlockPlan(sqlite, { accountId: "admin", blockPlanId: taken, name: "Technik 2024" });

    expect(() => renameBlockPlan(sqlite, { accountId: "admin", blockPlanId: other, name: "technik 2024" })).toThrow("bereits vergeben");
    renameBlockPlan(sqlite, { accountId: "admin", blockPlanId: elsewhere, name: "technik 2024" });
    expect(sqlite.prepare("SELECT name FROM block_plans WHERE id = ?").get(elsewhere)).toEqual({ name: "technik 2024" });
  });

  it("rejects a name longer than 160 characters and keeps its own name on rename", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "TIF24A") });
    renameBlockPlan(sqlite, { accountId: "admin", blockPlanId, name: "Technik 2024" });

    expect(() => renameBlockPlan(sqlite, { accountId: "admin", blockPlanId, name: "x".repeat(161) })).toThrow("höchstens 160");
    renameBlockPlan(sqlite, { accountId: "admin", blockPlanId, name: "Technik 2024" });
    expect(sqlite.prepare("SELECT name FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({ name: "Technik 2024" });
  });
});

describe("deleteBlockPlan", () => {
  it("deletes an unpublished block plan with its draft and leaves its courses without a block plan", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const first = addCourse(sqlite, "TIF24A");
    const second = addCourse(sqlite, "TIF24B");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: first });
    attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: second });
    sqlite.prepare("INSERT INTO draft_phases (id, block_plan_id, course_id, semester, phase_type, start_date, end_date) VALUES ('ph-1', ?, ?, 1, 'THEORY', '2024-10-01', '2025-03-31')").run(blockPlanId, first);
    sqlite.prepare("INSERT INTO draft_events (id, block_plan_id, title, category, start_date, provisional) VALUES ('ev-1', ?, 'Prüfung', 'EXAM', '2025-01-10', 0)").run(blockPlanId);
    sqlite.prepare("INSERT INTO draft_event_courses (event_id, course_id) VALUES ('ev-1', ?)").run(first);

    deleteBlockPlan(sqlite, { accountId: "admin", blockPlanId });

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM block_plans").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_events").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_event_courses").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM courses WHERE block_plan_id IS NULL").get()).toEqual({ count: 2 });
  });

  it("deletes a withdrawn block plan as well", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "TIF24A") });
    sqlite.prepare("UPDATE block_plans SET has_ever_been_published = 1 WHERE id = ?").run(blockPlanId);

    deleteBlockPlan(sqlite, { accountId: "admin", blockPlanId });

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM block_plans").get()).toEqual({ count: 0 });
  });

  it("refuses to delete a block plan with a published version", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "TIF24A") });
    sqlite.prepare("INSERT INTO published_versions (id, block_plan_id, published_at, block_plan_name, area_name) VALUES ('ver-1', ?, '2026-01-01', '2024 · TIF24A', 'Technik')").run(blockPlanId);

    expect(() => deleteBlockPlan(sqlite, { accountId: "admin", blockPlanId })).toThrow("veröffentlichter Fassung");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM block_plans").get()).toEqual({ count: 1 });
  });

  it("rejects an editor without permission for the block plan's area", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    insertEditor(sqlite, "editor", ["area-02"]);
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: addCourse(sqlite, "TIF24A") });

    expect(() => deleteBlockPlan(sqlite, { accountId: "editor", blockPlanId })).toThrow("nicht zur Bearbeitung dieses Bereichs");
  });
});

describe("listAttachableCourses", () => {
  it("offers only unassigned courses of the same area, year and study duration", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const first = addCourse(sqlite, "TIF24A");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: first });
    const fitting = addCourse(sqlite, "TIF24B", { studyStart: "2024-09-01", studyEnd: "2027-08-31" });
    addCourse(sqlite, "WWI24A", { programId: "prog-wwi" });
    addCourse(sqlite, "MEC24A", { programId: "prog-mec" });
    addCourse(sqlite, "TIF25A", { studyStart: "2025-10-01", studyEnd: "2028-09-30" });
    const assignedElsewhere = addCourse(sqlite, "TIF24C");
    createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: assignedElsewhere });

    expect(listAttachableCourses(sqlite, blockPlanId).map((course) => course.code)).toEqual(["TIF24B"]);
    expect(listAttachableCourses(sqlite, blockPlanId)[0]).toMatchObject({ id: fitting, program: "Informatik", studyStart: "2024-09-01", studyEnd: "2027-08-31" });
  });
  it("offers no course while the assigned courses disagree about year or study duration", () => {
    const sqlite = createDatabase();
    insertAdmin(sqlite, "admin");
    const first = addCourse(sqlite, "TIF24A");
    const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: first });
    // A block plan whose courses disagree can only arise outside the service; the offer must not propose a course
    // that matches just one of them (FACHLICHE_REGELN: Jahrgang und Semester stimmen mit allen Kursen überein).
    const inconsistent = addCourse(sqlite, "TIF25B", { studyStart: "2025-10-01", studyEnd: "2028-09-30" });
    sqlite.prepare("UPDATE courses SET block_plan_id = ? WHERE id = ?").run(blockPlanId, inconsistent);
    addCourse(sqlite, "TIF24B");

    expect(listAttachableCourses(sqlite, blockPlanId)).toEqual([]);
  });
});

