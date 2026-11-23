import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeCalendarDayField, plusDays } from "@/lib/domain/calendar-day";
import { FieldError } from "@/lib/domain/field-error";
import { type PhaseType, isPhaseType } from "@/lib/domain/phase-type";
import { assertCourseEditPermission, assertCoursesEditPermission } from "@/lib/services/authorization";
import { assertPublishedCourseValid } from "@/lib/services/publication";

export type PhaseField = "courseIds" | "semester" | "type" | "startDate" | "endDate";
export type PhaseChangeField = "date";
export type PhaseDetails = { semester: string; type: string; startDate: string; endDate: string };
export type PhaseInput = PhaseDetails & { courseIds: string[] };

type CourseRow = { id: string; code: string; semesters: number; studyStart: string; studyEnd: string; publishedAt: string | null };
type NormalizedPhase = { semester: number; type: PhaseType; startDate: string; endDate: string };

/** Creates one independent course phase for every selected course. */
export function createCoursePhases(sqlite: Database.Database, input: { accountId: string; now?: Date } & PhaseInput): string[] {
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
      assertPublishedCourseValid(sqlite, course.id);
      ids.push(id);
    }
    return ids;
  }).immediate();
}

export function updateCoursePhase(sqlite: Database.Database, input: { accountId: string; phaseId: string; now?: Date } & PhaseDetails): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const course = requireCourseOfPhase(sqlite, input.phaseId);
    assertCourseEditPermission(sqlite, input.accountId, course.id);
    const phase = normalizePhaseDetails(input, course.semesters);
    assertPhaseWithinStudyPeriod(phase, course);
    if (course.publishedAt) adjustPublishedPhaseNeighbours(sqlite, input.phaseId, course, phase);
    sqlite.prepare("UPDATE course_phases SET semester = ?, phase_type = ?, start_date = ?, end_date = ? WHERE id = ?")
      .run(phase.semester, phase.type, phase.startDate, phase.endDate, input.phaseId);
    touchCourse(sqlite, course.id, input.accountId, now);
    assertPublishedCourseValid(sqlite, course.id);
  }).immediate();
}

/**
 * Moves the day a course changes over from one phase to the next. That day is one fact carried by two rows — the end
 * of the earlier phase and the start of the later one — so both are written together, for an unpublished course just
 * as for a published one: moved one at a time they would leave a gap or an overlap in between, which is exactly what
 * this operation exists to rule out. `date` is the first day of the later phase.
 */
export function moveCoursePhaseChange(sqlite: Database.Database, input: { accountId: string; earlierPhaseId: string; laterPhaseId: string; date: string; now?: Date }): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const course = requireCourseOfPhase(sqlite, input.laterPhaseId);
    assertCourseEditPermission(sqlite, input.accountId, course.id);
    const read = sqlite.prepare("SELECT id, start_date AS startDate, end_date AS endDate FROM course_phases WHERE id = ? AND course_id = ?");
    const earlier = read.get(input.earlierPhaseId, course.id) as StoredPhase | undefined;
    const later = read.get(input.laterPhaseId, course.id) as StoredPhase;
    if (!earlier) throw new Error("Die Kursphase wurde nicht gefunden.");
    // What the form showed may have been changed since; a day between two phases that no longer adjoin does not exist.
    if (later.startDate !== plusDays(earlier.endDate, 1)) throw new Error("Die beiden Kursphasen grenzen nicht mehr aneinander. Laden Sie die Seite neu.");
    const date = normalizeCalendarDayField(input.date, "date", "Der Tag des Wechsels");
    if (date <= earlier.startDate) throw new FieldError("date", "Der Wechsel muss nach dem ersten Tag der vorherigen Kursphase liegen, sonst bliebe von ihr kein Tag übrig.");
    if (date > later.endDate) throw new FieldError("date", "Der Wechsel darf nicht nach dem letzten Tag der folgenden Kursphase liegen, sonst bliebe von ihr kein Tag übrig.");
    sqlite.prepare("UPDATE course_phases SET end_date = ? WHERE id = ?").run(plusDays(date, -1), earlier.id);
    sqlite.prepare("UPDATE course_phases SET start_date = ? WHERE id = ?").run(date, later.id);
    touchCourse(sqlite, course.id, input.accountId, now);
    assertPublishedCourseValid(sqlite, course.id);
  }).immediate();
}

