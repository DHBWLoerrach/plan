"use server";

import { revalidatePath } from "next/cache";

import { sqlite } from "@/lib/db";
import { FieldError } from "@/lib/domain/field-error";
import { getActiveAccount } from "@/lib/internal-auth";
import { deleteDraftEvents, deleteDraftPhases, updateDraftEvents, updateDraftPhases } from "@/lib/services/cut-editor";
import { createDraftEvent, type EventField, type EventInput } from "@/lib/services/event-admin";
import { createDraftPhases, type PhaseDetails, type PhaseField, type PhaseInput } from "@/lib/services/phase-admin";

export type CutFormState<TField extends string = string, TValues = never> = {
  error?: string;
  success?: string;
  field?: TField;
  values?: TValues;
};

async function requireAccountId() {
  const account = await getActiveAccount();
  if (!account) throw new Error("Ihre Sitzung ist nicht mehr gültig.");
  return account.id;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Die Aktion konnte nicht ausgeführt werden.";
}

function rejected<TField extends string, TValues>(error: unknown, values: TValues): CutFormState<TField, TValues> {
  return { error: errorMessage(error), field: error instanceof FieldError ? error.field as TField : undefined, values };
}

function revalidateCut() {
  revalidatePath("/intern");
  revalidatePath("/intern/kurse");
  revalidatePath("/intern/kurse/zuschnitt");
}

function phaseInput(formData: FormData): PhaseInput {
  return {
    courseIds: formData.getAll("courseId").map(String),
    semester: String(formData.get("semester") ?? ""),
    type: String(formData.get("type") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
  };
}

export async function createCutPhasesAction(_: CutFormState<PhaseField, PhaseInput>, formData: FormData): Promise<CutFormState<PhaseField, PhaseInput>> {
  const input = phaseInput(formData);
  try {
    const created = createDraftPhases(sqlite, { accountId: await requireAccountId(), ...input });
    revalidateCut();
    return { success: created.length === 1 ? "Die Kursphase wurde gespeichert." : `${created.length} eigenständige Kursphasen wurden gespeichert — je Kurs eine.` };
  } catch (error) {
    return rejected<PhaseField, PhaseInput>(error, input);
  }
}

function phaseDetails(formData: FormData): PhaseDetails {
  return {
    semester: String(formData.get("semester") ?? ""),
    type: String(formData.get("type") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
  };
}

export async function updateCutPhasesAction(_: CutFormState<PhaseField, PhaseDetails>, formData: FormData): Promise<CutFormState<PhaseField, PhaseDetails>> {
  const details = phaseDetails(formData);
  try {
    updateDraftPhases(sqlite, { accountId: await requireAccountId(), phaseIds: formData.getAll("phaseId").map(String), ...details });
    revalidateCut();
    return { success: "Die Kursphasen wurden gespeichert." };
  } catch (error) {
    return rejected<PhaseField, PhaseDetails>(error, details);
  }
}

export async function deleteCutPhasesAction(_: CutFormState, formData: FormData): Promise<CutFormState> {
  try {
    deleteDraftPhases(sqlite, { accountId: await requireAccountId(), phaseIds: formData.getAll("phaseId").map(String) });
    revalidateCut();
    return { success: "Die Kursphasen wurden gelöscht." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

function eventInput(formData: FormData): EventInput {
  return {
    courseIds: formData.getAll("courseId").map(String),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    provisional: formData.get("provisional") !== null,
  };
}

export async function createCutEventsAction(_: CutFormState<EventField, EventInput>, formData: FormData): Promise<CutFormState<EventField, EventInput>> {
  const input = eventInput(formData);
  try {
    const created = createDraftEvent(sqlite, { accountId: await requireAccountId(), ...input });
    revalidateCut();
    return { success: created.length === 1 ? "Der Termin wurde gespeichert." : `${created.length} eigenständige Termine wurden gespeichert — je Kurs einer.` };
  } catch (error) {
    return rejected<EventField, EventInput>(error, input);
  }
}

export async function updateCutEventsAction(_: CutFormState<EventField, Omit<EventInput, "courseIds">>, formData: FormData): Promise<CutFormState<EventField, Omit<EventInput, "courseIds">>> {
  const input = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    provisional: formData.get("provisional") !== null,
  };
  try {
    updateDraftEvents(sqlite, { accountId: await requireAccountId(), eventIds: formData.getAll("eventId").map(String), ...input });
    revalidateCut();
    return { success: "Die Termine wurden gespeichert." };
  } catch (error) {
    return rejected<EventField, Omit<EventInput, "courseIds">>(error, input);
  }
}

export async function deleteCutEventsAction(_: CutFormState, formData: FormData): Promise<CutFormState> {
  try {
    deleteDraftEvents(sqlite, { accountId: await requireAccountId(), eventIds: formData.getAll("eventId").map(String) });
    revalidateCut();
    return { success: "Die Termine wurden gelöscht." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
