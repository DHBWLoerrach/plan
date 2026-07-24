import "server-only";

import { sqlite } from "@/lib/db";
import type { DraftCourse, DraftEvent, DraftPhase } from "@/lib/domain/publication";

export interface PublicFilters { area?: string; program?: string; year?: string; course?: string; page?: string }
export interface PublicPlan { id: string; name: string; area: string; year: number; courses: { code: string; program: string; studyStart: string; studyEnd: string }[] }

export function berlinToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).reduce((date, part) => part.type === "literal" ? date : { ...date, [part.type]: part.value }, {} as Record<string, string>);
}

function toIsoDate(parts: Record<string, string>) { return `${parts.year}-${parts.month}-${parts.day}`; }

function planGroup(plan: PublicPlan, today: string): "current" | "future" | "past" {
  if (plan.courses.every((course) => course.studyStart > today)) return "future";
  if (plan.courses.every((course) => course.studyEnd < today)) return "past";
  return "current";
}

function getPlanCourses(versionId: string): PublicPlan["courses"] {
  return sqlite.prepare(`SELECT code, program_name AS program, study_start AS studyStart, study_end AS studyEnd FROM published_course_snapshots WHERE version_id = ? ORDER BY code COLLATE NOCASE`).all(versionId) as PublicPlan["courses"];
}

export function getFilterOptions() {
  return {
    areas: sqlite.prepare("SELECT DISTINCT area_name AS value FROM published_versions ORDER BY area_name COLLATE NOCASE").all() as { value: string }[],
    programs: sqlite.prepare("SELECT DISTINCT program_name AS value FROM published_course_snapshots ORDER BY program_name COLLATE NOCASE").all() as { value: string }[],
    years: sqlite.prepare("SELECT DISTINCT CAST(substr(study_start, 1, 4) AS INTEGER) AS value FROM published_course_snapshots ORDER BY value DESC").all() as { value: number }[],
  };
}

export function listPublicPlans(filters: PublicFilters) {
  const rows = sqlite.prepare("SELECT id, block_plan_id AS blockPlanId, block_plan_name AS name, area_name AS area FROM published_versions").all() as { id: string; blockPlanId: string; name: string; area: string }[];
  const plans = rows.map((row) => { const courses = getPlanCourses(row.id); return { id: row.blockPlanId, name: row.name, area: row.area, year: Number(courses[0]?.studyStart.slice(0, 4)), courses }; })
    .filter((plan) => !filters.area || plan.area === filters.area)
    .filter((plan) => !filters.year || plan.year === Number(filters.year))
    .filter((plan) => !filters.program || plan.courses.some((course) => course.program === filters.program))
    .filter((plan) => !filters.course || plan.courses.some((course) => course.code.toLocaleLowerCase("de-DE").startsWith(filters.course!.toLocaleLowerCase("de-DE"))));
  const today = toIsoDate(berlinToday());
  const groups: Record<"current" | "future" | "past", PublicPlan[]> = { current: [], future: [], past: [] };
  for (const plan of plans) groups[planGroup(plan, today)].push(plan);
  groups.current.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  groups.future.sort((a, b) => a.year - b.year || a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  groups.past.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  const all = [...groups.current, ...groups.future, ...groups.past];
  const pages = Math.max(Math.ceil(all.length / 25), 1);
  const page = Math.min(Math.max(Number(filters.page) || 1, 1), pages);
  const visiblePlans = all.slice((page - 1) * 25, page * 25);
  const visibleGroups: typeof groups = { current: [], future: [], past: [] };
  for (const plan of visiblePlans) visibleGroups[planGroup(plan, today)].push(plan);
  return { groups: visibleGroups, total: all.length, page, pages };
}

export function getPublicPlan(blockPlanId: string): (PublicPlan & { courses: (DraftCourse & { program: string })[]; phases: DraftPhase[]; events: DraftEvent[] }) | null {
  const version = sqlite.prepare("SELECT id, block_plan_name AS name, area_name AS area FROM published_versions WHERE block_plan_id = ?").get(blockPlanId) as { id: string; name: string; area: string } | undefined;
  if (!version) return null;
  const courses = sqlite.prepare(`SELECT id, code, study_start AS studyStart, study_end AS studyEnd, semesters, program_name AS program FROM published_course_snapshots WHERE version_id = ? ORDER BY code COLLATE NOCASE`).all(version.id) as (DraftCourse & { program: string })[];
  const phases = sqlite.prepare("SELECT course_snapshot_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM published_phases WHERE version_id = ?").all(version.id) as DraftPhase[];
  const eventRows = sqlite.prepare("SELECT id, title, description, category, start_date AS startDate, end_date AS endDate, provisional FROM published_events WHERE version_id = ? ORDER BY start_date, title").all(version.id) as Omit<DraftEvent, "courseIds">[];
  const getEventCourses = sqlite.prepare("SELECT course_snapshot_id AS courseId FROM published_event_courses WHERE event_id = ?");
  return { id: blockPlanId, name: version.name, area: version.area, year: Number(courses[0]?.studyStart.slice(0, 4)), courses, phases, events: eventRows.map((event) => ({ ...event, provisional: Boolean(event.provisional), courseIds: (getEventCourses.all(event.id) as { courseId: string }[]).map((row) => row.courseId) })) };
}
