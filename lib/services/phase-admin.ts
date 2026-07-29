import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeCalendarDayField } from "@/lib/domain/calendar-day";
import { FieldError } from "@/lib/domain/field-error";
import { type PhaseType, isPhaseType } from "@/lib/domain/phase-type";
import { assertCourseEditPermission, assertCoursesEditPermission } from "@/lib/services/authorization";

export type PhaseField = "courseIds" | "semester" | "type" | "startDate" | "endDate";
export type PhaseDetails = { semester: string; type: string; startDate: string; endDate: string };
export type PhaseInput = PhaseDetails & { courseIds: string[] };

type CourseRow = { id: string; code: string; semesters: number; studyStart: string; studyEnd: string };
type NormalizedPhase = { semester: number; type: PhaseType; startDate: string; endDate: string };

/** Creates one independent course phase for every selected course. */
export function createDraftPhases(sqlite: Database.Database, input: { accountId: string; now?: Date } & PhaseInput): string[] {
  const now = input.now ?? new Date();
  return sqlite.transaction(() => {
    const courses = requireCourses(sqlite, input.courseIds);
    assertCoursesEditPermission(sqlite, input.accountId, courses.map((course) => course.id));
    const ids: string[] = [];
    const add = sqlite.prepare(`INSERT INTO course_phases (id, course_id, semester, phase_type, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?)`);
    for (const course of courses) {
      const phase = normalizePhaseDetails(input, course.semesters);
      assertPhaseWithinStudyPeriod(phase, course);
      const id = randomUUID();
      add.run(id, course.id, phase.semester, phase.type, phase.startDate, phase.endDate);
      touchCourse(sqlite, course.id, input.accountId, now);
      ids.push(id);
    }
    return ids;
  })();
}

export function updateDraftPhase(sqlite: Database.Database, input: { accountId: string; phaseId: string; now?: Date } & PhaseDetails): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const course = requireCourseOfPhase(sqlite, input.phaseId);
    assertCourseEditPermission(sqlite, input.accountId, course.id);
    const phase = normalizePhaseDetails(input, course.semesters);
    assertPhaseWithinStudyPeriod(phase, course);
    sqlite.prepare("UPDATE course_phases SET semester = ?, phase_type = ?, start_date = ?, end_date = ? WHERE id = ?")
      .run(phase.semester, phase.type, phase.startDate, phase.endDate, input.phaseId);
    touchCourse(sqlite, course.id, input.accountId, now);
  })();
}

export function deleteDraftPhase(sqlite: Database.Database, input: { accountId: string; phaseId: string; now?: Date }): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const course = requireCourseOfPhase(sqlite, input.phaseId);
    assertCourseEditPermission(sqlite, input.accountId, course.id);
    sqlite.prepare("DELETE FROM course_phases WHERE id = ?").run(input.phaseId);
    touchCourse(sqlite, course.id, input.accountId, now);
  })();
}

export function touchCourse(sqlite: Database.Database, courseId: string, accountId: string, now: Date): void {
  sqlite.prepare("UPDATE courses SET draft_updated_at = ?, draft_updated_by_account_id = ? WHERE id = ?")
    .run(now.toISOString(), accountId, courseId);
}

function requireCourses(sqlite: Database.Database, rawIds: string[]): CourseRow[] {
  const ids = [...new Set(rawIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) throw new FieldError("courseIds", "Wählen Sie mindestens einen Kurs für die Kursphase.");
  const placeholders = ids.map(() => "?").join(", ");
  const courses = sqlite.prepare(`SELECT course.id, course.code, program.semesters, course.study_start AS studyStart, course.study_end AS studyEnd
    FROM courses course JOIN programs program ON program.id = course.program_id WHERE course.id IN (${placeholders})`).all(...ids) as CourseRow[];
  if (courses.length !== ids.length) throw new FieldError("courseIds", "Ein ausgewählter Kurs wurde nicht gefunden.");
  return courses;
}

function requireCourseOfPhase(sqlite: Database.Database, phaseId: string): CourseRow {
  const course = sqlite.prepare(`SELECT course.id, course.code, program.semesters, course.study_start AS studyStart, course.study_end AS studyEnd
    FROM course_phases phase JOIN courses course ON course.id = phase.course_id JOIN programs program ON program.id = course.program_id
    WHERE phase.id = ?`).get(phaseId) as CourseRow | undefined;
  if (!course) throw new Error("Die Kursphase wurde nicht gefunden.");
  return course;
}

function normalizePhaseDetails(input: PhaseDetails, semesters: number): NormalizedPhase {
  const semester = Number(input.semester.trim());
  if (!Number.isInteger(semester) || semester < 1 || semester > semesters) throw new FieldError("semester", `Das Semester muss eine ganze Zahl von 1 bis ${semesters} sein.`);
  if (!isPhaseType(input.type)) throw new FieldError("type", "Der Phasentyp muss Theorie oder Praxis sein.");
  const startDate = normalizeCalendarDayField(input.startDate, "startDate", "Das Startdatum");
  const endDate = normalizeCalendarDayField(input.endDate, "endDate", "Das Enddatum");
  if (endDate < startDate) throw new FieldError("endDate", "Das Enddatum darf nicht vor dem Startdatum liegen.");
  return { semester, type: input.type, startDate, endDate };
}

function assertPhaseWithinStudyPeriod(phase: NormalizedPhase, course: CourseRow): void {
  const message = `Der Zeitraum muss innerhalb des Studienzeitraums von ${course.code} liegen.`;
  if (phase.startDate < course.studyStart) throw new FieldError("startDate", message);
  if (phase.endDate > course.studyEnd) throw new FieldError("endDate", message);
}
