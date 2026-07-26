import "server-only";

import type Database from "better-sqlite3";

import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import type { DraftEvent, PlanPhase } from "@/lib/domain/publication";

export type PlanCourse = { id: string; code: string; program: string; semesters: number; studyStart: string; studyEnd: string };
export type PlanSummary = { displayName: string; courseCodes: string[] };
export type InternalBlockPlan = { id: string; hasEverBeenPublished: number; versionId: string | null };
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

/** Block plans visible to the account, newest draft changes first. */
export function listInternalBlockPlans(sqlite: Database.Database, account: { id: string; systemAdmin: boolean }): InternalBlockPlan[] {
  return sqlite.prepare(`SELECT plan.id, plan.has_ever_been_published AS hasEverBeenPublished, version.id AS versionId
    FROM block_plans plan LEFT JOIN published_versions version ON version.block_plan_id = plan.id
    WHERE ? = 1 OR plan.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY plan.draft_updated_at DESC`).all(account.systemAdmin ? 1 : 0, account.id) as InternalBlockPlan[];
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

/** The publication state of a block plan as text (never conveyed by colour alone). */
export function publicationStateLabel(plan: { hasEverBeenPublished: boolean; publishedVersionId: string | null }): string {
  if (plan.publishedVersionId) return "Veröffentlicht";
  return plan.hasEverBeenPublished ? "Zurückgenommen" : "Noch nie veröffentlicht";
}
