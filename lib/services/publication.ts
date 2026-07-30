import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeCourseCode } from "@/lib/domain/course-code";
import { type DraftCourse, type DraftEvent, type DraftPhase, type PublicationIssue, validatePublication } from "@/lib/domain/publication";
import { assertCourseEditPermission } from "@/lib/services/authorization";

type PublicationRequest = { courseId: string; accountId: string; seenDraftUpdatedAt: string; seenPublishedCourseId: string | null };
type CourseRow = DraftCourse & { areaName: string; program: string; programAbbreviation: string; draftUpdatedAt: string; hasEverBeenPublished: number; publishedCourseId: string | null };

export class StaleStateError extends Error { constructor(message: string) { super(message); this.name = "StaleStateError"; } }

function readDraft(sqlite: Database.Database, courseId: string) {
  const course = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd,
      program.semesters, area.name AS areaName, program.name AS program, program.abbreviation AS programAbbreviation,
      course.draft_updated_at AS draftUpdatedAt, course.has_ever_been_published AS hasEverBeenPublished, published.id AS publishedCourseId
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    LEFT JOIN published_courses published ON published.course_id = course.id WHERE course.id = ?`).get(courseId) as CourseRow | undefined;
  if (!course) return null;
  const phases = sqlite.prepare("SELECT course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM course_phases WHERE course_id = ?").all(courseId) as DraftPhase[];
  const events = sqlite.prepare(`SELECT id, title, description, category, start_date AS startDate, end_date AS endDate, provisional
    FROM course_events WHERE course_id = ? ORDER BY start_date, title COLLATE NOCASE`).all(courseId) as { id: string; title: string; description: string | null; category: DraftEvent["category"]; startDate: string; endDate: string | null; provisional: number }[];
  return { course, phases, events: events.map((event) => ({ ...event, provisional: Boolean(event.provisional), courseIds: [courseId] })) };
}

export function readPublicationPreview(sqlite: Database.Database, courseId: string) {
  const draft = readDraft(sqlite, courseId);
  if (!draft) return null;
  const issues = publicationIssuesForDraft(sqlite, draft.course, draft.phases, draft.events);
  return { course: draft.course, courses: [draft.course], phases: draft.phases, events: draft.events, issues };
}

function publicationIssuesForDraft(sqlite: Database.Database, course: DraftCourse, phases: DraftPhase[], events: DraftEvent[]): PublicationIssue[] {
  const issues = validatePublication({ courses: [course], phases, events });
  const collision = sqlite.prepare(`SELECT 1 FROM published_course_search_keys key
    JOIN published_courses published ON published.id = key.published_course_id
    WHERE key.normalized_code = ? AND published.course_id <> ?`).get(normalizeCourseCode(course.code), course.id);
  if (collision) issues.push({ code: "course-code-published-elsewhere", courseId: course.id, semester: null, field: null,
    message: `Die Kurskennung ${course.code} ist bereits in einer anderen veröffentlichten Fassung sichtbar.` });
  return issues;
}

export function publishCourse(sqlite: Database.Database, request: PublicationRequest) {
  return sqlite.transaction(() => {
    const preview = readPublicationPreview(sqlite, request.courseId);
    if (!preview) throw new Error("Der Kurs wurde nicht gefunden.");
    const { course, phases, events, issues } = preview;
    assertCourseEditPermission(sqlite, request.accountId, course.id);
    if (course.draftUpdatedAt !== request.seenDraftUpdatedAt || course.publishedCourseId !== request.seenPublishedCourseId) throw new StaleStateError("Die Vorschau ist nicht mehr aktuell. Laden Sie den aktuellen Planungsstand erneut.");
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(" "));
    if (course.publishedCourseId) sqlite.prepare("DELETE FROM published_courses WHERE id = ?").run(course.publishedCourseId);
    const id = randomUUID();
    sqlite.prepare(`INSERT INTO published_courses (id, course_id, published_at, area_name, program_name, program_abbreviation, code, study_start, study_end, semesters)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, course.id, new Date().toISOString(), course.areaName, course.program, course.programAbbreviation, course.code, course.studyStart, course.studyEnd, course.semesters);
    sqlite.prepare("INSERT INTO published_course_search_keys (published_course_id, normalized_code) VALUES (?, ?)").run(id, normalizeCourseCode(course.code));
    const addPhase = sqlite.prepare("INSERT INTO published_phases (id, published_course_id, semester, phase_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)");
    for (const phase of phases) addPhase.run(randomUUID(), id, phase.semester, phase.type, phase.startDate, phase.endDate);
    const addEvent = sqlite.prepare(`INSERT INTO published_events (id, published_course_id, title, description, category, start_date, end_date, provisional)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const event of events) addEvent.run(randomUUID(), id, event.title, event.description, event.category, event.startDate, event.endDate, event.provisional ? 1 : 0);
    sqlite.prepare("UPDATE courses SET has_ever_been_published = 1 WHERE id = ?").run(course.id);
    return { id, courseCode: course.code };
  })();
}

export function withdrawCourse(sqlite: Database.Database, { courseId, accountId, seenPublishedCourseId }: Omit<PublicationRequest, "seenDraftUpdatedAt">): void {
  sqlite.transaction(() => {
    assertCourseEditPermission(sqlite, accountId, courseId);
    const id = sqlite.prepare("SELECT id FROM published_courses WHERE course_id = ?").pluck().get(courseId) as string | undefined;
    if (!id || id !== seenPublishedCourseId) throw new StaleStateError("Die angezeigte Veröffentlichung ist nicht mehr aktuell.");
    sqlite.prepare("DELETE FROM published_courses WHERE id = ?").run(id);
  })();
}
