import type Database from "better-sqlite3";

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
