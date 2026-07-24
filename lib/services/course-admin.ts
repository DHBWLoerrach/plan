import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeCalendarDay } from "@/lib/domain/calendar-day";
import { assertAreaEditPermission } from "@/lib/services/authorization";
import { assertCourseFitsBlockPlan } from "@/lib/services/course-assignment";
import { clearCourseFromDraft, touchDraft } from "@/lib/services/draft-changes";

const maximumCodeLength = 32;

type CourseInput = { code: string; programId: string; studyStart: string; studyEnd: string };
type NormalizedCourse = { code: string; normalizedCode: string; programId: string; studyStart: string; studyEnd: string };
type ProgramRow = { id: string; areaId: string; semesters: number };
type CourseRow = { id: string; programId: string; blockPlanId: string | null };

export function createCourse(sqlite: Database.Database, input: { accountId: string } & CourseInput): string {
  const normalized = normalizeCourseInput(input);
  return sqlite.transaction(() => {
    const program = requireProgram(sqlite, normalized.programId);
    assertAreaEditPermission(sqlite, input.accountId, program.areaId);
    assertCodeAvailable(sqlite, normalized.normalizedCode, null);
    const id = randomUUID();
    sqlite.prepare(`INSERT INTO courses (id, program_id, block_plan_id, code, normalized_code, study_start, study_end)
      VALUES (?, ?, NULL, ?, ?, ?, ?)`).run(id, normalized.programId, normalized.code, normalized.normalizedCode, normalized.studyStart, normalized.studyEnd);
    return id;
  })();
}

export function updateCourse(sqlite: Database.Database, input: { accountId: string; courseId: string; now?: Date } & CourseInput): void {
  const normalized = normalizeCourseInput(input);
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const course = requireCourse(sqlite, input.courseId);
    const currentProgram = requireProgram(sqlite, course.programId);
    assertAreaEditPermission(sqlite, input.accountId, currentProgram.areaId);
    const program = requireProgram(sqlite, normalized.programId);
    if (program.areaId !== currentProgram.areaId) assertAreaEditPermission(sqlite, input.accountId, program.areaId);
    assertCodeAvailable(sqlite, normalized.normalizedCode, input.courseId);
    if (course.blockPlanId) {
      assertCourseFitsBlockPlan(sqlite, course.blockPlanId, { id: input.courseId, areaId: program.areaId, semesters: program.semesters, studyStart: normalized.studyStart });
    }
    sqlite.prepare("UPDATE courses SET program_id = ?, code = ?, normalized_code = ?, study_start = ?, study_end = ? WHERE id = ?")
      .run(normalized.programId, normalized.code, normalized.normalizedCode, normalized.studyStart, normalized.studyEnd, input.courseId);
    if (course.blockPlanId) touchDraft(sqlite, course.blockPlanId, input.accountId, now);
  })();
}

export function deleteCourse(sqlite: Database.Database, input: { accountId: string; courseId: string; now?: Date }): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const course = requireCourse(sqlite, input.courseId);
    const program = requireProgram(sqlite, course.programId);
    assertAreaEditPermission(sqlite, input.accountId, program.areaId);
    const publishedIn = sqlite.prepare(`SELECT version.block_plan_name AS name FROM published_course_snapshots snapshot
      JOIN published_versions version ON version.id = snapshot.version_id WHERE snapshot.source_course_id = ?`).get(input.courseId) as { name: string } | undefined;
    if (publishedIn) throw new Error(`Der Kurs ist in der veröffentlichten Fassung „${publishedIn.name}“ sichtbar und kann nicht gelöscht werden.`);
    if (course.blockPlanId) {
      const remaining = (sqlite.prepare("SELECT COUNT(*) AS count FROM courses WHERE block_plan_id = ?").get(course.blockPlanId) as { count: number }).count;
      if (remaining <= 1) throw new Error("Der letzte Kurs eines Blockplans kann nicht gelöscht werden. Löschen Sie stattdessen den Blockplan.");
      clearCourseFromDraft(sqlite, course.blockPlanId, input.courseId);
      touchDraft(sqlite, course.blockPlanId, input.accountId, now);
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
  const course = sqlite.prepare("SELECT id, program_id AS programId, block_plan_id AS blockPlanId FROM courses WHERE id = ?").get(courseId) as CourseRow | undefined;
  if (!course) throw new Error("Der Kurs wurde nicht gefunden.");
  return course;
}

function assertCodeAvailable(sqlite: Database.Database, normalizedCode: string, exceptCourseId: string | null): void {
  const existing = sqlite.prepare("SELECT id FROM courses WHERE normalized_code = ?").get(normalizedCode) as { id: string } | undefined;
  if (existing && existing.id !== exceptCourseId) throw new Error("Diese Kurskennung ist bereits vergeben.");
}

function normalizeCourseInput(input: CourseInput): NormalizedCourse {
  // The Kurskennung has no enforced format (FACHLICHE_REGELN.md), so only trim; interior characters stay verbatim.
  const code = input.code.trim();
  if (!code) throw new Error("Die Kurskennung ist erforderlich.");
  if ([...code].length > maximumCodeLength) throw new Error(`Die Kurskennung darf höchstens ${maximumCodeLength} Zeichen lang sein.`);
  const programId = input.programId.trim();
  if (!programId) throw new Error("Ein Studiengang ist erforderlich.");
  const studyStart = normalizeCalendarDay(input.studyStart, "Der Studienbeginn");
  const studyEnd = normalizeCalendarDay(input.studyEnd, "Das Studienende");
  if (studyStart >= studyEnd) throw new Error("Der Studienbeginn muss vor dem Studienende liegen.");
  return { code, normalizedCode: code.toLocaleLowerCase("de-DE"), programId, studyStart, studyEnd };
}

