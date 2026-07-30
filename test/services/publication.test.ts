import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createCourse } from "@/lib/services/course-admin";
import { createDraftEvent } from "@/lib/services/event-admin";
import { createDraftPhases } from "@/lib/services/phase-admin";
import { StaleStateError, publishCourse, readPublicationPreview, withdrawCourse } from "@/lib/services/publication";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];
function database() {
  const sqlite = new Database(":memory:"); databases.push(sqlite); applySchema(sqlite);
  sqlite.exec(`INSERT INTO areas VALUES ('area', 'Technik', 'technik'); INSERT INTO programs VALUES ('program', 'area', 'Informatik', 'TIF', 6);
    INSERT INTO user VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0); INSERT INTO area_assignments VALUES ('editor', 'area');`);
  return sqlite;
}
function plannedCourse(sqlite: Database.Database, code: string) {
  const id = createCourse(sqlite, { accountId: "editor", code, programId: "program", studyStart: "2026-10-01", studyEnd: "2026-10-06" });
  for (let semester = 1; semester <= 6; semester += 1) {
    const day = `2026-10-0${semester}`;
    createDraftPhases(sqlite, { accountId: "editor", courseIds: [id], semester: String(semester), type: "THEORY", startDate: day, endDate: day });
  }
  return id;
}
/** Publishes the course from its own current preview, the way the editor does when nothing changed in between. */
function publishFromPreview(sqlite: Database.Database, courseId: string) {
  const preview = readPublicationPreview(sqlite, courseId)!;
  return publishCourse(sqlite, {
    courseId,
    accountId: "editor",
    seenDraftUpdatedAt: preview.course.draftUpdatedAt,
    seenPublishedCourseId: preview.course.publishedCourseId,
  });
}

/** A saved change by someone else, at a moment the preview above cannot already have seen. */
function changeDraft(sqlite: Database.Database, courseId: string, title: string, at: string) {
  createDraftEvent(sqlite, {
    accountId: "editor", courseIds: [courseId], title, description: "", category: "EXAM",
    startDate: "2026-10-03", endDate: "", provisional: false, now: new Date(at),
  });
}

afterEach(() => { for (const sqlite of databases.splice(0)) sqlite.close(); });

describe("course publication", () => {
  it("publishes only the selected course and leaves a different incomplete course irrelevant", () => {
    const sqlite = database();
    const publishable = plannedCourse(sqlite, "TIF26A");
    const incomplete = createCourse(sqlite, { accountId: "editor", code: "TIF26B", programId: "program", studyStart: "2026-10-01", studyEnd: "2026-10-06" });
    const preview = readPublicationPreview(sqlite, publishable)!;
    const publication = publishCourse(sqlite, { courseId: publishable, accountId: "editor", seenDraftUpdatedAt: preview.course.draftUpdatedAt, seenPublishedCourseId: null });
    expect(sqlite.prepare("SELECT course_id AS courseId FROM published_courses").all()).toEqual([{ courseId: publishable }]);
    expect(readPublicationPreview(sqlite, incomplete)?.issues).not.toEqual([]);
    withdrawCourse(sqlite, { courseId: publishable, accountId: "editor", seenPublishedCourseId: publication.id });
    expect(sqlite.prepare("SELECT has_ever_been_published AS value FROM courses WHERE id = ?").get(publishable)).toEqual({ value: 1 });
  });

  it("rejects a code retained by another published snapshot after that course was renamed", () => {
    const sqlite = database();
    const first = plannedCourse(sqlite, "TIF26A");
    const firstPreview = readPublicationPreview(sqlite, first)!;
    publishCourse(sqlite, { courseId: first, accountId: "editor", seenDraftUpdatedAt: firstPreview.course.draftUpdatedAt, seenPublishedCourseId: null });
    sqlite.prepare("UPDATE courses SET code = 'TIF26X', normalized_code = 'tif26x' WHERE id = ?").run(first);
    const second = plannedCourse(sqlite, "TIF26A");
    expect(readPublicationPreview(sqlite, second)?.issues).toContainEqual(expect.objectContaining({ code: "course-code-published-elsewhere" }));
  });

  it("refuses a course whose planning state does not pass the release check", () => {
    const sqlite = database();
    const incomplete = createCourse(sqlite, { accountId: "editor", code: "TIF26A", programId: "program", studyStart: "2026-10-01", studyEnd: "2026-10-06" });
    const preview = readPublicationPreview(sqlite, incomplete)!;

    expect(() => publishCourse(sqlite, { courseId: incomplete, accountId: "editor", seenDraftUpdatedAt: preview.course.draftUpdatedAt, seenPublishedCourseId: null }))
      .toThrow(/Verlauf von TIF26A/u);
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_courses").get()).toEqual({ count: 0 });
  });

  it("copies events into the course-owned public snapshot", () => {
    const sqlite = database(); const id = plannedCourse(sqlite, "TIF26A");
    createDraftEvent(sqlite, { accountId: "editor", courseIds: [id], title: "Prüfung", description: "", category: "EXAM", startDate: "2026-10-03", endDate: "", provisional: false });
    const preview = readPublicationPreview(sqlite, id)!;
    publishCourse(sqlite, { courseId: id, accountId: "editor", seenDraftUpdatedAt: preview.course.draftUpdatedAt, seenPublishedCourseId: null });
    expect(sqlite.prepare("SELECT title FROM published_events").all()).toEqual([{ title: "Prüfung" }]);
  });
});