export function deleteCoursePhase(sqlite: Database.Database, input: { accountId: string; phaseId: string; now?: Date }): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const course = requireCourseOfPhase(sqlite, input.phaseId);
    assertCourseEditPermission(sqlite, input.accountId, course.id);
    sqlite.prepare("DELETE FROM course_phases WHERE id = ?").run(input.phaseId);
    touchCourse(sqlite, course.id, input.accountId, now);
    assertPublishedCourseValid(sqlite, course.id);
  }).immediate();
}

export function touchCourse(sqlite: Database.Database, courseId: string, accountId: string, now: Date): void {
  sqlite.prepare("UPDATE courses SET updated_at = ?, updated_by_account_id = ? WHERE id = ?")
    .run(now.toISOString(), accountId, courseId);
}

type StoredPhase = { id: string; startDate: string; endDate: string };

/** A published phase boundary is one fact shared by two neighbours, so both rows move in the same transaction. */
function adjustPublishedPhaseNeighbours(
  sqlite: Database.Database,
  phaseId: string,
  course: CourseRow,
  replacement: NormalizedPhase,
): void {
  const current = sqlite.prepare(`SELECT id, start_date AS startDate, end_date AS endDate
    FROM course_phases WHERE id = ?`).get(phaseId) as StoredPhase;
  if (replacement.startDate !== current.startDate) {
    const previous = sqlite.prepare(`SELECT id, start_date AS startDate, end_date AS endDate FROM course_phases
      WHERE course_id = ? AND start_date < ? ORDER BY start_date DESC LIMIT 1`)
      .get(course.id, current.startDate) as StoredPhase | undefined;
    if (previous) {
      const endDate = plusDays(replacement.startDate, -1);
      if (endDate < previous.startDate) throw new FieldError("startDate", "Die verschobene Grenze würde die vorherige Kursphase vollständig verdrängen.");
      sqlite.prepare("UPDATE course_phases SET end_date = ? WHERE id = ?").run(endDate, previous.id);
    }
  }
  if (replacement.endDate !== current.endDate) {
    const next = sqlite.prepare(`SELECT id, start_date AS startDate, end_date AS endDate FROM course_phases
      WHERE course_id = ? AND start_date > ? ORDER BY start_date LIMIT 1`)
      .get(course.id, current.startDate) as StoredPhase | undefined;
    if (next) {
      const startDate = plusDays(replacement.endDate, 1);
      if (startDate > next.endDate) throw new FieldError("endDate", "Die verschobene Grenze würde die folgende Kursphase vollständig verdrängen.");
      sqlite.prepare("UPDATE course_phases SET start_date = ? WHERE id = ?").run(startDate, next.id);
    }
  }
}

/**
 * The selected courses in the order they were selected. `IN` returns them in whatever order the table yields, while
 * the caller puts the course actually being edited first and its transfer targets behind it — and the refusals name a
 * course by its code. Keeping the order therefore decides which course a rejected selection reports first.
 */
function requireCourses(sqlite: Database.Database, rawIds: string[]): CourseRow[] {
  const ids = [...new Set(rawIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) throw new FieldError("courseIds", "Wählen Sie mindestens einen Kurs für die Kursphase.");
  const placeholders = ids.map(() => "?").join(", ");
  const rows = sqlite.prepare(`SELECT course.id, course.code, program.semesters, course.study_start AS studyStart, course.study_end AS studyEnd
      , course.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id WHERE course.id IN (${placeholders})`).all(...ids) as CourseRow[];
  if (rows.length !== ids.length) throw new FieldError("courseIds", "Ein ausgewählter Kurs wurde nicht gefunden.");
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)!);
}

function requireCourseOfPhase(sqlite: Database.Database, phaseId: string): CourseRow {
  const course = sqlite.prepare(`SELECT course.id, course.code, program.semesters, course.study_start AS studyStart,
      course.study_end AS studyEnd, course.published_at AS publishedAt
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
