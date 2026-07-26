import type Database from "better-sqlite3";

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

type PlanRow = {
  blockPlanId: string;
  name: string;
  area: string;
  id: string;
  code: string;
  program: string;
  studyStart: string;
  studyEnd: string;
  semesters: number;
};

/**
 * Every published plan with its published courses. A published version always carries at least one course snapshot, so
 * the join loses nothing: a plan without publicly visible courses could neither be grouped nor dated.
 */
function readPublishedPlans(sqlite: Database.Database): PublicPlan[] {
  const rows = sqlite
    .prepare(`SELECT version.block_plan_id AS blockPlanId, version.block_plan_name AS name, version.area_name AS area,
        snapshot.id, snapshot.code, snapshot.program_name AS program,
        snapshot.study_start AS studyStart, snapshot.study_end AS studyEnd, snapshot.semesters
      FROM published_versions version
      JOIN published_course_snapshots snapshot ON snapshot.version_id = version.id
      ORDER BY snapshot.code COLLATE NOCASE`)
    .all() as PlanRow[];
  const plans = new Map<string, PublicPlan>();
  for (const row of rows) {
    const plan = plans.get(row.blockPlanId) ?? { id: row.blockPlanId, name: row.name, area: row.area, year: 0, courses: [] };
    plan.courses.push({
      id: row.id,
      code: row.code,
      program: row.program,
      studyStart: row.studyStart,
      studyEnd: row.studyEnd,
      semesters: row.semesters,
    });
    plans.set(row.blockPlanId, plan);
  }
  for (const plan of plans.values()) plan.year = studyStartYear(plan.courses);
  return [...plans.values()];
}

/** The year of studies: the calendar year the studies begin in; it is derived, never stored (FACHLICHE_REGELN.md). */
function studyStartYear(courses: PublicCourse[]): number {
  return Number(courses.reduce((earliest, course) => (course.studyStart < earliest ? course.studyStart : earliest), courses[0].studyStart).slice(0, 4));
}

/**
 * Exactly one group per plan: future when all study periods of its publicly visible courses begin in the future, past
 * when all have ended, running in every other case (MVP-SPEZIFIKATION.md).
 */
function groupOfPlan(plan: PublicPlan, today: string): PublicPlanGroupKey {
  if (plan.courses.every((course) => course.studyStart > today)) return "future";
  if (plan.courses.every((course) => course.studyEnd < today)) return "past";
  return "current";
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

function matchesFilters(plan: PublicPlan, filters: PublicFilters, coursePrefix: string | undefined): boolean {
  if (filters.area && plan.area !== filters.area) return false;
  if (filters.year && plan.year !== Number(filters.year)) return false;
  if (filters.program && !plan.courses.some((course) => course.program === filters.program)) return false;
  // The course filter searches the beginning of the course code without regard to case, so `tif24` finds both
  // `TIF24A` and `TIF24B` (MVP-SPEZIFIKATION.md).
  if (coursePrefix && !plan.courses.some((course) => course.code.toLocaleLowerCase("de-DE").startsWith(coursePrefix))) return false;
  return true;
}

/** Within a group: year first, then the published display name, then the stable block plan id (MVP-SPEZIFIKATION.md). */
function comparePlans(left: PublicPlan, right: PublicPlan, yearOrder: 1 | -1): number {
  return (left.year - right.year) * yearOrder || left.name.localeCompare(right.name, "de") || left.id.localeCompare(right.id);
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
  const coursePrefix = filters.course?.toLocaleLowerCase("de-DE");
  const matching = readPublishedPlans(sqlite).filter((plan) => matchesFilters(plan, filters, coursePrefix));
  const grouped: Record<PublicPlanGroupKey, PublicPlan[]> = { current: [], future: [], past: [] };
  for (const plan of matching) grouped[groupOfPlan(plan, today)].push(plan);
  grouped.current.sort((left, right) => comparePlans(left, right, -1));
  grouped.future.sort((left, right) => comparePlans(left, right, 1));
  grouped.past.sort((left, right) => comparePlans(left, right, -1));

  const ordered = groupOrder.flatMap((key) => grouped[key]);
  const pages = Math.max(Math.ceil(ordered.length / plansPerPage), 1);
  const page = Math.min(Math.max(Math.trunc(Number(request.page)) || 1, 1), pages);
  const visible = new Set(ordered.slice((page - 1) * plansPerPage, page * plansPerPage));
  return {
    groups: groupOrder.map((key) => ({ key, label: groupLabels[key], plans: grouped[key].filter((plan) => visible.has(plan)) })),
    filters,
    total: ordered.length,
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
