import "server-only";

import type Database from "better-sqlite3";

import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { matchesCodePrefix, normalizeCodePrefix } from "@/lib/domain/course-code";
import { type DraftEvent, type PlanPhase, getPublicationState } from "@/lib/domain/publication";
import { readPublicationPreview } from "@/lib/services/publication";

import { type AreaOption, manageableAreas } from "../data";

export type PlanCourse = { id: string; code: string; program: string; semesters: number; studyStart: string; studyEnd: string };
export type PlanSummary = { displayName: string; courseCodes: string[] };
export type BlockPlanState = ReturnType<typeof getPublicationState>;

/** The filters of the internal block plan list; several set filters narrow the list together. */
export type BlockPlanListFilters = {
  area: string | null;
  year: string | null;
  /** The beginning of a course code, matched without regard to case. */
  course: string | null;
  state: BlockPlanState | null;
};
export type BlockPlanSort = "draft" | "year" | "name";
export type BlockPlanListRow = {
  id: string;
  displayName: string;
  courseCodes: string[];
  areaId: string;
  areaName: string;
  /** The year of studies, derived from the assigned courses; `null` while a plan has none. */
  year: number | null;
  state: BlockPlanState;
  draftUpdatedAt: string;
  draftUpdatedBy: string | null;
};
export type BlockPlanListData = {
  /** The areas the account may filter by — its whole scope, as in the course list, not only areas holding plans. */
  areas: AreaOption[];
  years: number[];
  plans: BlockPlanListRow[];
};
export type IncompleteDraft = { id: string; displayName: string; issueCount: number };
export type InternalBlockPlanDetails = {
  id: string;
  name: string | null;
  areaName: string;
  draftUpdatedAt: string;
  hasEverBeenPublished: number;
  versionId: string | null;
  publishedAt: string | null;
  draftUpdatedBy: string | null;
};

export type { PlanPhase };

type AccountScope = { id: string; systemAdmin: boolean };
type PlanRow = {
  id: string;
  name: string | null;
  areaId: string;
  areaName: string;
  hasEverBeenPublished: number;
  versionId: string | null;
  draftUpdatedAt: string;
  draftUpdatedBy: string | null;
};

/**
 * The block plan list: the plans of the account's areas, the options its filters offer, and the requested reproducible
 * order. Every filter is applied on top of the area scope, so a filter naming a foreign area narrows the result
 * instead of widening it (FACHLICHE_REGELN.md).
 */
export function blockPlanListData(
  sqlite: Database.Database,
  account: AccountScope,
  filters: BlockPlanListFilters,
  sort: BlockPlanSort,
): BlockPlanListData {
  const scope = account.systemAdmin ? 1 : 0;
  const rows = sqlite.prepare(`SELECT plan.id, plan.name, plan.area_id AS areaId, area.name AS areaName,
      plan.has_ever_been_published AS hasEverBeenPublished, version.id AS versionId,
      plan.draft_updated_at AS draftUpdatedAt, editor.email AS draftUpdatedBy
    FROM block_plans plan JOIN areas area ON area.id = plan.area_id
    LEFT JOIN user editor ON editor.id = plan.draft_updated_by_account_id
    LEFT JOIN published_versions version ON version.block_plan_id = plan.id
    WHERE ? = 1 OR plan.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)`)
    .all(scope, account.id) as PlanRow[];
  const courses = sqlite.prepare(`SELECT course.block_plan_id AS blockPlanId, course.code, course.study_start AS studyStart
    FROM courses course JOIN block_plans plan ON plan.id = course.block_plan_id
    WHERE ? = 1 OR plan.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY course.code COLLATE NOCASE`).all(scope, account.id) as { blockPlanId: string; code: string; studyStart: string }[];

  const plans = rows.map((row) => {
    const assigned = courses.filter((course) => course.blockPlanId === row.id);
    return {
      id: row.id,
      displayName: blockPlanDisplayName(row.name, assigned),
      courseCodes: assigned.map((course) => course.code),
      areaId: row.areaId,
      areaName: row.areaName,
      // All courses of a block plan share their study period (FACHLICHE_REGELN.md), so the first one carries the year.
      year: assigned.length ? Number(assigned[0].studyStart.slice(0, 4)) : null,
      state: getPublicationState(Boolean(row.hasEverBeenPublished), Boolean(row.versionId)),
      draftUpdatedAt: row.draftUpdatedAt,
      draftUpdatedBy: row.draftUpdatedBy,
    } satisfies BlockPlanListRow;
  });

  const years = [...new Set(plans.flatMap((plan) => (plan.year === null ? [] : [plan.year])))].toSorted((left, right) => right - left);
  const coursePrefix = normalizeCodePrefix(filters.course);
  return {
    areas: manageableAreas(sqlite, account),
    years,
    plans: plans.filter((plan) => matchesPlanFilters(plan, filters, coursePrefix)).toSorted(planOrder(sort)),
  };
}