describe("republishing a course", () => {
  it("replaces the previous version instead of adding a second one", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    const first = publishFromPreview(sqlite, id);
    changeDraft(sqlite, id, "Nachholprüfung", "2026-07-01T00:00:00.000Z");

    const second = publishFromPreview(sqlite, id);

    expect(second.id).not.toBe(first.id);
    expect(sqlite.prepare("SELECT id FROM published_courses").pluck().all()).toEqual([second.id]);
    // The phases and the search key of the replaced version go with it, or the next release would collide with them.
    expect(sqlite.prepare("SELECT DISTINCT published_course_id AS id FROM published_phases").pluck().all()).toEqual([second.id]);
    expect(sqlite.prepare("SELECT published_course_id AS id FROM published_course_search_keys").pluck().all()).toEqual([second.id]);
  });

  it("publishes the planning state as it stands now, not the one of the first release", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    publishFromPreview(sqlite, id);
    changeDraft(sqlite, id, "Nachholprüfung", "2026-07-01T00:00:00.000Z");

    publishFromPreview(sqlite, id);

    expect(sqlite.prepare("SELECT title FROM published_events").pluck().all()).toEqual(["Nachholprüfung"]);
  });

  it("keeps the planning state itself untouched by the release", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    changeDraft(sqlite, id, "Prüfung", "2026-07-01T00:00:00.000Z");
    const before = readPublicationPreview(sqlite, id)!;

    publishFromPreview(sqlite, id);

    const after = readPublicationPreview(sqlite, id)!;
    expect(after.phases).toEqual(before.phases);
    expect(after.events).toEqual(before.events);
    expect(after.course.draftUpdatedAt).toBe(before.course.draftUpdatedAt);
  });
});

/**
 * The release carries what the editor saw in its preview, and is refused when that no longer holds — the change
 * warning of ADR 0004, which stands in for a version counter. Granular saves stay last-write-wins (ADR 0007).
 */
describe("change warning of the release", () => {
  it("refuses a release whose preview predates a saved change", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    const preview = readPublicationPreview(sqlite, id)!;
    changeDraft(sqlite, id, "Prüfung", "2026-07-01T00:00:00.000Z");

    expect(() => publishCourse(sqlite, { courseId: id, accountId: "editor", seenDraftUpdatedAt: preview.course.draftUpdatedAt, seenPublishedCourseId: null }))
      .toThrow(StaleStateError);
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_courses").get()).toEqual({ count: 0 });
  });

  it("refuses a release whose preview does not know about the version already published", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    const published = publishFromPreview(sqlite, id);
    const seenDraftUpdatedAt = readPublicationPreview(sqlite, id)!.course.draftUpdatedAt;

    // Nothing changed about the planning state; the page just still shows the course as unpublished.
    expect(() => publishCourse(sqlite, { courseId: id, accountId: "editor", seenDraftUpdatedAt, seenPublishedCourseId: null }))
      .toThrow(StaleStateError);
    expect(sqlite.prepare("SELECT id FROM published_courses").pluck().all()).toEqual([published.id]);
  });

  it("refuses a withdrawal aimed at a version that is no longer the current one", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    const first = publishFromPreview(sqlite, id);
    changeDraft(sqlite, id, "Nachholprüfung", "2026-07-01T00:00:00.000Z");
    publishFromPreview(sqlite, id);

    expect(() => withdrawCourse(sqlite, { courseId: id, accountId: "editor", seenPublishedCourseId: first.id }))
      .toThrow(StaleStateError);
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_courses").get()).toEqual({ count: 1 });
  });

  it("refuses a withdrawal of a course that has nothing published", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");

    expect(() => withdrawCourse(sqlite, { courseId: id, accountId: "editor", seenPublishedCourseId: "eine-fassung" }))
      .toThrow(StaleStateError);
  });

  it("takes the whole version out of public reach on a withdrawal", () => {
    const sqlite = database();
    const id = plannedCourse(sqlite, "TIF26A");
    changeDraft(sqlite, id, "Prüfung", "2026-07-01T00:00:00.000Z");
    const published = publishFromPreview(sqlite, id);

    withdrawCourse(sqlite, { courseId: id, accountId: "editor", seenPublishedCourseId: published.id });

    for (const table of ["published_courses", "published_phases", "published_events", "published_course_search_keys"]) {
      expect(sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
    // The planning state survives it and can be released again (ADR 0008).
    expect(readPublicationPreview(sqlite, id)?.issues).toEqual([]);
    expect(publishFromPreview(sqlite, id).courseCode).toBe("TIF26A");
  });
});
