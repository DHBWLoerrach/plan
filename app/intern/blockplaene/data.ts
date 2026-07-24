import "server-only";

import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { sqlite } from "@/lib/db";

export type PlanCourse = { id: string; code: string; program: string; studyStart: string; studyEnd: string; semesters: number };

/** The courses currently assigned to a block plan, in the order used for display and for the derived name. */
export function blockPlanCourses(blockPlanId: string): PlanCourse[] {
  return sqlite.prepare(`SELECT course.id, course.code, program.name AS program, course.study_start AS studyStart, course.study_end AS studyEnd, program.semesters
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.block_plan_id = ? ORDER BY course.code COLLATE NOCASE`).all(blockPlanId) as PlanCourse[];
}

/** Display names for several block plans at once, so lists can show the given or the derived name. */
export function blockPlanDisplayNames(blockPlanIds: string[]): Map<string, string> {
  const names = new Map<string, string>();
  if (!blockPlanIds.length) return names;
  const placeholders = blockPlanIds.map(() => "?").join(", ");
  const plans = sqlite.prepare(`SELECT id, name FROM block_plans WHERE id IN (${placeholders})`).all(...blockPlanIds) as { id: string; name: string | null }[];
  const courses = sqlite.prepare(`SELECT block_plan_id AS blockPlanId, code, study_start AS studyStart FROM courses
    WHERE block_plan_id IN (${placeholders}) ORDER BY code COLLATE NOCASE`).all(...blockPlanIds) as { blockPlanId: string; code: string; studyStart: string }[];
  for (const plan of plans) {
    names.set(plan.id, blockPlanDisplayName(plan.name, courses.filter((course) => course.blockPlanId === plan.id)));
  }
  return names;
}

/** The publication state of a block plan as text (never conveyed by colour alone). */
export function publicationStateLabel(plan: { hasEverBeenPublished: boolean; publishedVersionId: string | null }): string {
  if (plan.publishedVersionId) return "Veröffentlicht";
  return plan.hasEverBeenPublished ? "Zurückgenommen" : "Noch nie veröffentlicht";
}
