import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { deleteCourse, updateCourse } from "@/lib/services/course-admin";
import { deleteCourseEvents, deleteCoursePhases, updateCourseEvents, updateCoursePhases } from "@/lib/services/cut-editor";
import { createCourseEvent } from "@/lib/services/event-admin";
import { createCoursePhases } from "@/lib/services/phase-admin";
import { publishCourse, withdrawCourse } from "@/lib/services/publication";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];
const refused = /nicht zur Bearbeitung/u;

/**
 * Reading is system wide since ADR 0011, writing is not. The editor is assigned to Technik alone, so every write
 * against `course-wwi` crosses an area boundary and every one of them has to be refused in the domain logic.
 */
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-technik', 'Technik', 'technik'), ('area-wirtschaft', 'Wirtschaft', 'wirtschaft');
    INSERT INTO programs VALUES ('prog-tif', 'area-technik', 'Informatik', 'TIF', 6), ('prog-wwi', 'area-wirtschaft', 'Wirtschaftsinformatik', 'WWI', 6);
    INSERT INTO users VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO users VALUES ('admin', 'Admin', 'admin@test', 0, NULL, 'NONE', 1, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area-technik');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
      ('course-tif', 'prog-tif', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'admin'),
      ('course-wwi', 'prog-wwi', 'WWI26A', 'wwi26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'admin');`);
  return sqlite;
}

const phase = { semester: "1", type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" };
const event = { title: "Prüfung", description: "", category: "EXAM", startDate: "2026-12-01", endDate: "", provisional: false };

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("course phases of a foreign area", () => {
  it("refuses creation, change and deletion", () => {
    const sqlite = database();
    expect(() => createCoursePhases(sqlite, { accountId: "editor", courseIds: ["course-wwi"], ...phase })).toThrow(refused);
    const [phaseId] = createCoursePhases(sqlite, { accountId: "admin", courseIds: ["course-wwi"], ...phase });
    expect(() => updateCoursePhases(sqlite, { accountId: "editor", phaseIds: [phaseId], ...phase, type: "PRACTICE" })).toThrow(refused);
    expect(() => deleteCoursePhases(sqlite, { accountId: "editor", phaseIds: [phaseId] })).toThrow(refused);
    expect(sqlite.prepare("SELECT phase_type AS type FROM course_phases WHERE id = ?").get(phaseId)).toEqual({ type: "THEORY" });
  });

  it("refuses a joint creation as a whole and leaves the own course untouched", () => {
    const sqlite = database();
    expect(() => createCoursePhases(sqlite, { accountId: "editor", courseIds: ["course-tif", "course-wwi"], ...phase })).toThrow(refused);
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
  });

  it("refuses a joint change over a summarised row that reaches into a foreign area", () => {
    const sqlite = database();
    const [ownPhaseId] = createCoursePhases(sqlite, { accountId: "editor", courseIds: ["course-tif"], ...phase });
    const [foreignPhaseId] = createCoursePhases(sqlite, { accountId: "admin", courseIds: ["course-wwi"], ...phase });
    expect(() => updateCoursePhases(sqlite, { accountId: "editor", phaseIds: [ownPhaseId, foreignPhaseId], ...phase, type: "PRACTICE" })).toThrow(refused);
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases WHERE phase_type = 'PRACTICE'").get()).toEqual({ count: 0 });
  });
});

describe("events of a foreign area", () => {
  it("refuses creation, change and deletion", () => {
    const sqlite = database();
    expect(() => createCourseEvent(sqlite, { accountId: "editor", courseIds: ["course-wwi"], ...event })).toThrow(refused);
    const [eventId] = createCourseEvent(sqlite, { accountId: "admin", courseIds: ["course-wwi"], ...event });
    expect(() => updateCourseEvents(sqlite, { accountId: "editor", eventIds: [eventId], ...event, title: "Nachholprüfung" })).toThrow(refused);
    expect(() => deleteCourseEvents(sqlite, { accountId: "editor", eventIds: [eventId] })).toThrow(refused);
    expect(sqlite.prepare("SELECT title FROM course_events WHERE id = ?").get(eventId)).toEqual({ title: "Prüfung" });
  });
});

describe("course administration of a foreign area", () => {
  it("refuses changing and deleting a foreign course", () => {
    const sqlite = database();
    const details = { code: "WWI26A", programId: "prog-wwi", studyStart: "2026-10-01", studyEnd: "2029-09-30" };
    expect(() => updateCourse(sqlite, { accountId: "editor", courseId: "course-wwi", ...details })).toThrow(refused);
    expect(() => deleteCourse(sqlite, { accountId: "editor", courseId: "course-wwi" })).toThrow(refused);
    expect(sqlite.prepare("SELECT count(*) AS count FROM courses WHERE id = 'course-wwi'").get()).toEqual({ count: 1 });
  });

  it("refuses moving an own course into the study program of a foreign area", () => {
    const sqlite = database();
    expect(() => updateCourse(sqlite, { accountId: "editor", courseId: "course-tif", code: "TIF26A", programId: "prog-wwi", studyStart: "2026-10-01", studyEnd: "2029-09-30" })).toThrow(refused);
    expect(sqlite.prepare("SELECT program_id AS programId FROM courses WHERE id = 'course-tif'").get()).toEqual({ programId: "prog-tif" });
  });
});

describe("publication of a foreign area", () => {
  it("refuses publishing and withdrawing before it even looks at the planning state", () => {
    const sqlite = database();
    expect(() => publishCourse(sqlite, { accountId: "editor", courseId: "course-wwi", seenUpdatedAt: "2026-01-01T00:00:00.000Z", seenPublishedAt: null })).toThrow(refused);
    expect(() => withdrawCourse(sqlite, { accountId: "editor", courseId: "course-wwi", seenPublishedAt: "irgendeine" })).toThrow(refused);
    expect(sqlite.prepare("SELECT published_at FROM courses WHERE id = 'course-wwi'").pluck().get()).toBeNull();
  });
});
