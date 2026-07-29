import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createCourse } from "@/lib/services/course-admin";
import { createDraftEvent } from "@/lib/services/event-admin";
import { createDraftPhases } from "@/lib/services/phase-admin";
import { publishCourse, readPublicationPreview, withdrawCourse } from "@/lib/services/publication";
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

  it("copies events into the course-owned public snapshot", () => {
    const sqlite = database(); const id = plannedCourse(sqlite, "TIF26A");
    createDraftEvent(sqlite, { accountId: "editor", courseIds: [id], title: "Prüfung", description: "", category: "EXAM", startDate: "2026-10-03", endDate: "", provisional: false });
    const preview = readPublicationPreview(sqlite, id)!;
    publishCourse(sqlite, { courseId: id, accountId: "editor", seenDraftUpdatedAt: preview.course.draftUpdatedAt, seenPublishedCourseId: null });
    expect(sqlite.prepare("SELECT title FROM published_events").all()).toEqual([{ title: "Prüfung" }]);
  });
});
