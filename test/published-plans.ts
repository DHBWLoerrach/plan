import Database from "better-sqlite3";

import type { EventCategory } from "@/lib/domain/event-category";
import type { PhaseType } from "@/lib/domain/phase-type";
import { applySchema } from "@/test/schema";

export function databaseWithMasterData() {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
  sqlite.exec(`INSERT INTO areas VALUES ('area-1', 'Technik', 'technik'); INSERT INTO areas VALUES ('area-2', 'Wirtschaft', 'wirtschaft');
    INSERT INTO programs VALUES ('program-1', 'area-1', 'Informatik', 'TIF', 6); INSERT INTO programs VALUES ('program-2', 'area-2', 'BWL', 'WWI', 6);
    INSERT INTO users VALUES ('seed', 'Seed', 'seed@test', 0, NULL, 'NONE', 1, 'ACTIVE', 0, 0);`);
  return sqlite;
}

type PhaseInput = { semester: number; type?: PhaseType; startDate: string; endDate: string };
export type CourseInput = { code: string; program?: string; studyStart: string; studyEnd?: string; semesters?: number; phases?: PhaseInput[] };
type EventInput = { title: string; description?: string | null; category?: EventCategory; startDate: string; endDate?: string | null; provisional?: boolean; courses?: string[] };
type PublicationInput = { id?: string; area?: string; areaId?: string; courses: CourseInput[]; events?: EventInput[] };

/** Inserts current course rows and marks them as published; no separate publication records exist. */
export function publish(sqlite: Database.Database, publication: PublicationInput) {
  for (const course of publication.courses) {
    const courseId = `course-${publication.id ?? "published"}-${course.code}`;
    const year = Number(course.studyStart.slice(0, 4));
    sqlite.prepare(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
      VALUES (?, ?, ?, ?, ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'seed')`)
      .run(courseId, publication.areaId === "area-2" ? "program-2" : "program-1", course.code, course.code.toLocaleLowerCase("de-DE"), course.studyStart, course.studyEnd ?? `${year + 3}-09-30`);
    for (const [index, phase] of (course.phases ?? []).entries()) {
      sqlite.prepare("INSERT INTO course_phases VALUES (?, ?, ?, ?, ?, ?)")
        .run(`phase-${courseId}-${index}`, courseId, phase.semester, phase.type ?? "THEORY", phase.startDate, phase.endDate);
    }
  }
  for (const [index, event] of (publication.events ?? []).entries()) {
    for (const code of event.courses ?? publication.courses.map((course) => course.code)) {
      const courseId = `course-${publication.id ?? "published"}-${code}`;
      sqlite.prepare("INSERT INTO course_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(`event-${publication.id ?? "published"}-${index}-${code}`, courseId, event.title, event.description ?? null, event.category ?? "EXAM", event.startDate, event.endDate ?? null, event.provisional ? 1 : 0);
    }
  }
}

export function courseIdForCode(code: string) { return `course-${code.includes("24") ? "tif24a" : "published"}-${code}`; }
export function unpublishedCourse(sqlite: Database.Database, code: string) {
  sqlite.prepare(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
    VALUES (?, 'program-2', ?, ?, '2099-10-01', '2102-09-30', NULL, '2026-01-01T00:00:00.000Z', 'seed')`)
    .run(`course-unpublished-${code}`, code, code.toLocaleLowerCase("de-DE"));
}
export function withdraw(sqlite: Database.Database, publicationId: string) {
  sqlite.prepare("UPDATE courses SET published_at = NULL WHERE id LIKE ?").run(`course-${publicationId}-%`);
}
