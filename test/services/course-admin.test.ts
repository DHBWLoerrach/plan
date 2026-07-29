import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createCourse, deleteCourse, updateCourse } from "@/lib/services/course-admin";
import { createDraftPhases } from "@/lib/services/phase-admin";
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
    expect(sqlite.prepare("SELECT code, has_ever_been_published AS published, draft_updated_by_account_id AS editor FROM courses WHERE id = ?").get(id)).toEqual({ code: "TIF26A", published: 0, editor: "admin" });
    expect(sqlite.prepare("SELECT 1 FROM pragma_table_info('courses') WHERE name = 'block_plan_id'").get()).toBeUndefined();
  });

  it("rejects a study period or program that invalidates existing phases", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF26A", programId: "program-7", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
    createDraftPhases(sqlite, { accountId: "admin", courseIds: [id], semester: "7", type: "THEORY", startDate: "2029-01-01", endDate: "2029-09-30" });
    expect(() => updateCourse(sqlite, { accountId: "admin", courseId: id, code: "TIF26A", programId: "program-7", studyStart: "2026-10-01", studyEnd: "2029-06-30" })).toThrow("alle Kursphasen");
    expect(() => updateCourse(sqlite, { accountId: "admin", courseId: id, code: "TIF26A", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" })).toThrow("mindestens 7 Semester");
  });

  it("deletes dependent planning data when no public version exists", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { accountId: "admin", code: "TIF26A", programId: "program-6", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
    createDraftPhases(sqlite, { accountId: "admin", courseIds: [id], semester: "1", type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" });
    deleteCourse(sqlite, { accountId: "admin", courseId: id });
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
  });
});
