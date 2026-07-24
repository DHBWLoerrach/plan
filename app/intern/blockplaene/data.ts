import "server-only";

import { sqlite } from "@/lib/db";
import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";

export type PlanCourse = { id: string; code: string; program: string; studyStart: string; studyEnd: string };
export type PlanSummary = { displayName: string; courseCodes: string[] };

/** The courses currently assigned to a block plan, in the order used for display and for the derived name. */
export function blockPlanCourses(blockPlanId: string): PlanCourse[] {
  return sqlite.prepare(`SELECT course.id, course.code, program.name AS program, course.study_start AS studyStart, course.study_end AS studyEnd
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.block_plan_id = ? ORDER BY course.code COLLATE NOCASE`).all(blockPlanId) as PlanCourse[];
}

/**
 * Name and course codes for several block plans at once. Lists show both, because designated names need not be
 * unique — stable IDs and the always visible course codes tell block plans apart (FACHLICHE_REGELN.md).
 */
export function blockPlanSummaries(blockPlanIds: string[]): Map<string, PlanSummary> {
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
