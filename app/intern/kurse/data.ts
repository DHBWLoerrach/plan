import "server-only";

import type Database from "better-sqlite3";

import { type DraftCourse, type DraftEvent, type DraftPhase } from "@/lib/domain/publication";

import { type AreaOption, manageableAreas } from "../data";

type AccountScope = { id: string; systemAdmin: boolean };

export type CourseAssignmentFilter = "assigned" | "unassigned";
export type CourseListFilters = {
  area: string | null;
  program: string | null;
  year: string | null;
  assignment: CourseAssignmentFilter | null;
};
export type CourseListRow = {
  id: string;
  code: string;
  program: string;
  areaName: string;
  studyStart: string;
  studyEnd: string;
  blockPlanId: string | null;
  publishedIn: string | null;
  hasEverBeenPublished: number;
};
export type CourseListData = {
  areas: AreaOption[];
  programs: { id: string; name: string }[];
  years: { year: string }[];
  courses: CourseListRow[];
};
export type InternalCourse = {
  id: string;
  code: string;
  programId: string;
  studyStart: string;
  studyEnd: string;
  blockPlanId: string | null;
  publishedIn: string | null;
};
export type ProgramOption = { id: string; label: string };
export type CourseCutData = {
  year: string;
  courses: DraftCourse[];
  phases: (DraftPhase & { id: string })[];
  events: (DraftEvent & { affectedCourseCodes: string[] })[];
  previewLinks: { blockPlanId: string; codes: string[] }[];
};
export type CourseSort = "code" | "year";

/** The orders the list offers; each is reproducible, so a shared URL shows the same list again (MVP-SPEZIFIKATION.md). */
export const courseSortLabels: Record<CourseSort, string> = {
  code: "Kurskennung",
  year: "Jahrgang, dann Kurskennung",
};

/** Course codes are unique, so ending every order with them makes each one a total order. */
const courseOrderClauses: Record<CourseSort, string> = {
  code: "course.code COLLATE NOCASE",
  year: "substr(course.study_start, 1, 4) DESC, course.code COLLATE NOCASE",
};

export function isCourseSort(value: string | null): value is CourseSort {
  return value !== null && Object.hasOwn(courseSortLabels, value);
}

/** Filter options and matching courses within the account's manageable areas, in the requested order. */
export function courseListData(sqlite: Database.Database, account: AccountScope, filters: CourseListFilters, sort: CourseSort): CourseListData {
  const scope = account.systemAdmin ? 1 : 0;
  const areas = manageableAreas(sqlite, account);
  const programs = sqlite.prepare(`SELECT id, name FROM programs
    WHERE ? = 1 OR area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY name COLLATE NOCASE`).all(scope, account.id) as CourseListData["programs"];
  const years = sqlite.prepare(`SELECT DISTINCT substr(course.study_start, 1, 4) AS year
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY year DESC`).all(scope, account.id) as CourseListData["years"];
  const courses = sqlite.prepare(`SELECT course.id, course.code, program.name AS program, area.name AS areaName,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.block_plan_id AS blockPlanId,
      COALESCE(plan.has_ever_been_published, 0) AS hasEverBeenPublished,
      (SELECT version.block_plan_name FROM published_course_snapshots snapshot
        JOIN published_versions version ON version.id = snapshot.version_id
        WHERE snapshot.source_course_id = course.id) AS publishedIn
    FROM courses course JOIN programs program ON program.id = course.program_id
    LEFT JOIN block_plans plan ON plan.id = course.block_plan_id
    JOIN areas area ON area.id = program.area_id
    WHERE (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))
      AND (? IS NULL OR program.area_id = ?)
      AND (? IS NULL OR course.program_id = ?)
      AND (? IS NULL OR substr(course.study_start, 1, 4) = ?)
      AND (? IS NULL OR (CASE WHEN course.block_plan_id IS NULL THEN 'unassigned' ELSE 'assigned' END) = ?)
    ORDER BY ${courseOrderClauses[sort]}`).all(
    scope, account.id,
    filters.area, filters.area,
    filters.program, filters.program,
    filters.year, filters.year,
    filters.assignment, filters.assignment,
  ) as CourseListRow[];
  return { areas, programs, years, courses };
}

