import type Database from "better-sqlite3";

import type { PublicCut } from "@/lib/domain/public-cut";
import { normalizeCodePrefix, normalizeCourseCode } from "@/lib/domain/course-code";
import type { CoursePlan, CourseEvent, CoursePhase } from "@/lib/domain/publication";

export const plansPerPage = 25;

export interface PublicFilters {
  area?: string;
  program?: string;
  year?: string;
  course?: string;
}

export const filterKeys = ["area", "program", "year", "course"] as const;

/** A currently published course, enriched with the current designations that address its cuts. */
export type PublicCourse = CoursePlan & { area: string; program: string; programAbbreviation: string; year: number };
export type PublicFilterOption = { value: string; label: string };
export type PublicPlanGroupKey = "current" | "future" | "past";
export interface PublicPlanGroup { key: PublicPlanGroupKey; label: string; courses: PublicCourse[] }
export interface PublicSearchResult {
  groups: PublicPlanGroup[];
  filters: PublicFilters;
  total: number;
  page: number;
  pages: number;
}
export interface PublicCutDetail {
  cut: PublicCut;
  courses: PublicCourse[];
  phases: CoursePhase[];
  events: CourseEvent[];
}

const groupLabels: Record<PublicPlanGroupKey, string> = {
  current: "Aktuell laufend",
  future: "Zukünftig",
  past: "Vergangen",
};
const groupOrder: PublicPlanGroupKey[] = ["current", "future", "past"];

export function readPublicFilterOptions(sqlite: Database.Database) {
  const areas = sqlite.prepare(`SELECT DISTINCT area.name AS value FROM courses course
    JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    WHERE course.published_at IS NOT NULL ORDER BY value COLLATE NOCASE`).all() as { value: string }[];
  const programs = sqlite.prepare(`SELECT DISTINCT program.abbreviation AS value, program.name FROM courses course
    JOIN programs program ON program.id = course.program_id
    WHERE course.published_at IS NOT NULL ORDER BY program.name COLLATE NOCASE, value COLLATE NOCASE`)
    .all() as { value: string; name: string }[];
  const years = sqlite.prepare(`SELECT DISTINCT CAST(substr(study_start, 1, 4) AS INTEGER) AS value FROM courses
    WHERE published_at IS NOT NULL ORDER BY value DESC`).all() as { value: number }[];
  return {
    areas: areas.map(({ value }) => value),
    programs: programs.map(({ value, name }) => ({ value, label: `${value} — ${name}` })),
    years: years.map(({ value }) => value),
  };
}

type PublicCourseRow = PublicCourse & { groupKey: PublicPlanGroupKey };
type StoredEventRow = Omit<CourseEvent, "courseIds" | "provisional"> & { courseId: string; provisional: number };

function normalizeFilters(filters: PublicFilters): PublicFilters {
  const normalized: PublicFilters = {};
  for (const key of filterKeys) {
    const value = filters[key]?.trim();
    if (value) normalized[key] = value;
  }
  return normalized;
}

function yearParameter(year: string | undefined): number | null {
  if (!year) return null;
  return /^\d{4}$/.test(year) ? Number(year) : -1;
}

function afterCodePrefix(prefix: string): string {
  return `${prefix}\u{10FFFF}`;
}

const matchingCoursesSql = `
  FROM courses course
  JOIN programs program ON program.id = course.program_id
  JOIN areas area ON area.id = program.area_id
  WHERE course.published_at IS NOT NULL
    AND (? IS NULL OR area.name = ?)
    AND (? IS NULL OR program.abbreviation = ? COLLATE NOCASE)
    AND (? IS NULL OR CAST(substr(course.study_start, 1, 4) AS INTEGER) = ?)
    AND (? IS NULL OR (course.normalized_code >= ? AND course.normalized_code < ?))
`;

function matchingCourseParameters(filters: PublicFilters, coursePrefix: string | null) {
  const year = yearParameter(filters.year);
  return [
    filters.area ?? null, filters.area ?? null,
    filters.program ?? null, filters.program ?? null,
    year, year,
    coursePrefix, coursePrefix, coursePrefix && afterCodePrefix(coursePrefix),
  ];
}

const courseOrderSql = `
  ORDER BY CASE groupKey WHEN 'current' THEN 0 WHEN 'future' THEN 1 ELSE 2 END,
    CASE WHEN groupKey = 'future' THEN year END ASC,
    CASE WHEN groupKey <> 'future' THEN year END DESC,
    code COLLATE NOCASE ASC
`;

