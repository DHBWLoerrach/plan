import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  createDraftEventsForCourses,
  createDraftPhasesForCourses,
  deleteDraftEvents,
  deleteDraftPhases,
  updateDraftEvents,
  updateDraftPhases,
} from "@/lib/services/cut-editor";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES ('area', 'Technik', 'technik')").run();
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES ('program', 'area', 'Informatik', 'TIF', 6)").run();
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES ('editor', 'Editor', 'editor@example.test', 0, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0)").run();
  sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES ('editor', 'area')").run();
  for (const planId of ["plan-a", "plan-b"]) {
    sqlite.prepare("INSERT INTO block_plans (id, area_id, draft_updated_at) VALUES (?, 'area', '2026-01-01T00:00:00.000Z')").run(planId);
  }
  for (const [id, planId, code] of [["course-a", "plan-a", "TIF26A"], ["course-b", "plan-b", "TIF26B"]] as const) {
    sqlite.prepare(`INSERT INTO courses (id, program_id, block_plan_id, code, normalized_code, study_start, study_end)
      VALUES (?, 'program', ?, ?, ?, '2026-10-01', '2029-09-30')`).run(id, planId, code, code.toLowerCase());
  }
  return sqlite;
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createDraftPhasesForCourses", () => {
  it("creates an independent phase for every selected course even when their technical block plans differ", () => {
    const sqlite = createDatabase();

    createDraftPhasesForCourses(sqlite, {
      accountId: "editor",
      courseIds: ["course-a", "course-b"],
      semester: "1",
      type: "THEORY",
      startDate: "2026-10-01",
      endDate: "2027-03-31",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(sqlite.prepare("SELECT course_id AS courseId, block_plan_id AS blockPlanId FROM draft_phases ORDER BY course_id").all()).toEqual([
      { courseId: "course-a", blockPlanId: "plan-a" },
      { courseId: "course-b", blockPlanId: "plan-b" },
    ]);
    expect(sqlite.prepare("SELECT id, draft_updated_at AS updatedAt FROM block_plans ORDER BY id").all()).toEqual([
      { id: "plan-a", updatedAt: "2030-01-01T00:00:00.000Z" },
      { id: "plan-b", updatedAt: "2030-01-01T00:00:00.000Z" },
    ]);
  });
});

describe("createDraftEventsForCourses", () => {
  it("stores one independent event per selected course", () => {
    const sqlite = createDatabase();

    createDraftEventsForCourses(sqlite, {
      accountId: "editor",
      courseIds: ["course-a", "course-b"],
      title: "Prüfung",
      description: "",
      category: "EXAM",
      startDate: "2027-03-15",
      endDate: "",
      provisional: false,
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(sqlite.prepare(`SELECT event.title, link.course_id AS courseId
      FROM draft_events event JOIN draft_event_courses link ON link.event_id = event.id
      ORDER BY link.course_id`).all()).toEqual([
      { title: "Prüfung", courseId: "course-a" },
      { title: "Prüfung", courseId: "course-b" },
    ]);
  });

  it("updates and deletes every independently stored event of a summarized row", () => {
    const sqlite = createDatabase();
    const eventIds = createDraftEventsForCourses(sqlite, {
      accountId: "editor", courseIds: ["course-a", "course-b"], title: "Prüfung", description: "", category: "EXAM", startDate: "2027-03-15", endDate: "", provisional: false,
    });

    updateDraftEvents(sqlite, { accountId: "editor", eventIds, title: "Nachholprüfung", description: "", category: "EXAM", startDate: "2027-03-16", endDate: "", provisional: true });
    expect(sqlite.prepare("SELECT title, provisional FROM draft_events ORDER BY id").all()).toEqual([
      { title: "Nachholprüfung", provisional: 1 }, { title: "Nachholprüfung", provisional: 1 },
    ]);

    deleteDraftEvents(sqlite, { accountId: "editor", eventIds });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_events").get()).toEqual({ count: 0 });
  });
});

describe("phase changes over a shared row", () => {
  it("updates and deletes every named course phase as one confirmed operation", () => {
    const sqlite = createDatabase();
    const phaseIds = createDraftPhasesForCourses(sqlite, {
      accountId: "editor", courseIds: ["course-a", "course-b"], semester: "1", type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31",
    });

    updateDraftPhases(sqlite, { accountId: "editor", phaseIds, semester: "1", type: "PRACTICE", startDate: "2026-10-01", endDate: "2027-03-31" });
    expect(sqlite.prepare("SELECT phase_type AS type FROM draft_phases ORDER BY course_id").all()).toEqual([{ type: "PRACTICE" }, { type: "PRACTICE" }]);

    deleteDraftPhases(sqlite, { accountId: "editor", phaseIds });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_phases").get()).toEqual({ count: 0 });
  });
});
