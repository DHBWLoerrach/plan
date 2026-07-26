import "server-only";

import type Database from "better-sqlite3";

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
};
export type CourseListData = {
  areas: { id: string; name: string }[];
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

/** Filter options and matching courses within the account's manageable areas. */
export function courseListData(sqlite: Database.Database, account: AccountScope, filters: CourseListFilters): CourseListData {
  const scope = account.systemAdmin ? 1 : 0;
  const areas = sqlite.prepare(`SELECT id, name FROM areas
    WHERE ? = 1 OR id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY name COLLATE NOCASE`).all(scope, account.id) as CourseListData["areas"];
  const programs = sqlite.prepare(`SELECT id, name FROM programs
    WHERE ? = 1 OR area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY name COLLATE NOCASE`).all(scope, account.id) as CourseListData["programs"];
  const years = sqlite.prepare(`SELECT DISTINCT substr(course.study_start, 1, 4) AS year
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY year DESC`).all(scope, account.id) as CourseListData["years"];
  const courses = sqlite.prepare(`SELECT course.id, course.code, program.name AS program, area.name AS areaName,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.block_plan_id AS blockPlanId,
      (SELECT version.block_plan_name FROM published_course_snapshots snapshot
        JOIN published_versions version ON version.id = snapshot.version_id
        WHERE snapshot.source_course_id = course.id) AS publishedIn
    FROM courses course JOIN programs program ON program.id = course.program_id
    JOIN areas area ON area.id = program.area_id
    WHERE (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))
      AND (? IS NULL OR program.area_id = ?)
      AND (? IS NULL OR course.program_id = ?)
      AND (? IS NULL OR substr(course.study_start, 1, 4) = ?)
      AND (? IS NULL OR (CASE WHEN course.block_plan_id IS NULL THEN 'unassigned' ELSE 'assigned' END) = ?)
    ORDER BY course.code COLLATE NOCASE`).all(
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

export function searchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = searchParams[key];
  return typeof value === "string" && value ? value : null;
}
