import type Database from "better-sqlite3";

import { FieldError } from "@/lib/domain/field-error";
import { deleteDraftEvent, updateDraftEvent, type EventInput } from "@/lib/services/event-admin";
import { deleteDraftPhase, updateDraftPhase, type PhaseDetails } from "@/lib/services/phase-admin";

/**
 * The changes and deletions a Zuschnitt applies to a summarised row at once. Creation needs no counterpart here:
 * `createDraftPhases` and `createDraftEvent` already take the whole selection of courses.
 */
function selectedIds(ids: string[], field: string, message: string): string[] {
  const selected = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!selected.length) throw new FieldError(field, message);
  return selected;
}

export function updateDraftPhases(sqlite: Database.Database, input: { accountId: string; phaseIds: string[]; now?: Date } & PhaseDetails): void {
  const phaseIds = selectedIds(input.phaseIds, "phaseIds", "Wählen Sie mindestens eine Kursphase.");
  sqlite.transaction(() => { for (const phaseId of phaseIds) updateDraftPhase(sqlite, { ...input, phaseId }); })();
}

export function deleteDraftPhases(sqlite: Database.Database, input: { accountId: string; phaseIds: string[]; now?: Date }): void {
  const phaseIds = selectedIds(input.phaseIds, "phaseIds", "Wählen Sie mindestens eine Kursphase.");
  sqlite.transaction(() => { for (const phaseId of phaseIds) deleteDraftPhase(sqlite, { ...input, phaseId }); })();
}

export function updateDraftEvents(sqlite: Database.Database, input: { accountId: string; eventIds: string[]; now?: Date } & Omit<EventInput, "courseIds">): void {
  const eventIds = selectedIds(input.eventIds, "eventIds", "Wählen Sie mindestens einen Termin.");
  sqlite.transaction(() => { for (const eventId of eventIds) updateDraftEvent(sqlite, { ...input, eventId }); })();
}

export function deleteDraftEvents(sqlite: Database.Database, input: { accountId: string; eventIds: string[]; now?: Date }): void {
  const eventIds = selectedIds(input.eventIds, "eventIds", "Wählen Sie mindestens einen Termin.");
  sqlite.transaction(() => { for (const eventId of eventIds) deleteDraftEvent(sqlite, { ...input, eventId }); })();
}