function matchesPlanFilters(plan: BlockPlanListRow, filters: BlockPlanListFilters, coursePrefix: string | null): boolean {
  if (filters.area && plan.areaId !== filters.area) return false;
  if (filters.year && String(plan.year) !== filters.year) return false;
  if (filters.state && plan.state !== filters.state) return false;
  if (coursePrefix && !plan.courseCodes.some((code) => matchesCodePrefix(code, coursePrefix))) return false;
  return true;
}

/** Every order ends with the stable block plan id, so the list never depends on insertion or query chance. */
function planOrder(sort: BlockPlanSort): (left: BlockPlanListRow, right: BlockPlanListRow) => number {
  const byName = (left: BlockPlanListRow, right: BlockPlanListRow) =>
    left.displayName.localeCompare(right.displayName, "de") || left.id.localeCompare(right.id);
  if (sort === "name") return byName;
  if (sort === "year") return (left, right) => (right.year ?? 0) - (left.year ?? 0) || byName(left, right);
  return (left, right) => right.draftUpdatedAt.localeCompare(left.draftUpdatedAt) || byName(left, right);
}

/**
 * The listed plans whose saved draft still violates publication rules, with the number of issues its preview would
 * show. The start page points at them so an incomplete draft is not only found when someone tries to publish it
 * (MVP-SPEZIFIKATION.md). Each plan is checked with the same read the preview uses; at the dimensions this MVP plans
 * for, that stays a handful of small local queries per plan.
 */
export function incompleteDrafts(sqlite: Database.Database, plans: BlockPlanListRow[]): IncompleteDraft[] {
  return plans.flatMap((plan) => {
    const issueCount = readPublicationPreview(sqlite, plan.id)?.issues.length ?? 0;
    return issueCount ? [{ id: plan.id, displayName: plan.displayName, issueCount }] : [];
  });
}

/** Workspace header data for a block plan the account may manage. */
export function findInternalBlockPlan(sqlite: Database.Database, blockPlanId: string, account: { id: string; systemAdmin: boolean }): InternalBlockPlanDetails | undefined {
  return sqlite.prepare(`SELECT plan.id, plan.name, area.name AS areaName, plan.draft_updated_at AS draftUpdatedAt,
      plan.has_ever_been_published AS hasEverBeenPublished, version.id AS versionId, version.published_at AS publishedAt,
      editor.email AS draftUpdatedBy
    FROM block_plans plan JOIN areas area ON area.id = plan.area_id
    LEFT JOIN user editor ON editor.id = plan.draft_updated_by_account_id
    LEFT JOIN published_versions version ON version.block_plan_id = plan.id
    WHERE plan.id = ? AND (? = 1 OR plan.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))`)
    .get(blockPlanId, account.systemAdmin ? 1 : 0, account.id) as InternalBlockPlanDetails | undefined;
}

/** The courses currently assigned to a block plan, in the order used for display and for the derived name. */
export function blockPlanCourses(sqlite: Database.Database, blockPlanId: string): PlanCourse[] {
  return sqlite.prepare(`SELECT course.id, course.code, program.name AS program, program.semesters,
      course.study_start AS studyStart, course.study_end AS studyEnd
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.block_plan_id = ? ORDER BY course.code COLLATE NOCASE`).all(blockPlanId) as PlanCourse[];
}

