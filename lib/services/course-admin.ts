import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeCalendarDay } from "@/lib/domain/calendar-day";
import { normalizeCourseCode } from "@/lib/domain/course-code";
import { assertAreaEditPermission, assertCourseEditPermission } from "@/lib/services/authorization";
import { adoptIntoCourse, type AdoptionInput } from "@/lib/services/course-adoption";
import { touchCourse } from "@/lib/services/phase-admin";
import { assertPublishedCourseValid } from "@/lib/services/publication";

const maximumCodeLength = 32;
type CourseInput = { code: string; programId: string; studyStart: string; studyEnd: string };
type NormalizedCourse = CourseInput & { normalizedCode: string };
type ProgramRow = { id: string; areaId: string; semesters: number };
type CourseRow = { id: string; programId: string };

/**
 * Creates a course, empty or as an adoption from a template. The permission is decided on the area of the **new**
 * course; the template is only read and may belong to any area (FACHLICHE_REGELN.md). Creation and adoption share
 * this one transaction.
 */
export function createCourse(sqlite: Database.Database, input: { accountId: string; adoption?: AdoptionInput; now?: Date } & CourseInput): string {
  const normalized = normalizeCourseInput(input);
  const now = input.now ?? new Date();
  return sqlite.transaction(() => {
    const program = requireProgram(sqlite, normalized.programId);
    assertAreaEditPermission(sqlite, input.accountId, program.areaId);
    assertCodeAvailable(sqlite, normalized.normalizedCode, null);
    const id = randomUUID();
    sqlite.prepare(`INSERT INTO courses
      (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`)
      .run(id, normalized.programId, normalized.code, normalized.normalizedCode, normalized.studyStart, normalized.studyEnd, now.toISOString(), input.accountId);
    if (input.adoption) {
      adoptIntoCourse(sqlite, { courseId: id, studyStart: normalized.studyStart, studyEnd: normalized.studyEnd, semesters: program.semesters, adoption: input.adoption });
    }
    return id;
  })();
}

export function updateCourse(sqlite: Database.Database, input: { accountId: string; courseId: string; now?: Date } & CourseInput): void {
  const normalized = normalizeCourseInput(input);
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const course = requireCourse(sqlite, input.courseId);
    assertCourseEditPermission(sqlite, input.accountId, input.courseId);
    const currentProgram = requireProgram(sqlite, course.programId);
    const program = requireProgram(sqlite, normalized.programId);
    if (program.areaId !== currentProgram.areaId) assertAreaEditPermission(sqlite, input.accountId, program.areaId);
    assertCodeAvailable(sqlite, normalized.normalizedCode, input.courseId);
    const outsidePhase = sqlite.prepare("SELECT 1 FROM course_phases WHERE course_id = ? AND (start_date < ? OR end_date > ?)")
      .get(input.courseId, normalized.studyStart, normalized.studyEnd);
    if (outsidePhase) throw new Error("Der Studienzeitraum muss alle Kursphasen des Kurses umfassen. Passen Sie zuerst die Kursphasen an.");
    const highestSemester = sqlite.prepare("SELECT max(semester) FROM course_phases WHERE course_id = ?").pluck().get(input.courseId) as number | null;
    if (highestSemester && highestSemester > program.semesters) throw new Error(`Der Studiengang benötigt mindestens ${highestSemester} Semester für die erfassten Kursphasen.`);
    sqlite.prepare("UPDATE courses SET program_id = ?, code = ?, normalized_code = ?, study_start = ?, study_end = ? WHERE id = ?")
      .run(normalized.programId, normalized.code, normalized.normalizedCode, normalized.studyStart, normalized.studyEnd, input.courseId);
    touchCourse(sqlite, input.courseId, input.accountId, now);
    assertPublishedCourseValid(sqlite, input.courseId);
  })();
}

export function deleteCourse(sqlite: Database.Database, input: { accountId: string; courseId: string }): void {
  sqlite.transaction(() => {
    requireCourse(sqlite, input.courseId);
    assertCourseEditPermission(sqlite, input.accountId, input.courseId);
    if (sqlite.prepare("SELECT published_at FROM courses WHERE id = ?").pluck().get(input.courseId)) {
      throw new Error("Der Kurs ist veröffentlicht und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung zuerst zurück.");
    }
    sqlite.prepare("DELETE FROM courses WHERE id = ?").run(input.courseId);
  })();
}

function requireProgram(sqlite: Database.Database, programId: string): ProgramRow {
  const program = sqlite.prepare("SELECT id, area_id AS areaId, semesters FROM programs WHERE id = ?").get(programId) as ProgramRow | undefined;
  if (!program) throw new Error("Der angegebene Studiengang wurde nicht gefunden.");
  return program;
}

function requireCourse(sqlite: Database.Database, courseId: string): CourseRow {
  const course = sqlite.prepare("SELECT id, program_id AS programId FROM courses WHERE id = ?").get(courseId) as CourseRow | undefined;
  if (!course) throw new Error("Der Kurs wurde nicht gefunden.");
  return course;
}

function assertCodeAvailable(sqlite: Database.Database, normalizedCode: string, exceptCourseId: string | null): void {
  const existing = sqlite.prepare("SELECT id FROM courses WHERE normalized_code = ?").get(normalizedCode) as { id: string } | undefined;
  if (existing && existing.id !== exceptCourseId) throw new Error("Diese Kurskennung ist bereits vergeben.");
}

function normalizeCourseInput(input: CourseInput): NormalizedCourse {
  const code = input.code.trim();
  if (!code) throw new Error("Die Kurskennung ist erforderlich.");
  if ([...code].length > maximumCodeLength) throw new Error(`Die Kurskennung darf höchstens ${maximumCodeLength} Zeichen lang sein.`);
  const programId = input.programId.trim();
  if (!programId) throw new Error("Ein Studiengang ist erforderlich.");
  const studyStart = normalizeCalendarDay(input.studyStart, "Der Studienbeginn");
  const studyEnd = normalizeCalendarDay(input.studyEnd, "Das Studienende");
  if (studyStart >= studyEnd) throw new Error("Der Studienbeginn muss vor dem Studienende liegen.");
  return { code, normalizedCode: normalizeCourseCode(code), programId, studyStart, studyEnd };
}
