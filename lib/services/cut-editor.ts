import type Database from "better-sqlite3";

import { FieldError } from "@/lib/domain/field-error";
import { createDraftEvent, deleteDraftEvent, updateDraftEvent, type EventInput } from "@/lib/services/event-admin";
import { createDraftPhases, deleteDraftPhase, updateDraftPhase, type PhaseDetails, type PhaseInput } from "@/lib/services/phase-admin";

type CoursePlanRow = { id: string; blockPlanId: string | null };

/**
 * Creates equal, but independent, course phases for a Zuschnitt. The current schema still stores the draft beneath
 * technical block plans, so this boundary groups the selected courses invisibly before using the existing operation.
 */
export function createDraftPhasesForCourses(
  sqlite: Database.Database,
  input: { accountId: string; now?: Date } & PhaseInput,
): string[] {
  const courseIds = [...new Set(input.courseIds.map((courseId) => courseId.trim()).filter(Boolean))];
  if (!courseIds.length) throw new FieldError("courseIds", "Wählen Sie mindestens einen Kurs für die Kursphase.");
  const placeholders = courseIds.map(() => "?").join(", ");
  const courses = sqlite.prepare(`SELECT id, block_plan_id AS blockPlanId FROM courses WHERE id IN (${placeholders})`)
    .all(...courseIds) as CoursePlanRow[];
  if (courses.length !== courseIds.length || courses.some((course) => !course.blockPlanId)) {
    throw new FieldError("courseIds", "Ein ausgewählter Kurs ist nicht für die Planung verfügbar.");
  }
  const plans = new Map<string, string[]>();
  for (const course of courses) {
    const courseIdsOfPlan = plans.get(course.blockPlanId!) ?? [];
    courseIdsOfPlan.push(course.id);
    plans.set(course.blockPlanId!, courseIdsOfPlan);
  }
  return sqlite.transaction(() => [...plans].flatMap(([blockPlanId, planCourseIds]) =>
    createDraftPhases(sqlite, { ...input, blockPlanId, courseIds: planCourseIds })))();
}

/**
 * A shared event row in a Zuschnitt never creates shared state. Each course receives its own event, even where the
 * temporary schema could technically store a single event with several course links.
 */
export function createDraftEventsForCourses(
  sqlite: Database.Database,
  input: { accountId: string; now?: Date } & EventInput,
): string[] {
  const courseIds = [...new Set(input.courseIds.map((courseId) => courseId.trim()).filter(Boolean))];
  if (!courseIds.length) throw new FieldError("courseIds", "Ein Termin betrifft mindestens einen Kurs.");
  const placeholders = courseIds.map(() => "?").join(", ");
  const courses = sqlite.prepare(`SELECT id, block_plan_id AS blockPlanId FROM courses WHERE id IN (${placeholders})`)
    .all(...courseIds) as CoursePlanRow[];
  if (courses.length !== courseIds.length || courses.some((course) => !course.blockPlanId)) {
    throw new FieldError("courseIds", "Ein ausgewählter Kurs ist nicht für die Planung verfügbar.");
  }
  return sqlite.transaction(() => courses.map((course) =>
    createDraftEvent(sqlite, { ...input, blockPlanId: course.blockPlanId!, courseIds: [course.id] })))();
}

function selectedIds(ids: string[], field: string, message: string): string[] {
  const selected = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!selected.length) throw new FieldError(field, message);
  return selected;
}

/** Applies one visible row's details to every independently stored course phase the row names. */
export function updateDraftPhases(
  sqlite: Database.Database,
  input: { accountId: string; phaseIds: string[]; now?: Date } & PhaseDetails,
): void {
  const phaseIds = selectedIds(input.phaseIds, "phaseIds", "Wählen Sie mindestens eine Kursphase.");
  sqlite.transaction(() => {
    for (const phaseId of phaseIds) updateDraftPhase(sqlite, { ...input, phaseId });
  })();
}

/** Deletes exactly the independently stored course phases named by a visible row. */
export function deleteDraftPhases(
  sqlite: Database.Database,
  input: { accountId: string; phaseIds: string[]; now?: Date },
): void {
  const phaseIds = selectedIds(input.phaseIds, "phaseIds", "Wählen Sie mindestens eine Kursphase.");
  sqlite.transaction(() => {
    for (const phaseId of phaseIds) deleteDraftPhase(sqlite, { ...input, phaseId });
  })();
}

/** Applies details to all independent events that make up a summarized row while preserving each event's course. */
export function updateDraftEvents(
  sqlite: Database.Database,
  input: { accountId: string; eventIds: string[]; now?: Date } & Omit<EventInput, "courseIds">,
): void {
  const eventIds = selectedIds(input.eventIds, "eventIds", "Wählen Sie mindestens einen Termin.");
  const courseIdsOfEvent = sqlite.prepare("SELECT course_id AS courseId FROM draft_event_courses WHERE event_id = ?");
  sqlite.transaction(() => {
    for (const eventId of eventIds) {
      const courseIds = (courseIdsOfEvent.all(eventId) as { courseId: string }[]).map((entry) => entry.courseId);
      updateDraftEvent(sqlite, { ...input, eventId, courseIds });
    }
  })();
}

/** Deletes all independently stored events that a summarized row names. */
export function deleteDraftEvents(
  sqlite: Database.Database,
  input: { accountId: string; eventIds: string[]; now?: Date },
): void {
  const eventIds = selectedIds(input.eventIds, "eventIds", "Wählen Sie mindestens einen Termin.");
  sqlite.transaction(() => {
    for (const eventId of eventIds) deleteDraftEvent(sqlite, { ...input, eventId });
  })();
}
