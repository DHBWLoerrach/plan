import type Database from "better-sqlite3";

import { type CoursePlan, type CourseEvent, type CoursePhase, validatePublication } from "@/lib/domain/publication";
import { assertCourseEditPermission } from "@/lib/services/authorization";

type PublicationRequest = {
  courseId: string;
  accountId: string;
  seenUpdatedAt: string;
  seenPublishedAt: string | null;
};
type CourseRow = CoursePlan & { updatedAt: string; publishedAt: string | null };

export class StaleStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleStateError";
  }
}

function readCoursePlan(sqlite: Database.Database, courseId: string) {
  const course = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart,
      course.study_end AS studyEnd, program.semesters, course.updated_at AS updatedAt,
      course.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.id = ?`).get(courseId) as CourseRow | undefined;
  if (!course) return null;
  const phases = sqlite.prepare(`SELECT course_id AS courseId, semester, phase_type AS type,
      start_date AS startDate, end_date AS endDate FROM course_phases WHERE course_id = ?`)
    .all(courseId) as CoursePhase[];
  const events = sqlite.prepare(`SELECT id, title, description, category, start_date AS startDate,
      end_date AS endDate, provisional FROM course_events WHERE course_id = ?
      ORDER BY start_date, title COLLATE NOCASE`)
    .all(courseId) as Array<Omit<CourseEvent, "courseIds" | "provisional"> & { provisional: number }>;
  return {
    course,
    phases,
    events: events.map((event) => ({ ...event, provisional: Boolean(event.provisional), courseIds: [courseId] })),
  };
}

export function readPublicationPreview(sqlite: Database.Database, courseId: string) {
  const plan = readCoursePlan(sqlite, courseId);
  if (!plan) return null;
  const issues = validatePublication({ course: plan.course, phases: plan.phases, events: plan.events });
  return { ...plan, courses: [plan.course], issues };
}

/**
 * Published courses expose their current rows directly. Every mutation calls this inside its transaction so an
 * invalid intermediate state is rolled back before a public reader can observe it.
 */
export function assertPublishedCourseValid(sqlite: Database.Database, courseId: string): void {
  const plan = readCoursePlan(sqlite, courseId);
  if (!plan) throw new Error("Der Kurs wurde nicht gefunden.");
  if (!plan.course.publishedAt) return;
  const issues = validatePublication({ course: plan.course, phases: plan.phases, events: plan.events });
  if (issues.length) {
    throw new Error(`Die Änderung kann nicht unmittelbar veröffentlicht werden. ${issues.map((issue) => issue.message).join(" ")}`);
  }
}

export function publishCourse(sqlite: Database.Database, request: PublicationRequest): { courseCode: string } {
  return sqlite.transaction(() => {
    const preview = readPublicationPreview(sqlite, request.courseId);
    if (!preview) throw new Error("Der Kurs wurde nicht gefunden.");
    assertCourseEditPermission(sqlite, request.accountId, preview.course.id);
    if (preview.course.updatedAt !== request.seenUpdatedAt || preview.course.publishedAt !== request.seenPublishedAt) {
      throw new StaleStateError("Die Vorschau ist nicht mehr aktuell. Laden Sie den aktuellen Kurs erneut.");
    }
    if (preview.course.publishedAt) throw new Error("Der Kurs ist bereits veröffentlicht.");
    if (preview.issues.length) throw new Error(preview.issues.map((issue) => issue.message).join(" "));
    sqlite.prepare("UPDATE courses SET published_at = ? WHERE id = ?").run(new Date().toISOString(), preview.course.id);
    return { courseCode: preview.course.code };
  })();
}

export function withdrawCourse(
  sqlite: Database.Database,
  request: { courseId: string; accountId: string; seenPublishedAt: string },
): void {
  sqlite.transaction(() => {
    assertCourseEditPermission(sqlite, request.accountId, request.courseId);
    const publishedAt = sqlite.prepare("SELECT published_at FROM courses WHERE id = ?").pluck()
      .get(request.courseId) as string | null | undefined;
    if (!publishedAt || publishedAt !== request.seenPublishedAt) {
      throw new StaleStateError("Die angezeigte Veröffentlichung ist nicht mehr aktuell.");
    }
    sqlite.prepare("UPDATE courses SET published_at = NULL WHERE id = ?").run(request.courseId);
  })();
}
