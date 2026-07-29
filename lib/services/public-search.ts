import type Database from "better-sqlite3";

import type { PublicCut } from "@/lib/domain/public-cut";
import { normalizeCodePrefix, normalizeCourseCode } from "@/lib/domain/course-code";
import type { DraftCourse, DraftEvent, DraftPhase } from "@/lib/domain/publication";

/** Server-side pagination of the public search (MVP-SPEZIFIKATION.md). */
export const plansPerPage = 25;

export interface PublicFilters {
  area?: string;
  program?: string;
  year?: string;
  course?: string;
}

/** The filter keys in the order the search form and the active-filter summary list them. */
export const filterKeys = ["area", "program", "year", "course"] as const;

/** A course exactly as its published snapshot names it, enriched with the two designations that address its cuts. */
export type PublicCourse = DraftCourse & { area: string; program: string; year: number };

export type PublicPlanGroupKey = "current" | "future" | "past";

export interface PublicPlanGroup {
  key: PublicPlanGroupKey;
  label: string;
  courses: PublicCourse[];
}

export interface PublicSearchResult {
  groups: PublicPlanGroup[];
  /** The filters as they were applied, with blank values dropped: what the view shows and what its links carry. */
  filters: PublicFilters;
  total: number;
  page: number;
  pages: number;
}

/** Everything a public course or multi-course cut needs to render the same matrix and event list. */
export interface PublicCutDetail {
  cut: PublicCut;
  courses: PublicCourse[];
  phases: DraftPhase[];
  events: DraftEvent[];
}

const groupLabels: Record<PublicPlanGroupKey, string> = {
  current: "Aktuell laufend",
  future: "Zukünftig",
  past: "Vergangen",
};

/** The groups in the order the public search shows them (MVP-SPEZIFIKATION.md). */
const groupOrder: PublicPlanGroupKey[] = ["current", "future", "past"];

/**
 * The reference day of every public view: the current calendar day in Europe/Berlin, determined on the server and
 * independent of the server or browser time zone (MVP-SPEZIFIKATION.md).
 */
export function berlinCalendarDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The filter options are all and only values carried by still-published snapshots. */
export function readPublicFilterOptions(sqlite: Database.Database) {
  const areas = sqlite
    .prepare(`SELECT DISTINCT area_name AS value FROM published_courses
      ORDER BY value COLLATE NOCASE`)
    .all() as { value: string }[];
  const programs = sqlite
    .prepare("SELECT DISTINCT program_name AS value FROM published_courses ORDER BY value COLLATE NOCASE")
    .all() as { value: string }[];
  const years = sqlite
    .prepare("SELECT DISTINCT CAST(substr(study_start, 1, 4) AS INTEGER) AS value FROM published_courses ORDER BY value DESC")
    .all() as { value: number }[];
  return {
    areas: areas.map((option) => option.value),
    programs: programs.map((option) => option.value),
    years: years.map((option) => option.value),
  };
}

type PublicCourseRow = PublicCourse & { groupKey: PublicPlanGroupKey };
type EventCourseRow = { eventId: string; courseId: string };
type PublishedEventRow = Omit<DraftEvent, "courseIds" | "provisional"> & { provisional: number };

/** The filters as the search applies them: values holding only whitespace count as unset. */
function normalizeFilters(filters: PublicFilters): PublicFilters {
  const normalized: PublicFilters = {};
  for (const key of filterKeys) {
    const value = filters[key]?.trim();
    if (value) normalized[key] = value;
  }
  return normalized;
}

/** A malformed year is deliberately a value that cannot match, never an omitted filter. */
function yearParameter(year: string | undefined): number | null {
  if (!year) return null;
  return /^\d{4}$/.test(year) ? Number(year) : -1;
}

/** The exclusive upper bound of a course-code prefix, which keeps wildcard characters literal in SQLite. */
function afterCodePrefix(prefix: string): string {
  return `${prefix}\u{10FFFF}`;
}

