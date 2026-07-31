import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createCourse } from "@/lib/services/course-admin";
import { createCourseEvent } from "@/lib/services/event-admin";
import { createCoursePhases } from "@/lib/services/phase-admin";
import { StaleStateError, publishCourse, readPublicationPreview, withdrawCourse } from "@/lib/services/publication";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.exec(`INSERT INTO areas VALUES ('area', 'Technik', 'technik'); INSERT INTO programs VALUES ('program', 'area', 'Informatik', 'TIF', 6);
    INSERT INTO user VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0); INSERT INTO area_assignments VALUES ('editor', 'area');`);
  return sqlite;
}

function plannedCourse(sqlite: Database.Database, code: string) {
  const id = createCourse(sqlite, { accountId: "editor", code, programId: "program", studyStart: "2026-10-01", studyEnd: "2026-10-06" });
  for (let semester = 1; semester <= 6; semester += 1) {
    const day = `2026-10-0${semester}`;
    createCoursePhases(sqlite, { accountId: "editor", courseIds: [id], semester: String(semester), type: "THEORY", startDate: day, endDate: day });
  }
  return id;
}

function publishFromPreview(sqlite: Database.Database, courseId: string) {
  const preview = readPublicationPreview(sqlite, courseId)!;
  publishCourse(sqlite, { courseId, accountId: "editor", seenUpdatedAt: preview.course.updatedAt, seenPublishedAt: preview.course.publishedAt });
  return sqlite.prepare("SELECT published_at FROM courses WHERE id = ?").pluck().get(courseId) as string;
}

afterEach(() => { for (const sqlite of databases.splice(0)) sqlite.close(); });

describe("course publication", () => {
  it("publishes only the selected course and leaves a different incomplete course irrelevant", () => {
    const sqlite = database();
    const publishable = plannedCourse(sqlite, "TIF26A");
    const incomplete = createCourse(sqlite, { accountId: "editor", code: "TIF26B", programId: "program", studyStart: "2026-10-01", studyEnd: "2026-10-06" });

    publishFromPreview(sqlite, publishable);

    expect(sqlite.prepare("SELECT published_at IS NOT NULL AS published FROM courses WHERE id = ?").pluck().get(publishable)).toBe(1);
    expect(sqlite.prepare("SELECT published_at FROM courses WHERE id = ?").pluck().get(incomplete)).toBeNull();
    expect(readPublicationPreview(sqlite, incomplete)?.issues).not.toEqual([]);
  });

  it("refuses a course whose current data does not pass the publication check", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { accountId: "editor", code: "TIF26A", programId: "program", studyStart: "2026-10-01", studyEnd: "2026-10-06" });
    const preview = readPublicationPreview(sqlite, id)!;

    expect(() => publishCourse(sqlite, { courseId: id, accountId: "editor", seenUpdatedAt: preview.course.updatedAt, seenPublishedAt: null }))
      .toThrow(/Verlauf von TIF26A/u);
    expect(sqlite.prepare("SELECT published_at FROM courses WHERE id = ?").pluck().get(id)).toBeNull();
  });

  it("keeps current phases and events in place instead of copying them", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    createCourseEvent(sqlite, { accountId: "editor", courseIds: [id], title: "Prüfung", description: "", category: "EXAM", startDate: "2026-10-03", endDate: "", provisional: false });
    const phaseIds = sqlite.prepare("SELECT id FROM course_phases WHERE course_id = ? ORDER BY id").pluck().all(id);
    const eventIds = sqlite.prepare("SELECT id FROM course_events WHERE course_id = ? ORDER BY id").pluck().all(id);

    publishFromPreview(sqlite, id);

    expect(sqlite.prepare("SELECT id FROM course_phases WHERE course_id = ? ORDER BY id").pluck().all(id)).toEqual(phaseIds);
    expect(sqlite.prepare("SELECT id FROM course_events WHERE course_id = ? ORDER BY id").pluck().all(id)).toEqual(eventIds);
  });

  it("refuses a publication whose preview predates a saved change", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    const preview = readPublicationPreview(sqlite, id)!;
    createCourseEvent(sqlite, { accountId: "editor", courseIds: [id], title: "Prüfung", description: "", category: "EXAM", startDate: "2026-10-03", endDate: "", provisional: false, now: new Date("2027-01-01") });

    expect(() => publishCourse(sqlite, { courseId: id, accountId: "editor", seenUpdatedAt: preview.course.updatedAt, seenPublishedAt: null }))
      .toThrow(StaleStateError);
    expect(sqlite.prepare("SELECT published_at FROM courses WHERE id = ?").pluck().get(id)).toBeNull();
  });

  it("refuses a second publication from a preview that still showed the course as unpublished", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    const preview = readPublicationPreview(sqlite, id)!;
    publishFromPreview(sqlite, id);

    expect(() => publishCourse(sqlite, { courseId: id, accountId: "editor", seenUpdatedAt: preview.course.updatedAt, seenPublishedAt: null }))
      .toThrow(StaleStateError);
  });
});

describe("withdrawal", () => {
  it("refuses a stale or absent publication timestamp", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    publishFromPreview(sqlite, id);

    expect(() => withdrawCourse(sqlite, { courseId: id, accountId: "editor", seenPublishedAt: "2020-01-01T00:00:00.000Z" }))
      .toThrow(StaleStateError);
    expect(sqlite.prepare("SELECT published_at FROM courses WHERE id = ?").pluck().get(id)).not.toBeNull();
  });

  it("only clears visibility and allows the unchanged course to be published again", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    const publishedAt = publishFromPreview(sqlite, id);
    const phasesBefore = sqlite.prepare("SELECT * FROM course_phases WHERE course_id = ? ORDER BY id").all(id);

    withdrawCourse(sqlite, { courseId: id, accountId: "editor", seenPublishedAt: publishedAt });

    expect(sqlite.prepare("SELECT published_at FROM courses WHERE id = ?").pluck().get(id)).toBeNull();
    expect(sqlite.prepare("SELECT * FROM course_phases WHERE course_id = ? ORDER BY id").all(id)).toEqual(phasesBefore);
    expect(readPublicationPreview(sqlite, id)?.issues).toEqual([]);
    expect(publishFromPreview(sqlite, id)).toBeTruthy();
  });
});
