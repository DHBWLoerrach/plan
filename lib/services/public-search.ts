import type Database from "better-sqlite3";

import { normalizeCodePrefix } from "@/lib/domain/course-code";
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

export type PublicCourse = DraftCourse & { program: string };

export interface PublicPlan {
  id: string;
  name: string;
  area: string;
  year: number;
  courses: PublicCourse[];
}

export type PublicPlanGroupKey = "current" | "future" | "past";

export interface PublicPlanGroup {
  key: PublicPlanGroupKey;
  label: string;
  plans: PublicPlan[];
}

export interface PublicSearchResult {
  groups: PublicPlanGroup[];
  /** The filters as they were applied, with blank values dropped: what the view shows and what its links carry. */
  filters: PublicFilters;
  total: number;
  page: number;
  pages: number;
}

export type PublicPlanDetail = PublicPlan & { phases: DraftPhase[]; events: DraftEvent[] };

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

/**
 * The filter options, formed exclusively from the master data snapshots of existing published versions. Plans of areas
 * and programs renamed later therefore stay findable under the designation they were published with, and no option
 * without a result is offered (MVP-SPEZIFIKATION.md).
 */
export function readPublicFilterOptions(sqlite: Database.Database) {
  const areas = sqlite
    .prepare(`SELECT DISTINCT version.area_name AS value FROM published_versions version
      WHERE EXISTS (SELECT 1 FROM published_course_snapshots snapshot WHERE snapshot.version_id = version.id)
      ORDER BY version.area_name COLLATE NOCASE`)
    .all() as { value: string }[];
  const programs = sqlite
    .prepare("SELECT DISTINCT program_name AS value FROM published_course_snapshots ORDER BY program_name COLLATE NOCASE")
    .all() as { value: string }[];
  const years = sqlite
    .prepare("SELECT DISTINCT CAST(substr(study_start, 1, 4) AS INTEGER) AS value FROM published_course_snapshots ORDER BY value DESC")
    .all() as { value: number }[];
  return {
    areas: areas.map((option) => option.value),
    programs: programs.map((option) => option.value),
    years: years.map((option) => option.value),
  };
}

type PublicPlanRow = {
  versionId: string;
  blockPlanId: string;
  name: string;
  area: string;
  year: number;
  groupKey: PublicPlanGroupKey;
};

type PublicCourseRow = {
  versionId: string;
  id: string;
  code: string;
  program: string;
  studyStart: string;
  studyEnd: string;
  semesters: number;
};

/** The year of studies: the calendar year the studies begin in; it is derived, never stored (FACHLICHE_REGELN.md). */
function studyStartYear(courses: PublicCourse[]): number {
  return Number(courses.reduce((earliest, course) => (course.studyStart < earliest ? course.studyStart : earliest), courses[0].studyStart).slice(0, 4));
}

/** The filters as the search applies them: values holding only whitespace count as unset. */
function normalizeFilters(filters: PublicFilters): PublicFilters {
  const normalized: PublicFilters = {};
  for (const key of filterKeys) {
    const value = filters[key]?.trim();
    if (value) normalized[key] = value;
  }
  return normalized;
}

const matchingPlansSql = `
  WITH matching_plans AS (
    SELECT version.id AS versionId, version.block_plan_id AS blockPlanId, version.block_plan_name AS name,
      version.area_name AS area, CAST(substr(MIN(snapshot.study_start), 1, 4) AS INTEGER) AS year,
      CASE
        WHEN MIN(snapshot.study_start) > ? THEN 'future'
        WHEN MAX(snapshot.study_end) < ? THEN 'past'
        ELSE 'current'
      END AS groupKey
    FROM published_versions version
    JOIN published_course_snapshots snapshot ON snapshot.version_id = version.id
    WHERE (? IS NULL OR version.area_name = ?)
      AND (? IS NULL OR EXISTS (
        SELECT 1 FROM published_course_snapshots filtered_snapshot
        WHERE filtered_snapshot.version_id = version.id AND filtered_snapshot.program_name = ?
      ))
      AND (? IS NULL OR EXISTS (
        SELECT 1 FROM published_course_search_keys search_key
        JOIN published_course_snapshots filtered_snapshot ON filtered_snapshot.id = search_key.course_snapshot_id
        WHERE filtered_snapshot.version_id = version.id AND search_key.normalized_code LIKE ? || '%'
      ))
    GROUP BY version.id
    HAVING (? IS NULL OR CAST(substr(MIN(snapshot.study_start), 1, 4) AS INTEGER) = ?)
  )
`;

const planOrderSql = `
  ORDER BY CASE groupKey WHEN 'current' THEN 0 WHEN 'future' THEN 1 ELSE 2 END,
    CASE WHEN groupKey = 'future' THEN year END ASC,
    CASE WHEN groupKey <> 'future' THEN year END DESC,
    name COLLATE NOCASE ASC, blockPlanId ASC
`;

function matchingPlanParameters(filters: PublicFilters, coursePrefix: string | null, today: string) {
  const year = filters.year ? Number(filters.year) : null;
  return [
    today, today,
    filters.area ?? null, filters.area ?? null,
    filters.program ?? null, filters.program ?? null,
    coursePrefix, coursePrefix,
    year, year,
  ];
}

