import type Database from "better-sqlite3";

import { FieldError } from "@/lib/domain/field-error";

/**
 * The courses a draft entry applies to: at least one, each of them assigned to this block plan and counted once
 * (FACHLICHE_REGELN.md). Course phases and examination-relevant events share the rule but word it differently.
 */
export function requireCoursesOfBlockPlan(sqlite: Database.Database, input: {
  blockPlanId: string;
  courseIds: string[];
  field: string;
  emptyMessage: string;
  foreignMessage: string;
}): string[] {
  const courseIds = [...new Set(input.courseIds.map((courseId) => courseId.trim()).filter(Boolean))];
  if (!courseIds.length) throw new FieldError(input.field, input.emptyMessage);
  const isAssigned = sqlite.prepare("SELECT 1 FROM courses WHERE id = ? AND block_plan_id = ?");
  for (const courseId of courseIds) {
    if (!isAssigned.get(courseId, input.blockPlanId)) throw new FieldError(input.field, input.foreignMessage);
  }
  return courseIds;
}

/**
 * Removes everything a course contributes to a draft: its course phases and its links to examination-relevant events
 * (FACHLICHE_REGELN.md). A remaining event must still affect at least one course, so an event that would be left
 * without any course blocks the operation instead of being deleted.
 */
export function clearCourseFromDraft(sqlite: Database.Database, blockPlanId: string, courseId: string): void {
  const orphaned = sqlite.prepare(`SELECT event.title FROM draft_events event
    WHERE event.block_plan_id = ?
      AND EXISTS (SELECT 1 FROM draft_event_courses link WHERE link.event_id = event.id AND link.course_id = ?)
      AND NOT EXISTS (SELECT 1 FROM draft_event_courses link WHERE link.event_id = event.id AND link.course_id <> ?)`).all(blockPlanId, courseId, courseId) as { title: string }[];
  if (orphaned.length) throw new Error(`Folgende Termine würden ohne Kurs verbleiben: ${orphaned.map((event) => `„${event.title}“`).join(", ")}. Passen Sie die Termine zuerst an.`);
  sqlite.prepare("DELETE FROM draft_phases WHERE block_plan_id = ? AND course_id = ?").run(blockPlanId, courseId);
  sqlite.prepare("DELETE FROM draft_event_courses WHERE course_id = ? AND event_id IN (SELECT id FROM draft_events WHERE block_plan_id = ?)").run(courseId, blockPlanId);
}

/** Records when and by which internal account the editable planning state of a block plan changed last. */
export function touchDraft(sqlite: Database.Database, blockPlanId: string, accountId: string, now: Date): void {
  sqlite.prepare("UPDATE block_plans SET draft_updated_at = ?, draft_updated_by_account_id = ? WHERE id = ?").run(now.toISOString(), accountId, blockPlanId);
}
