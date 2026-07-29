import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { assertCourseEditPermission, assertCoursesEditPermission } from "@/lib/services/authorization";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

/** Two areas with one study program each, and one course in the program of either area. */
function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  const addArea = sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)");
  addArea.run("area-technik", "Technik", "technik");
  addArea.run("area-wirtschaft", "Wirtschaft", "wirtschaft");
  const addProgram = sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)");
  addProgram.run("prog-tif", "area-technik", "Informatik", "TIF", 6);
  addProgram.run("prog-wwi", "area-wirtschaft", "Wirtschaftsinformatik", "WWI", 6);
  const addCourse = sqlite.prepare("INSERT INTO courses (id, program_id, block_plan_id, code, normalized_code, study_start, study_end) VALUES (?, ?, NULL, ?, ?, ?, ?)");
  addCourse.run("course-tif", "prog-tif", "TIF26A", "tif26a", "2026-10-01", "2029-09-30");
  addCourse.run("course-wwi", "prog-wwi", "WWI26A", "wwi26a", "2026-10-01", "2029-09-30");
  return sqlite;
}

function insertAccount(sqlite: Database.Database, id: string, account: { role: string; systemAdmin: number; status: string; areaIds?: string[] }) {
  sqlite.prepare(`INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`).run(id, id, `${id}@example.test`, account.role, account.systemAdmin, account.status, Date.now(), Date.now());
  for (const areaId of account.areaIds ?? []) sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run(id, areaId);
}

function insertEditor(sqlite: Database.Database, id: string, areaIds: string[]) {
  insertAccount(sqlite, id, { role: "AREA_EDITOR", systemAdmin: 0, status: "ACTIVE", areaIds });
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("assertCourseEditPermission", () => {
  it("takes the deciding area from the study program of the course", () => {
    const sqlite = createDatabase();
    insertEditor(sqlite, "editor-technik", ["area-technik"]);
    insertEditor(sqlite, "editor-wirtschaft", ["area-wirtschaft"]);

    expect(() => assertCourseEditPermission(sqlite, "editor-technik", "course-tif")).not.toThrow();
    // Assigned to an area, but not to the one the course belongs to — no block plan is involved in that answer.
    expect(() => assertCourseEditPermission(sqlite, "editor-wirtschaft", "course-tif")).toThrow("nicht zur Bearbeitung dieses Bereichs berechtigt");
  });

  it("lets system administration edit in every area", () => {
    const sqlite = createDatabase();
    insertAccount(sqlite, "admin", { role: "NONE", systemAdmin: 1, status: "ACTIVE" });

    expect(() => assertCourseEditPermission(sqlite, "admin", "course-tif")).not.toThrow();
    expect(() => assertCourseEditPermission(sqlite, "admin", "course-wwi")).not.toThrow();
  });

  it("refuses an account that is not active, whatever its role and assignment", () => {
    const sqlite = createDatabase();
    insertAccount(sqlite, "pending", { role: "AREA_EDITOR", systemAdmin: 0, status: "PASSWORD_PENDING", areaIds: ["area-technik"] });
    insertAccount(sqlite, "locked", { role: "AREA_EDITOR", systemAdmin: 1, status: "LOCKED", areaIds: ["area-technik"] });

    expect(() => assertCourseEditPermission(sqlite, "pending", "course-tif")).toThrow("nicht zur Bearbeitung berechtigt");
    expect(() => assertCourseEditPermission(sqlite, "locked", "course-tif")).toThrow("nicht zur Bearbeitung berechtigt");
  });

  it("refuses a course it cannot find rather than letting the write pass", () => {
    const sqlite = createDatabase();
    insertAccount(sqlite, "admin", { role: "NONE", systemAdmin: 1, status: "ACTIVE" });

    // Not even system administration gets through: without a course there is no area the write belongs to.
    expect(() => assertCourseEditPermission(sqlite, "admin", "course-unbekannt")).toThrow("nicht zur Bearbeitung berechtigt");
  });
});

describe("assertCoursesEditPermission", () => {
  it("asks every course of a joint operation, not just the first", () => {
    const sqlite = createDatabase();
    insertEditor(sqlite, "editor-technik", ["area-technik"]);

    expect(() => assertCoursesEditPermission(sqlite, "editor-technik", ["course-tif"])).not.toThrow();
    expect(() => assertCoursesEditPermission(sqlite, "editor-technik", ["course-tif", "course-wwi"])).toThrow("nicht zur Bearbeitung dieses Bereichs berechtigt");
  });

  it("refuses an empty selection instead of passing an empty round of questions for consent", () => {
    const sqlite = createDatabase();
    insertAccount(sqlite, "admin", { role: "NONE", systemAdmin: 1, status: "ACTIVE" });

    expect(() => assertCoursesEditPermission(sqlite, "admin", [])).toThrow("nicht zur Bearbeitung berechtigt");
  });
});