const matchingCoursesSql = `
  FROM published_courses snapshot
  JOIN published_course_search_keys search_key ON search_key.published_course_id = snapshot.id
  WHERE (? IS NULL OR snapshot.area_name = ?)
    AND (? IS NULL OR snapshot.program_name = ?)
    AND (? IS NULL OR CAST(substr(snapshot.study_start, 1, 4) AS INTEGER) = ?)
    AND (? IS NULL OR (search_key.normalized_code >= ? AND search_key.normalized_code < ?))
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

/** The public search works on courses, not the former internal block-plan grouping. */
export function searchPublicPlans(
  sqlite: Database.Database,
  request: PublicFilters & { page?: string },
  today: string,
): PublicSearchResult {
  const filters = normalizeFilters(request);
  const coursePrefix = normalizeCodePrefix(filters.course);
  const parameters = matchingCourseParameters(filters, coursePrefix);
  const total = (sqlite.prepare(`SELECT count(*) AS count ${matchingCoursesSql}`).get(...parameters) as { count: number }).count;
  const pages = Math.max(Math.ceil(total / plansPerPage), 1);
  const page = Math.min(Math.max(Math.trunc(Number(request.page)) || 1, 1), pages);
  const rows = sqlite.prepare(`SELECT snapshot.id, snapshot.code, snapshot.area_name AS area, snapshot.program_name AS program,
      snapshot.study_start AS studyStart, snapshot.study_end AS studyEnd, snapshot.semesters,
      CAST(substr(snapshot.study_start, 1, 4) AS INTEGER) AS year,
      CASE WHEN snapshot.study_start > ? THEN 'future' WHEN snapshot.study_end < ? THEN 'past' ELSE 'current' END AS groupKey
      ${matchingCoursesSql} ${courseOrderSql} LIMIT ? OFFSET ?`)
    .all(today, today, ...parameters, plansPerPage, (page - 1) * plansPerPage) as PublicCourseRow[];
  const grouped: Record<PublicPlanGroupKey, PublicCourse[]> = { current: [], future: [], past: [] };
  for (const { groupKey, ...course } of rows) grouped[groupKey].push(course);
  return {
    groups: groupOrder.map((key) => ({ key, label: groupLabels[key], courses: grouped[key] })),
    filters,
    total,
    page,
    pages,
  };
}

function cutQuery(cut: PublicCut): { sql: string; parameters: unknown[] } | null {
  switch (cut.kind) {
    case "course": {
      const code = normalizeCourseCode(cut.code);
      return code ? {
        sql: `JOIN published_course_search_keys search_key ON search_key.published_course_id = snapshot.id
          WHERE search_key.normalized_code = ?`,
        parameters: [code],
      } : null;
    }
    case "year":
      return { sql: "WHERE CAST(substr(snapshot.study_start, 1, 4) AS INTEGER) = ?", parameters: [cut.year] };
    case "area":
      return {
        sql: "WHERE snapshot.area_name = ? AND CAST(substr(snapshot.study_start, 1, 4) AS INTEGER) = ?",
        parameters: [cut.name, cut.year],
      };
    case "program":
      return {
        sql: "WHERE snapshot.program_name = ? AND CAST(substr(snapshot.study_start, 1, 4) AS INTEGER) = ?",
        parameters: [cut.name, cut.year],
      };
  }
}

function readCoursesForCut(sqlite: Database.Database, cut: PublicCut): PublicCourse[] {
  const query = cutQuery(cut);
  if (!query) return [];
  return sqlite.prepare(`SELECT snapshot.id, snapshot.code, snapshot.area_name AS area, snapshot.program_name AS program,
      snapshot.study_start AS studyStart, snapshot.study_end AS studyEnd, snapshot.semesters,
      CAST(substr(snapshot.study_start, 1, 4) AS INTEGER) AS year
    FROM published_courses snapshot
    ${query.sql}
    ORDER BY snapshot.code COLLATE NOCASE`)
    .all(...query.parameters) as PublicCourse[];
}

function readDetailForCourses(sqlite: Database.Database, courses: PublicCourse[]) {
  const ids = courses.map((course) => course.id);
  const placeholders = ids.map(() => "?").join(", ");
  const phases = sqlite.prepare(`SELECT published_course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate
      FROM published_phases WHERE published_course_id IN (${placeholders}) ORDER BY semester, start_date, end_date`)
    .all(...ids) as DraftPhase[];
  const events = sqlite.prepare(`SELECT DISTINCT event.id, event.title, event.description, event.category,
      event.start_date AS startDate, event.end_date AS endDate, event.provisional
    FROM published_events event
    WHERE event.published_course_id IN (${placeholders})
    ORDER BY event.start_date, event.title COLLATE NOCASE, event.id`)
    .all(...ids) as PublishedEventRow[];
  const eventCourses = sqlite.prepare(`SELECT id AS eventId, published_course_id AS courseId FROM published_events
    WHERE published_course_id IN (${placeholders}) ORDER BY id`)
    .all(...ids) as EventCourseRow[];
  const courseIdsByEvent = new Map<string, string[]>();
  for (const { eventId, courseId } of eventCourses) {
    const courseIds = courseIdsByEvent.get(eventId) ?? [];
    courseIds.push(courseId);
    courseIdsByEvent.set(eventId, courseIds);
  }
  return {
    phases,
    events: events.map((event) => ({ ...event, provisional: Boolean(event.provisional), courseIds: courseIdsByEvent.get(event.id) ?? [] })),
  };
}

/**
 * Reads one published course or one published cut. Every query starts at snapshots and joins only published versions;
 * an absent result therefore makes unknown, draft-only and withdrawn addresses publicly indistinguishable.
 */
export function readPublicCut(sqlite: Database.Database, cut: PublicCut): PublicCutDetail | null {
  const courses = readCoursesForCut(sqlite, cut);
  if (!courses.length) return null;
  const canonicalCut = cut.kind === "course" ? { kind: "course" as const, code: courses[0].code } : cut;
  return { cut: canonicalCut, courses, ...readDetailForCourses(sqlite, courses) };
}
