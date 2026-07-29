import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { applySchemaThrough } from "@/test/schema";

describe("0004_course_as_planning_unit", () => {
  it("moves a published legacy plan losslessly onto independent courses", async () => {
    const sqlite = new Database(":memory:");
    applySchemaThrough(sqlite, "0003_unique_published_course_code");
    sqlite.exec(`INSERT INTO areas VALUES ('area', 'Technik', 'technik'); INSERT INTO programs VALUES ('program', 'area', 'Informatik', 'TIF', 6);
      INSERT INTO user VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
      INSERT INTO block_plans VALUES ('plan', 'area', NULL, NULL, 1, '2026-01-01T00:00:00.000Z', 'editor');
      INSERT INTO courses VALUES ('course', 'program', 'plan', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30');
      INSERT INTO draft_phases VALUES ('phase', 'plan', 'course', 1, 'THEORY', '2026-10-01', '2027-03-31');
      INSERT INTO draft_events VALUES ('event', 'plan', 'Prüfung', NULL, 'EXAM', '2026-12-01', NULL, 0); INSERT INTO draft_event_courses VALUES ('event', 'course');
      INSERT INTO published_versions VALUES ('version', 'plan', '2026-02-01T00:00:00.000Z', '2026 · TIF26A', 'Technik');
      INSERT INTO published_course_snapshots VALUES ('snapshot', 'version', 'course', 'TIF26A', 'Informatik', 'TIF', '2026-10-01', '2029-09-30', 6);
      INSERT INTO published_course_search_keys VALUES ('snapshot', 'tif26a');
      INSERT INTO published_phases VALUES ('published-phase', 'version', 'snapshot', 1, 'THEORY', '2026-10-01', '2027-03-31');
      INSERT INTO published_events VALUES ('published-event', 'version', 'Prüfung', NULL, 'EXAM', '2026-12-01', NULL, 0); INSERT INTO published_event_courses VALUES ('published-event', 'snapshot');`);
    const migration = await import("node:fs").then(({ readFileSync }) => readFileSync("migrations/0004_course_as_planning_unit.sql", "utf8"));
    sqlite.exec(migration);
    expect(sqlite.prepare("SELECT has_ever_been_published AS published, draft_updated_by_account_id AS editor FROM courses WHERE id = 'course'").get()).toEqual({ published: 1, editor: "editor" });
    expect(sqlite.prepare("SELECT course_id AS courseId FROM course_phases").all()).toEqual([{ courseId: "course" }]);
    expect(sqlite.prepare("SELECT course_id AS courseId FROM course_events").all()).toEqual([{ courseId: "course" }]);
    expect(sqlite.prepare("SELECT course_id AS courseId, code FROM published_courses").all()).toEqual([{ courseId: "course", code: "TIF26A" }]);
    expect(() => sqlite.prepare("SELECT count(*) AS count FROM block_plans").get()).toThrow();
  });
});