/** Course details if the account may manage its area. */
export function findInternalCourse(sqlite: Database.Database, courseId: string, account: AccountScope): InternalCourse | undefined {
  return sqlite.prepare(`SELECT course.id, course.code, course.program_id AS programId,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.block_plan_id AS blockPlanId,
      (SELECT version.block_plan_name FROM published_course_snapshots snapshot
        JOIN published_versions version ON version.id = snapshot.version_id
        WHERE snapshot.source_course_id = course.id) AS publishedIn
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.id = ? AND (? = 1 OR program.area_id IN (
      SELECT area_id FROM area_assignments WHERE user_id = ?
    ))`).get(courseId, account.systemAdmin ? 1 : 0, account.id) as InternalCourse | undefined;
}

/** Programs the account may manage, as labelled select options (system administration sees all areas). */
export function programOptions(sqlite: Database.Database, account: AccountScope): ProgramOption[] {
  const rows = sqlite.prepare(`SELECT program.id, program.name, program.abbreviation, area.name AS areaName
    FROM programs program JOIN areas area ON area.id = program.area_id
    WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY area.name COLLATE NOCASE, program.name COLLATE NOCASE`).all(account.systemAdmin ? 1 : 0, account.id) as
    { id: string; name: string; abbreviation: string; areaName: string }[];
  return rows.map((program) => ({ id: program.id, label: `${program.abbreviation} — ${program.name} (${program.areaName})` }));
}

/**
 * The internal Zuschnitt is a request-only selection: every returned course belongs to the requested year and to an
 * area the account may edit. The old block-plan id stays deliberately inside this reader; editor callers only receive
 * course data and never render or name that implementation detail.
 */
export function courseCutData(
  sqlite: Database.Database,
  account: AccountScope,
  input: { year: string; courseIds: string[] },
): CourseCutData | null {
  const courseIds = [...new Set(input.courseIds.map((courseId) => courseId.trim()).filter(Boolean))];
  if (!/^\d{4}$/u.test(input.year) || !courseIds.length) return null;
  const placeholders = courseIds.map(() => "?").join(", ");
  const scope = account.systemAdmin ? 1 : 0;
  const rows = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd,
      program.semesters, course.block_plan_id AS blockPlanId
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.id IN (${placeholders})
      AND substr(course.study_start, 1, 4) = ?
      AND (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))
    ORDER BY course.code COLLATE NOCASE`).all(...courseIds, input.year, scope, account.id) as (DraftCourse & { blockPlanId: string | null })[];
  if (rows.length !== courseIds.length || rows.some((course) => !course.blockPlanId)) return null;

  const phases = sqlite.prepare(`SELECT phase.id, phase.course_id AS courseId, phase.semester, phase.phase_type AS type,
      phase.start_date AS startDate, phase.end_date AS endDate
    FROM draft_phases phase WHERE phase.course_id IN (${placeholders})
    ORDER BY phase.semester, phase.start_date, phase.id`).all(...courseIds) as CourseCutData["phases"];
  const eventRows = sqlite.prepare(`SELECT DISTINCT event.id, event.title, event.description, event.category,
      event.start_date AS startDate, event.end_date AS endDate, event.provisional
    FROM draft_events event JOIN draft_event_courses link ON link.event_id = event.id
    WHERE link.course_id IN (${placeholders})
    ORDER BY event.start_date, event.title COLLATE NOCASE, event.id`).all(...courseIds) as (Omit<DraftEvent, "courseIds" | "provisional"> & { provisional: number })[];
  const selected = new Set(courseIds);
  const eventCourses = sqlite.prepare(`SELECT link.course_id AS courseId, course.code FROM draft_event_courses link
    JOIN courses course ON course.id = link.course_id WHERE link.event_id = ? ORDER BY course.code COLLATE NOCASE`);
  const events = eventRows.map((event) => ({
    ...event,
    provisional: Boolean(event.provisional),
    courseIds: (eventCourses.all(event.id) as { courseId: string; code: string }[])
      .map((entry) => entry.courseId)
      .filter((courseId) => selected.has(courseId)),
    affectedCourseCodes: (eventCourses.all(event.id) as { courseId: string; code: string }[]).map((entry) => entry.code),
  }));
  const plans = new Map<string, string[]>();
  for (const course of rows) {
    const codes = plans.get(course.blockPlanId!) ?? [];
    codes.push(course.code);
    plans.set(course.blockPlanId!, codes);
  }
  return {
    year: input.year,
    courses: rows.map((course) => ({
      id: course.id,
      code: course.code,
      studyStart: course.studyStart,
      studyEnd: course.studyEnd,
      semesters: course.semesters,
    })),
    phases,
    events,
    previewLinks: [...plans].map(([blockPlanId, codes]) => ({ blockPlanId, codes })),
  };
}
