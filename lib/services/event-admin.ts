import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeCalendarDayField } from "@/lib/domain/calendar-day";
import { type EventCategory, isEventCategory } from "@/lib/domain/event-category";
import { FieldError } from "@/lib/domain/field-error";
import type { TransferSelection } from "@/lib/domain/plan-transfer";
import { assertCourseEditPermission } from "@/lib/services/authorization";
import { completeCourseChange } from "@/lib/services/course-change";
import { requirePlanEntryCourses } from "@/lib/services/plan-transfer";

export type EventField = "title" | "description" | "category" | "startDate" | "endDate" | "courseIds";
export type EventDetails = { title: string; description: string; category: string; startDate: string; endDate: string; provisional: boolean };
export type EventInput = EventDetails & TransferSelection;
type NormalizedEvent = { title: string; description: string | null; category: EventCategory; startDate: string; endDate: string | null; provisional: boolean };
const maximumTitleLength = 160;
const maximumDescriptionLength = 2000;

/** Stores one independent event for every selected course. */
export function createCourseEvent(sqlite: Database.Database, input: { accountId: string; now?: Date } & EventInput): string[] {
  const event = normalizeEventInput(input);
  const now = input.now ?? new Date();
  return sqlite.transaction(() => {
    const courses = requirePlanEntryCourses(sqlite, input, "event");
    const add = sqlite.prepare(`INSERT INTO course_events (id, course_id, title, description, category, start_date, end_date, provisional)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    return courses.map(({ id: courseId }) => {
      const id = randomUUID();
      add.run(id, courseId, event.title, event.description, event.category, event.startDate, event.endDate, event.provisional ? 1 : 0);
      completeCourseChange(sqlite, courseId, input.accountId, now);
      return id;
    });
  }).immediate();
}

export function updateCourseEvent(sqlite: Database.Database, input: { accountId: string; eventId: string; now?: Date } & EventDetails): void {
  const event = normalizeEventInput(input);
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const courseId = requireCourseOfEvent(sqlite, input.eventId);
    assertCourseEditPermission(sqlite, input.accountId, courseId);
    sqlite.prepare("UPDATE course_events SET title = ?, description = ?, category = ?, start_date = ?, end_date = ?, provisional = ? WHERE id = ?")
      .run(event.title, event.description, event.category, event.startDate, event.endDate, event.provisional ? 1 : 0, input.eventId);
    completeCourseChange(sqlite, courseId, input.accountId, now);
  }).immediate();
}

export function deleteCourseEvent(sqlite: Database.Database, input: { accountId: string; eventId: string; now?: Date }): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const courseId = requireCourseOfEvent(sqlite, input.eventId);
    assertCourseEditPermission(sqlite, input.accountId, courseId);
    sqlite.prepare("DELETE FROM course_events WHERE id = ?").run(input.eventId);
    completeCourseChange(sqlite, courseId, input.accountId, now);
  }).immediate();
}

function requireCourseOfEvent(sqlite: Database.Database, eventId: string): string {
  const courseId = sqlite.prepare("SELECT course_id FROM course_events WHERE id = ?").pluck().get(eventId) as string | undefined;
  if (!courseId) throw new Error("Der Termin wurde nicht gefunden.");
  return courseId;
}

function normalizeEventInput(input: EventDetails): NormalizedEvent {
  const title = input.title.trim().replace(/\s+/gu, " ");
  if (!title) throw new FieldError("title", "Der Termintitel ist erforderlich.");
  if ([...title].length > maximumTitleLength) throw new FieldError("title", `Der Termintitel darf höchstens ${maximumTitleLength} Zeichen lang sein.`);
  const description = input.description.trim();
  if ([...description].length > maximumDescriptionLength) throw new FieldError("description", `Die Terminbeschreibung darf höchstens ${maximumDescriptionLength} Zeichen lang sein.`);
  if (!isEventCategory(input.category)) throw new FieldError("category", "Die Kategorie des Termins ist ungültig.");
  const startDate = normalizeCalendarDayField(input.startDate, "startDate", "Das Startdatum");
  const endDate = input.endDate.trim() ? normalizeCalendarDayField(input.endDate, "endDate", "Das Enddatum") : null;
  if (endDate && endDate < startDate) throw new FieldError("endDate", "Das Enddatum darf nicht vor dem Startdatum liegen.");
  return { title, description: description || null, category: input.category, startDate, endDate, provisional: input.provisional };
}