/** The page's plans are filtered, grouped and ordered by SQLite before their visible courses are read. */
function readMatchingPlanPage(
  sqlite: Database.Database,
  filters: PublicFilters,
  coursePrefix: string | null,
  today: string,
  limit: number,
  offset: number,
): PublicPlanRow[] {
  return sqlite.prepare(`${matchingPlansSql} SELECT * FROM matching_plans ${planOrderSql} LIMIT ? OFFSET ?`)
    .all(...matchingPlanParameters(filters, coursePrefix, today), limit, offset) as PublicPlanRow[];
}

function countMatchingPlans(sqlite: Database.Database, filters: PublicFilters, coursePrefix: string | null, today: string): number {
  return (sqlite.prepare(`${matchingPlansSql} SELECT count(*) AS count FROM matching_plans`)
    .get(...matchingPlanParameters(filters, coursePrefix, today)) as { count: number }).count;
}

function readCoursesForPlanPage(sqlite: Database.Database, versionIds: string[]): Map<string, PublicCourse[]> {
  if (!versionIds.length) return new Map();
  const rows = sqlite.prepare(`SELECT version_id AS versionId, id, code, program_name AS program,
      study_start AS studyStart, study_end AS studyEnd, semesters
    FROM published_course_snapshots
    WHERE version_id IN (${versionIds.map(() => "?").join(", ")})
    ORDER BY version_id, code COLLATE NOCASE`).all(...versionIds) as PublicCourseRow[];
  const coursesByVersion = new Map<string, PublicCourse[]>();
  for (const row of rows) {
    const courses = coursesByVersion.get(row.versionId) ?? [];
    courses.push({
      id: row.id,
      code: row.code,
      program: row.program,
      studyStart: row.studyStart,
      studyEnd: row.studyEnd,
      semesters: row.semesters,
    });
    coursesByVersion.set(row.versionId, courses);
  }
  return coursesByVersion;
}

/**
 * The published plans matching the filters, in their groups and on the requested page. All filters combine with AND;
 * the reference day decides the grouping.
 */
export function searchPublicPlans(
  sqlite: Database.Database,
  request: PublicFilters & { page?: string },
  today: string,
): PublicSearchResult {
  const filters = normalizeFilters(request);
  const coursePrefix = normalizeCodePrefix(filters.course);
  const total = countMatchingPlans(sqlite, filters, coursePrefix, today);
  const pages = Math.max(Math.ceil(total / plansPerPage), 1);
  const page = Math.min(Math.max(Math.trunc(Number(request.page)) || 1, 1), pages);
  const matchingPlans = readMatchingPlanPage(sqlite, filters, coursePrefix, today, plansPerPage, (page - 1) * plansPerPage);
  const coursesByVersion = readCoursesForPlanPage(sqlite, matchingPlans.map((plan) => plan.versionId));
  const grouped: Record<PublicPlanGroupKey, PublicPlan[]> = { current: [], future: [], past: [] };
  for (const plan of matchingPlans) {
    grouped[plan.groupKey].push({
      id: plan.blockPlanId,
      name: plan.name,
      area: plan.area,
      year: plan.year,
      courses: coursesByVersion.get(plan.versionId) ?? [],
    });
  }
  return {
    groups: groupOrder.map((key) => ({ key, label: groupLabels[key], plans: grouped[key] })),
    filters,
    total,
    page,
    pages,
  };
}

/**
 * A published block plan with everything the public detail view shows. Without a published version — withdrawn, never
 * published or an unknown id — it reads nothing, so all three cases stay publicly indistinguishable
 * (MVP-SPEZIFIKATION.md).
 */
export function readPublicPlan(sqlite: Database.Database, blockPlanId: string): PublicPlanDetail | null {
  const version = sqlite
    .prepare("SELECT id, block_plan_name AS name, area_name AS area FROM published_versions WHERE block_plan_id = ?")
    .get(blockPlanId) as { id: string; name: string; area: string } | undefined;
  if (!version) return null;
  const courses = sqlite
    .prepare(`SELECT id, code, program_name AS program, study_start AS studyStart, study_end AS studyEnd, semesters
      FROM published_course_snapshots WHERE version_id = ? ORDER BY code COLLATE NOCASE`)
    .all(version.id) as PublicCourse[];
  if (!courses.length) return null;
  const phases = sqlite
    .prepare(`SELECT course_snapshot_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate
      FROM published_phases WHERE version_id = ? ORDER BY semester, start_date`)
    .all(version.id) as DraftPhase[];
  const events = sqlite
    .prepare(`SELECT id, title, description, category, start_date AS startDate, end_date AS endDate, provisional
      FROM published_events WHERE version_id = ? ORDER BY start_date, title COLLATE NOCASE`)
    .all(version.id) as (Omit<DraftEvent, "courseIds" | "provisional"> & { provisional: number })[];
  const affectedCourses = sqlite.prepare(`SELECT link.course_snapshot_id AS courseId FROM published_event_courses link
    JOIN published_course_snapshots snapshot ON snapshot.id = link.course_snapshot_id
    WHERE link.event_id = ? ORDER BY snapshot.code COLLATE NOCASE`);
  return {
    id: blockPlanId,
    name: version.name,
    area: version.area,
    year: studyStartYear(courses),
    courses,
    phases,
    events: events.map((event) => ({
      ...event,
      provisional: Boolean(event.provisional),
      courseIds: (affectedCourses.all(event.id) as { courseId: string }[]).map((row) => row.courseId),
    })),
  };
}