/** The saved course phases of a draft, ordered as the semester editor lists them. */
export function blockPlanDraftPhases(sqlite: Database.Database, blockPlanId: string): PlanPhase[] {
  return sqlite.prepare(`SELECT phase.id, phase.course_id AS courseId, phase.semester, phase.phase_type AS type,
      phase.start_date AS startDate, phase.end_date AS endDate, course.code
    FROM draft_phases phase JOIN courses course ON course.id = phase.course_id
    WHERE phase.block_plan_id = ? ORDER BY phase.semester, phase.start_date, course.code COLLATE NOCASE`).all(blockPlanId) as PlanPhase[];
}

/** The examination-relevant events of a draft in chronological order, each with the courses it affects. */
export function blockPlanDraftEvents(sqlite: Database.Database, blockPlanId: string): DraftEvent[] {
  const events = sqlite.prepare(`SELECT id, title, description, category, start_date AS startDate, end_date AS endDate, provisional
    FROM draft_events WHERE block_plan_id = ? ORDER BY start_date, title COLLATE NOCASE`).all(blockPlanId) as (Omit<DraftEvent, "courseIds" | "provisional"> & { provisional: number })[];
  const affectedCourses = sqlite.prepare(`SELECT link.course_id AS courseId FROM draft_event_courses link
    JOIN courses course ON course.id = link.course_id WHERE link.event_id = ? ORDER BY course.code COLLATE NOCASE`);
  return events.map((event) => ({
    ...event,
    provisional: Boolean(event.provisional),
    courseIds: (affectedCourses.all(event.id) as { courseId: string }[]).map((row) => row.courseId),
  }));
}

/**
 * Name and course codes for several block plans at once. Lists show both, because designated names need not be
 * unique — stable IDs and the always visible course codes tell block plans apart (FACHLICHE_REGELN.md).
 */
export function blockPlanSummaries(sqlite: Database.Database, blockPlanIds: string[]): Map<string, PlanSummary> {
  const summaries = new Map<string, PlanSummary>();
  if (!blockPlanIds.length) return summaries;
  const placeholders = blockPlanIds.map(() => "?").join(", ");
  const plans = sqlite.prepare(`SELECT id, name FROM block_plans WHERE id IN (${placeholders})`).all(...blockPlanIds) as { id: string; name: string | null }[];
  const courses = sqlite.prepare(`SELECT block_plan_id AS blockPlanId, code, study_start AS studyStart FROM courses
    WHERE block_plan_id IN (${placeholders}) ORDER BY code COLLATE NOCASE`).all(...blockPlanIds) as { blockPlanId: string; code: string; studyStart: string }[];
  for (const plan of plans) {
    const assigned = courses.filter((course) => course.blockPlanId === plan.id);
    summaries.set(plan.id, { displayName: blockPlanDisplayName(plan.name, assigned), courseCodes: assigned.map((course) => course.code) });
  }
  return summaries;
}

/** The publication states in the order lists and filters offer them, always named as text (BARRIEREFREIHEIT.md). */
export const blockPlanStateLabels: Record<BlockPlanState, string> = {
  published: "Veröffentlicht",
  withdrawn: "Zurückgenommen",
  "never-published": "Noch nie veröffentlicht",
};

export function isBlockPlanState(value: string | null): value is BlockPlanState {
  return value !== null && Object.hasOwn(blockPlanStateLabels, value);
}

/** The orders the list offers; each is reproducible, so a shared URL shows the same list again (MVP-SPEZIFIKATION.md). */
export const blockPlanSortLabels: Record<BlockPlanSort, string> = {
  draft: "Zuletzt bearbeitet",
  year: "Jahrgang, dann Bezeichnung",
  name: "Bezeichnung",
};

export function isBlockPlanSort(value: string | null): value is BlockPlanSort {
  return value !== null && Object.hasOwn(blockPlanSortLabels, value);
}

/** The publication state of a block plan as text (never conveyed by colour alone). */
export function publicationStateLabel(plan: { hasEverBeenPublished: boolean; publishedVersionId: string | null }): string {
  return blockPlanStateLabels[getPublicationState(plan.hasEverBeenPublished, Boolean(plan.publishedVersionId))];
}
