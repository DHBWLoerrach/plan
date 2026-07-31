import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createCourse, deleteCourse, updateCourse } from "@/lib/services/course-admin";
import { createCoursePhases } from "@/lib/services/phase-admin";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];
function database() {
  const sqlite = new Database(":memory:"); databases.push(sqlite); applySchema(sqlite);
  sqlite.exec(`INSERT INTO areas VALUES ('area', 'Technik', 'technik'); INSERT INTO programs VALUES ('program-6', 'area', 'Informatik', 'TIF', 6); INSERT INTO programs VALUES ('program-7', 'area', 'Informatik sieben', 'TIF7', 7);
    INSERT INTO user VALUES ('admin', 'admin', 'admin@test', 0, NULL, 'NONE', 1, 'ACTIVE', 0, 0);`);
  return sqlite;
}
afterEach(() => { for (const sqlite of databases.splice(0)) sqlite.close(); });

describe("courses", () => {
  it("stores its own change metadata and no block-plan assignment", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { accountId: "admin", code: " TIF26A ", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
    expect(sqlite.prepare("SELECT code, published_at AS publishedAt, updated_by_account_id AS editor FROM courses WHERE id = ?").get(id)).toEqual({ code: "TIF26A", publishedAt: null, editor: "admin" });
    expect(sqlite.prepare("SELECT 1 FROM pragma_table_info('courses') WHERE name = 'block_plan_id'").get()).toBeUndefined();
  });

  it("rejects a study period or program that invalidates existing phases", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF26A", programId: "program-7", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
    createCoursePhases(sqlite, { accountId: "admin", courseIds: [id], semester: "7", type: "THEORY", startDate: "2029-01-01", endDate: "2029-09-30" });
    expect(() => updateCourse(sqlite, { accountId: "admin", courseId: id, code: "TIF26A", programId: "program-7", studyStart: "2026-10-01", studyEnd: "2029-06-30" })).toThrow("alle Kursphasen");
    expect(() => updateCourse(sqlite, { accountId: "admin", courseId: id, code: "TIF26A", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" })).toThrow("mindestens 7 Semester");
  });

  it("lets a course keep its own code while something else about it changes", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF26A", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" });

    // The uniqueness check has to exempt the course being saved, or no course could ever be edited twice.
    updateCourse(sqlite, { accountId: "admin", courseId: id, code: "tif26a", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-10-31" });

    expect(sqlite.prepare("SELECT code, study_end AS studyEnd FROM courses WHERE id = ?").get(id)).toEqual({ code: "tif26a", studyEnd: "2029-10-31" });
  });

  it("refuses a code another course already carries, whatever its spelling", () => {
    const sqlite = database();
    createCourse(sqlite, { accountId: "admin", code: "TIF26A", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
    const other = createCourse(sqlite, { accountId: "admin", code: "TIF26B", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" });

    expect(() => updateCourse(sqlite, { accountId: "admin", courseId: other, code: " tif26a ", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" }))
      .toThrow("bereits vergeben");
    expect(sqlite.prepare("SELECT code FROM courses WHERE id = ?").get(other)).toEqual({ code: "TIF26B" });
  });

  it("refuses to delete a course that is publicly visible", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF26A", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
    sqlite.prepare("UPDATE courses SET published_at = '2026-06-01T00:00:00.000Z' WHERE id = ?").run(id);

    expect(() => deleteCourse(sqlite, { accountId: "admin", courseId: id })).toThrow("zuerst zurück");
    expect(sqlite.prepare("SELECT count(*) AS count FROM courses WHERE id = ?").get(id)).toEqual({ count: 1 });
  });

  it("deletes dependent planning data when no public version exists", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF26A", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
    createCoursePhases(sqlite, { accountId: "admin", courseIds: [id], semester: "1", type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" });
    deleteCourse(sqlite, { accountId: "admin", courseId: id });
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
  });
});
