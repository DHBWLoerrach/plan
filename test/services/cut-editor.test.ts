import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { deleteCourseEvents, deleteCoursePhases, updateCourseEvents, updateCoursePhases } from "@/lib/services/cut-editor";
import { createCourseEvent } from "@/lib/services/event-admin";
import { createCoursePhases } from "@/lib/services/phase-admin";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];
function database() {
  const sqlite = new Database(":memory:"); databases.push(sqlite); applySchema(sqlite);
  sqlite.exec(`INSERT INTO areas VALUES ('area', 'Technik', 'technik'); INSERT INTO programs VALUES ('program', 'area', 'Informatik', 'TIF', 6);
    INSERT INTO user VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0); INSERT INTO area_assignments VALUES ('editor', 'area');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
      ('course-a', 'program', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
      ('course-b', 'program', 'TIF26B', 'tif26b', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);
  return sqlite;
}
afterEach(() => { for (const sqlite of databases.splice(0)) sqlite.close(); });

describe("course cuts", () => {
  it("creates independent phases and events for each selected course", () => {
    const sqlite = database();
    const phaseIds = createCoursePhases(sqlite, { accountId: "editor", courseIds: ["course-a", "course-b"], semester: "1", type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" });
    const eventIds = createCourseEvent(sqlite, { accountId: "editor", courseIds: ["course-a", "course-b"], title: "Prüfung", description: "", category: "EXAM", startDate: "2027-03-15", endDate: "", provisional: false });
    expect(sqlite.prepare("SELECT course_id AS courseId FROM course_phases ORDER BY course_id").all()).toEqual([{ courseId: "course-a" }, { courseId: "course-b" }]);
    expect(sqlite.prepare("SELECT course_id AS courseId FROM course_events ORDER BY course_id").all()).toEqual([{ courseId: "course-a" }, { courseId: "course-b" }]);
    updateCoursePhases(sqlite, { accountId: "editor", phaseIds, semester: "1", type: "PRACTICE", startDate: "2026-10-01", endDate: "2027-03-31" });
    updateCourseEvents(sqlite, { accountId: "editor", eventIds, title: "Nachholprüfung", description: "", category: "EXAM", startDate: "2027-03-16", endDate: "", provisional: true });
    deleteCoursePhases(sqlite, { accountId: "editor", phaseIds }); deleteCourseEvents(sqlite, { accountId: "editor", eventIds });
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_events").get()).toEqual({ count: 0 });
  });
});
