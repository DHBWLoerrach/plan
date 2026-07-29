import Database from "better-sqlite3";

import type { EventCategory } from "@/lib/domain/event-category";
import type { PhaseType } from "@/lib/domain/phase-type";
import { applySchema } from "@/test/schema";

export function databaseWithMasterData() {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
  sqlite.exec(`INSERT INTO areas VALUES ('area-1', 'Technik', 'technik'); INSERT INTO areas VALUES ('area-2', 'Wirtschaft', 'wirtschaft');
    INSERT INTO programs VALUES ('program-1', 'area-1', 'Informatik', 'TIF', 6); INSERT INTO programs VALUES ('program-2', 'area-2', 'BWL', 'WWI', 6);
    INSERT INTO user VALUES ('seed', 'Seed', 'seed@test', 0, NULL, 'NONE', 1, 'ACTIVE', 0, 0);`);
  return sqlite;
}

type PhaseInput = { semester: number; type?: PhaseType; startDate: string; endDate: string };
export type PublishedCourseInput = { code: string; program?: string; studyStart: string; studyEnd?: string; semesters?: number; phases?: PhaseInput[] };
type EventInput = { title: string; description?: string | null; category?: EventCategory; startDate: string; endDate?: string | null; provisional?: boolean; courses?: string[] };
type PublicationInput = { id?: string; area?: string; areaId?: string; courses: PublishedCourseInput[]; events?: EventInput[] };

/** Inserts independent, published course snapshots. A test helper may publish several courses, but no production row groups them. */
export function publish(sqlite: Database.Database, publication: PublicationInput) {
  for (const course of publication.courses) {
    const courseId = `course-${publication.id ?? "published"}-${course.code}`;
    const publishedId = `published-${publication.id ?? "published"}-${course.code}`;
    const year = Number(course.studyStart.slice(0, 4));
    sqlite.prepare(`INSERT OR IGNORE INTO courses (id, program_id, code, normalized_code, study_start, study_end, has_ever_been_published, draft_updated_at, draft_updated_by_account_id)
      VALUES (?, ?, ?, ?, ?, ?, 1, '2026-01-01T00:00:00.000Z', 'seed')`).run(courseId, publication.areaId === "area-2" ? "program-2" : "program-1", `${course.code}-source`, `${course.code}-source`.toLowerCase(), course.studyStart, course.studyEnd ?? `${year + 3}-09-30`);
    sqlite.prepare(`INSERT INTO published_courses (id, course_id, published_at, area_name, program_name, program_abbreviation, code, study_start, study_end, semesters)
      VALUES (?, ?, '2026-01-01T00:00:00.000Z', ?, ?, 'TIF', ?, ?, ?, ?)`).run(publishedId, courseId, publication.area ?? "Technik", course.program ?? "Informatik", course.code, course.studyStart, course.studyEnd ?? `${year + 3}-09-30`, course.semesters ?? 6);
    sqlite.prepare("INSERT INTO published_course_search_keys VALUES (?, ?)").run(publishedId, course.code.toLocaleLowerCase("de-DE"));
    for (const [index, phase] of (course.phases ?? []).entries()) sqlite.prepare("INSERT INTO published_phases VALUES (?, ?, ?, ?, ?, ?)")
      .run(`phase-${publishedId}-${index}`, publishedId, phase.semester, phase.type ?? "THEORY", phase.startDate, phase.endDate);
  }
  for (const [index, event] of (publication.events ?? []).entries()) {
    for (const code of event.courses ?? publication.courses.map((course) => course.code)) {
      const publishedId = `published-${publication.id ?? "published"}-${code}`;
      sqlite.prepare("INSERT INTO published_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(`event-${publication.id ?? "published"}-${index}-${code}`, publishedId, event.title, event.description ?? null, event.category ?? "EXAM", event.startDate, event.endDate ?? null, event.provisional ? 1 : 0);
    }
  }
}

export function snapshotId(code: string) { return `published-${code.includes("24") ? "tif24a" : "published"}-${code}`; }
export function draftOnlyCourse(sqlite: Database.Database, code: string) {
  sqlite.prepare(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, has_ever_been_published, draft_updated_at, draft_updated_by_account_id) VALUES (?, 'program-2', ?, ?, '2099-10-01', '2102-09-30', 0, '2026-01-01T00:00:00.000Z', 'seed')`)
    .run(`course-draft-${code}`, code, code.toLocaleLowerCase("de-DE"));
}
export function withdraw(sqlite: Database.Database, versionId: string) { sqlite.prepare("DELETE FROM published_courses WHERE id LIKE ?").run(`published-${versionId}-%`); }
