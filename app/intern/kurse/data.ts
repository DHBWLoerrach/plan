import "server-only";

import type Database from "better-sqlite3";

import { type DraftCourse, type DraftEvent, type DraftPhase } from "@/lib/domain/publication";

import { type AreaOption, manageableAreas } from "../data";

type AccountScope = { id: string; systemAdmin: boolean };
export type CourseListFilters = { area: string | null; program: string | null; year: string | null };
export type CourseListRow = { id: string; code: string; program: string; areaName: string; studyStart: string; studyEnd: string; publishedIn: string | null; hasEverBeenPublished: number };
export type CourseListData = { areas: AreaOption[]; programs: { id: string; name: string }[]; years: { year: string }[]; courses: CourseListRow[] };
export type InternalCourse = { id: string; code: string; programId: string; studyStart: string; studyEnd: string; publishedIn: string | null };
export type ProgramOption = { id: string; label: string };
export type CourseCutData = { year: string; courses: DraftCourse[]; phases: (DraftPhase & { id: string })[]; events: (DraftEvent & { affectedCourseCodes: string[] })[] };
export type CourseSort = "code" | "year";
export const courseSortLabels: Record<CourseSort, string> = { code: "Kurskennung", year: "Jahrgang, dann Kurskennung" };
const courseOrderClauses: Record<CourseSort, string> = { code: "course.code COLLATE NOCASE", year: "substr(course.study_start, 1, 4) DESC, course.code COLLATE NOCASE" };
export function isCourseSort(value: string | null): value is CourseSort { return value !== null && Object.hasOwn(courseSortLabels, value); }

export function courseListData(sqlite: Database.Database, account: AccountScope, filters: CourseListFilters, sort: CourseSort): CourseListData {
  const scope = account.systemAdmin ? 1 : 0;
  const areas = manageableAreas(sqlite, account);
  const programs = sqlite.prepare(`SELECT id, name FROM programs WHERE ? = 1 OR area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?) ORDER BY name COLLATE NOCASE`).all(scope, account.id) as CourseListData["programs"];
  const years = sqlite.prepare(`SELECT DISTINCT substr(course.study_start, 1, 4) AS year FROM courses course JOIN programs program ON program.id = course.program_id WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?) ORDER BY year DESC`).all(scope, account.id) as CourseListData["years"];
  const courses = sqlite.prepare(`SELECT course.id, course.code, program.name AS program, area.name AS areaName, course.study_start AS studyStart, course.study_end AS studyEnd,
      course.has_ever_been_published AS hasEverBeenPublished, (SELECT code FROM published_courses WHERE course_id = course.id) AS publishedIn
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    WHERE (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))
      AND (? IS NULL OR program.area_id = ?) AND (? IS NULL OR course.program_id = ?) AND (? IS NULL OR substr(course.study_start, 1, 4) = ?)
    ORDER BY ${courseOrderClauses[sort]}`).all(scope, account.id, filters.area, filters.area, filters.program, filters.program, filters.year, filters.year) as CourseListRow[];
  return { areas, programs, years, courses };
}

export function findInternalCourse(sqlite: Database.Database, courseId: string, account: AccountScope): InternalCourse | undefined {
  return sqlite.prepare(`SELECT course.id, course.code, course.program_id AS programId, course.study_start AS studyStart, course.study_end AS studyEnd,
      (SELECT code FROM published_courses WHERE course_id = course.id) AS publishedIn
    FROM courses course JOIN programs program ON program.id = course.program_id WHERE course.id = ?
      AND (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))`).get(courseId, account.systemAdmin ? 1 : 0, account.id) as InternalCourse | undefined;
}

export function programOptions(sqlite: Database.Database, account: AccountScope): ProgramOption[] {
  const rows = sqlite.prepare(`SELECT program.id, program.name, program.abbreviation, area.name AS areaName FROM programs program JOIN areas area ON area.id = program.area_id WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?) ORDER BY area.name COLLATE NOCASE, program.name COLLATE NOCASE`).all(account.systemAdmin ? 1 : 0, account.id) as { id: string; name: string; abbreviation: string; areaName: string }[];
  return rows.map((program) => ({ id: program.id, label: `${program.abbreviation} — ${program.name} (${program.areaName})` }));
}

export function courseCutData(sqlite: Database.Database, account: AccountScope, input: { year: string; courseIds: string[] }): CourseCutData | null {
  const courseIds = [...new Set(input.courseIds.map((id) => id.trim()).filter(Boolean))];
  if (!/^\d{4}$/u.test(input.year) || !courseIds.length) return null;
  const placeholders = courseIds.map(() => "?").join(", ");
  const rows = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd, program.semesters
    FROM courses course JOIN programs program ON program.id = course.program_id WHERE course.id IN (${placeholders}) AND substr(course.study_start, 1, 4) = ?
      AND (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)) ORDER BY course.code COLLATE NOCASE`).all(...courseIds, input.year, account.systemAdmin ? 1 : 0, account.id) as DraftCourse[];
  if (rows.length !== courseIds.length) return null;
  const phases = sqlite.prepare(`SELECT id, course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM course_phases WHERE course_id IN (${placeholders}) ORDER BY semester, start_date, id`).all(...courseIds) as CourseCutData["phases"];
  const events = sqlite.prepare(`SELECT event.id, event.course_id AS courseId, event.title, event.description, event.category, event.start_date AS startDate, event.end_date AS endDate, event.provisional, course.code
    FROM course_events event JOIN courses course ON course.id = event.course_id WHERE event.course_id IN (${placeholders}) ORDER BY event.start_date, event.title COLLATE NOCASE, event.id`).all(...courseIds) as (Omit<DraftEvent, "courseIds" | "provisional"> & { courseId: string; code: string; provisional: number })[];
  return { year: input.year, courses: rows, phases, events: events.map(({ courseId, code, provisional, ...event }) => ({ ...event, provisional: Boolean(provisional), courseIds: [courseId], affectedCourseCodes: [code] })) };
}
