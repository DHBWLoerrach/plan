import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeCalendarDayField } from "@/lib/domain/calendar-day";
import { type EventCategory, isEventCategory } from "@/lib/domain/event-category";
import { FieldError } from "@/lib/domain/field-error";
import { assertAreaEditPermission } from "@/lib/services/authorization";
import { requireCoursesOfBlockPlan, touchDraft } from "@/lib/services/draft-changes";

export type EventField = "title" | "description" | "category" | "startDate" | "endDate" | "courseIds";

export type EventInput = {
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  provisional: boolean;
  courseIds: string[];
};

type NormalizedEvent = {
  title: string;
  description: string | null;
  category: EventCategory;
  startDate: string;
  endDate: string | null;
  provisional: boolean;
  courseIds: string[];
};

const maximumTitleLength = 160;
const maximumDescriptionLength = 2000;

/** Creates an examination-relevant event in the draft of a block plan. */
export function createDraftEvent(sqlite: Database.Database, input: { accountId: string; blockPlanId: string; now?: Date } & EventInput): string {
  const event = normalizeEventInput(input);
  const now = input.now ?? new Date();
  return sqlite.transaction(() => {
    const plan = requirePlan(sqlite, input.blockPlanId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    const courseIds = affectedCourses(sqlite, plan.id, event.courseIds);
    const id = randomUUID();
    sqlite.prepare(`INSERT INTO draft_events (id, block_plan_id, title, description, category, start_date, end_date, provisional)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.blockPlanId, event.title, event.description, event.category, event.startDate, event.endDate, event.provisional ? 1 : 0);
    const addCourse = sqlite.prepare("INSERT INTO draft_event_courses (event_id, course_id) VALUES (?, ?)");
    for (const courseId of courseIds) addCourse.run(id, courseId);
    touchDraft(sqlite, input.blockPlanId, input.accountId, now);
    return id;
  })();
}

/** Replaces every detail of an event, including the set of affected courses. */
export function updateDraftEvent(sqlite: Database.Database, input: { accountId: string; eventId: string; now?: Date } & EventInput): void {
  const event = normalizeEventInput(input);
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const plan = requirePlanOfEvent(sqlite, input.eventId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    const courseIds = affectedCourses(sqlite, plan.id, event.courseIds);
    sqlite.prepare("UPDATE draft_events SET title = ?, description = ?, category = ?, start_date = ?, end_date = ?, provisional = ? WHERE id = ?")
      .run(event.title, event.description, event.category, event.startDate, event.endDate, event.provisional ? 1 : 0, input.eventId);
    sqlite.prepare("DELETE FROM draft_event_courses WHERE event_id = ?").run(input.eventId);
    const addCourse = sqlite.prepare("INSERT INTO draft_event_courses (event_id, course_id) VALUES (?, ?)");
    for (const courseId of courseIds) addCourse.run(input.eventId, courseId);
    touchDraft(sqlite, plan.id, input.accountId, now);
  })();
}

/** Deletes an event from the draft; its course assignments go with it. Events are never deleted automatically. */
export function deleteDraftEvent(sqlite: Database.Database, input: { accountId: string; eventId: string; now?: Date }): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const plan = requirePlanOfEvent(sqlite, input.eventId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    sqlite.prepare("DELETE FROM draft_events WHERE id = ?").run(input.eventId);
    touchDraft(sqlite, plan.id, input.accountId, now);
  })();
}

function requirePlan(sqlite: Database.Database, blockPlanId: string): { id: string; areaId: string } {
  const plan = sqlite.prepare("SELECT id, area_id AS areaId FROM block_plans WHERE id = ?").get(blockPlanId) as { id: string; areaId: string } | undefined;
  if (!plan) throw new Error("Der Blockplan wurde nicht gefunden.");
  return plan;
}

function requirePlanOfEvent(sqlite: Database.Database, eventId: string): { id: string; areaId: string } {
  const plan = sqlite.prepare(`SELECT plan.id, plan.area_id AS areaId FROM draft_events event
    JOIN block_plans plan ON plan.id = event.block_plan_id WHERE event.id = ?`).get(eventId) as { id: string; areaId: string } | undefined;
  if (!plan) throw new Error("Der Termin wurde nicht gefunden.");
  return plan;
}

function affectedCourses(sqlite: Database.Database, blockPlanId: string, courseIds: string[]): string[] {
  return requireCoursesOfBlockPlan(sqlite, {
    blockPlanId,
    courseIds,
    field: "courseIds" satisfies EventField,
    emptyMessage: "Ein Termin betrifft mindestens einen Kurs.",
    foreignMessage: "Ein betroffener Kurs gehört nicht zu diesem Blockplan.",
  });
}

function normalizeEventInput(input: EventInput): NormalizedEvent {
  // The title is a human designation: trimmed with interior whitespace collapsed (FACHLICHE_REGELN.md).
  const title = input.title.trim().replace(/\s+/gu, " ");
  if (!title) throw new FieldError("title", "Der Termintitel ist erforderlich.");
  if ([...title].length > maximumTitleLength) throw new FieldError("title", `Der Termintitel darf höchstens ${maximumTitleLength} Zeichen lang sein.`);
  const description = input.description.trim();
  if ([...description].length > maximumDescriptionLength) {
    throw new FieldError("description", `Die Terminbeschreibung darf höchstens ${maximumDescriptionLength} Zeichen lang sein.`);
  }
  if (!isEventCategory(input.category)) throw new FieldError("category", "Die Kategorie des Termins ist ungültig.");
  const startDate = normalizeCalendarDayField(input.startDate, "startDate", "Das Startdatum");
  const endDate = input.endDate.trim() ? normalizeCalendarDayField(input.endDate, "endDate", "Das Enddatum") : null;
  if (endDate && endDate < startDate) throw new FieldError("endDate", "Das Enddatum darf nicht vor dem Startdatum liegen.");
  return {
    title,
    description: description || null,
    category: input.category,
    startDate,
    endDate,
    provisional: input.provisional,
    courseIds: input.courseIds,
  };
}