export function searchPublicPlans(
  sqlite: Database.Database,
  request: PublicFilters & { page?: string },
  today: string,
): PublicSearchResult {
  const filters = normalizeFilters(request);
  if (filters.program) {
    const abbreviation = sqlite.prepare(`SELECT program.abbreviation FROM programs program
      JOIN courses course ON course.program_id = program.id
      WHERE course.published_at IS NOT NULL AND program.abbreviation = ? COLLATE NOCASE LIMIT 1`)
      .pluck().get(filters.program) as string | undefined;
    if (abbreviation) filters.program = abbreviation;
  }
  const coursePrefix = normalizeCodePrefix(filters.course);
  const parameters = matchingCourseParameters(filters, coursePrefix);
  const total = (sqlite.prepare(`SELECT count(*) AS count ${matchingCoursesSql}`).get(...parameters) as { count: number }).count;
  const pages = Math.max(Math.ceil(total / plansPerPage), 1);
  const page = Math.min(Math.max(Math.trunc(Number(request.page)) || 1, 1), pages);
  const rows = sqlite.prepare(`SELECT course.id, course.code, area.name AS area, program.name AS program,
      program.abbreviation AS programAbbreviation,
      course.study_start AS studyStart, course.study_end AS studyEnd, program.semesters,
      CAST(substr(course.study_start, 1, 4) AS INTEGER) AS year,
      CASE WHEN course.study_start > ? THEN 'future' WHEN course.study_end < ? THEN 'past' ELSE 'current' END AS groupKey
      ${matchingCoursesSql} ${courseOrderSql} LIMIT ? OFFSET ?`)
    .all(today, today, ...parameters, plansPerPage, (page - 1) * plansPerPage) as PublicCourseRow[];
  const grouped: Record<PublicPlanGroupKey, PublicCourse[]> = { current: [], future: [], past: [] };
  for (const { groupKey, ...course } of rows) grouped[groupKey].push(course);
  return { groups: groupOrder.map((key) => ({ key, label: groupLabels[key], courses: grouped[key] })), filters, total, page, pages };
}

function cutQuery(cut: PublicCut): { sql: string; parameters: unknown[] } | null {
  switch (cut.kind) {
    case "course": {
      const code = normalizeCourseCode(cut.code);
      return code ? { sql: "course.normalized_code = ?", parameters: [code] } : null;
    }
    case "year": return { sql: "CAST(substr(course.study_start, 1, 4) AS INTEGER) = ?", parameters: [cut.year] };
    case "area": return { sql: "area.name = ? AND CAST(substr(course.study_start, 1, 4) AS INTEGER) = ?", parameters: [cut.name, cut.year] };
    case "program": return { sql: "program.abbreviation = ? COLLATE NOCASE AND CAST(substr(course.study_start, 1, 4) AS INTEGER) = ?", parameters: [cut.abbreviation, cut.year] };
  }
}

function readCoursesForCut(sqlite: Database.Database, cut: PublicCut): PublicCourse[] {
  const query = cutQuery(cut);
  if (!query) return [];
  return sqlite.prepare(`SELECT course.id, course.code, area.name AS area, program.name AS program,
      program.abbreviation AS programAbbreviation,
      course.study_start AS studyStart, course.study_end AS studyEnd, program.semesters,
      CAST(substr(course.study_start, 1, 4) AS INTEGER) AS year
    FROM courses course JOIN programs program ON program.id = course.program_id
    JOIN areas area ON area.id = program.area_id
    WHERE course.published_at IS NOT NULL AND ${query.sql}
    ORDER BY course.code COLLATE NOCASE`).all(...query.parameters) as PublicCourse[];
}

function readDetailForCourses(sqlite: Database.Database, courses: PublicCourse[]) {
  const ids = courses.map((course) => course.id);
  const placeholders = ids.map(() => "?").join(", ");
  const phases = sqlite.prepare(`SELECT course_id AS courseId, semester, phase_type AS type,
      start_date AS startDate, end_date AS endDate FROM course_phases
    WHERE course_id IN (${placeholders}) ORDER BY semester, start_date, end_date`).all(...ids) as CoursePhase[];
  const events = sqlite.prepare(`SELECT id, course_id AS courseId, title, description, category,
      start_date AS startDate, end_date AS endDate, provisional FROM course_events
    WHERE course_id IN (${placeholders}) ORDER BY start_date, title COLLATE NOCASE, id`).all(...ids) as StoredEventRow[];
  return {
    phases,
    events: events.map(({ courseId, provisional, ...event }) => ({ ...event, provisional: Boolean(provisional), courseIds: [courseId] })),
  };
}

export function readPublicCut(sqlite: Database.Database, cut: PublicCut): PublicCutDetail | null {
  const courses = readCoursesForCut(sqlite, cut);
  if (!courses.length) return null;
  const canonicalCut = cut.kind === "course"
    ? { kind: "course" as const, code: courses[0].code }
    : cut.kind === "program"
      ? { kind: "program" as const, year: cut.year, abbreviation: courses[0].programAbbreviation, name: courses[0].program }
      : cut;
  return { cut: canonicalCut, courses, ...readDetailForCourses(sqlite, courses) };
}
