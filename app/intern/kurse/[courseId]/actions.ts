"use server";

import { revalidatePath } from "next/cache";

import { sqlite } from "@/lib/db";
import { FieldError } from "@/lib/domain/field-error";
import type { TransferSelection } from "@/lib/domain/plan-transfer";
import { createCourseEvent, deleteCourseEvent, updateCourseEvent, type EventDetails, type EventField, type EventInput } from "@/lib/services/event-admin";
import { createCoursePhases, deleteCoursePhase, moveCoursePhaseChange, updateCoursePhase, type PhaseChangeField, type PhaseDetails, type PhaseField, type PhaseInput } from "@/lib/services/phase-admin";

import { errorMessage, requireAccountId } from "../../action-helpers";

export type PlanFormState<TField extends string = string, TValues = never> = {
  error?: string;
  success?: string;
  field?: TField;
  values?: TValues;
};

function rejected<TField extends string, TValues>(error: unknown, values: TValues): PlanFormState<TField, TValues> {
  return { error: errorMessage(error), field: error instanceof FieldError ? error.field as TField : undefined, values };
}

/**
 * Every page that shows a plan, because a course is compared on the pages of all its parallel courses and its
 * completeness is stated on the overview. The course page is named by its route pattern, which the Next.js guide
 * requires for a path with a dynamic segment.
 */
function revalidatePlan() {
  revalidatePath("/intern");
  revalidatePath("/intern/kurse");
  revalidatePath("/intern/kurse/[courseId]", "page");
}

function transferSelection(formData: FormData): TransferSelection {
  return {
    sourceCourseId: String(formData.get("courseId") ?? ""),
    targetCourseIds: formData.getAll("transferCourseId").map(String),
  };
}

function phaseInput(formData: FormData): PhaseInput {
  return {
    ...transferSelection(formData),
    semester: String(formData.get("semester") ?? ""),
    type: String(formData.get("type") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
  };
}

export async function createPhaseAction(_: PlanFormState<PhaseField, PhaseInput>, formData: FormData): Promise<PlanFormState<PhaseField, PhaseInput>> {
  const input = phaseInput(formData);
  try {
    const accountId = await requireAccountId();
    const created = createCoursePhases(sqlite, { accountId, ...input });
    revalidatePlan();
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

export async function updatePhaseAction(_: PlanFormState<PhaseField, PhaseDetails>, formData: FormData): Promise<PlanFormState<PhaseField, PhaseDetails>> {
  const details = phaseDetails(formData);
  try {
    updateCoursePhase(sqlite, { accountId: await requireAccountId(), phaseId: String(formData.get("phaseId") ?? ""), ...details });
    revalidatePlan();
    return { success: "Die Kursphase wurde gespeichert." };
  } catch (error) {
    return rejected<PhaseField, PhaseDetails>(error, details);
  }
}

export async function movePhaseChangeAction(_: PlanFormState<PhaseChangeField, { date: string }>, formData: FormData): Promise<PlanFormState<PhaseChangeField, { date: string }>> {
  const date = String(formData.get("date") ?? "");
  try {
    moveCoursePhaseChange(sqlite, {
      accountId: await requireAccountId(),
      earlierPhaseId: String(formData.get("earlierPhaseId") ?? ""),
      laterPhaseId: String(formData.get("laterPhaseId") ?? ""),
      date,
    });
    revalidatePlan();
    return { success: "Der Wechsel wurde gespeichert." };
  } catch (error) {
    return rejected<PhaseChangeField, { date: string }>(error, { date });
  }
}

export async function deletePhaseAction(_: PlanFormState, formData: FormData): Promise<PlanFormState> {
  try {
    deleteCoursePhase(sqlite, { accountId: await requireAccountId(), phaseId: String(formData.get("phaseId") ?? "") });
    revalidatePlan();
    return { success: "Die Kursphase wurde gelöscht." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

function eventInput(formData: FormData): EventInput {
  return {
    ...transferSelection(formData),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    provisional: formData.get("provisional") !== null,
  };
}

export async function createEventAction(_: PlanFormState<EventField, EventInput>, formData: FormData): Promise<PlanFormState<EventField, EventInput>> {
  const input = eventInput(formData);
  try {
    const accountId = await requireAccountId();
    const created = createCourseEvent(sqlite, { accountId, ...input });
    revalidatePlan();
    return { success: created.length === 1 ? "Der Termin wurde gespeichert." : `${created.length} eigenständige Termine wurden gespeichert — je Kurs einer.` };
  } catch (error) {
    return rejected<EventField, EventInput>(error, input);
  }
}

export async function updateEventAction(_: PlanFormState<EventField, EventDetails>, formData: FormData): Promise<PlanFormState<EventField, EventDetails>> {
  const details: EventDetails = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    provisional: formData.get("provisional") !== null,
  };
  try {
    updateCourseEvent(sqlite, { accountId: await requireAccountId(), eventId: String(formData.get("eventId") ?? ""), ...details });
    revalidatePlan();
    return { success: "Der Termin wurde gespeichert." };
  } catch (error) {
    return rejected<EventField, EventDetails>(error, details);
  }
}

export async function deleteEventAction(_: PlanFormState, formData: FormData): Promise<PlanFormState> {
  try {
    deleteCourseEvent(sqlite, { accountId: await requireAccountId(), eventId: String(formData.get("eventId") ?? "") });
    revalidatePlan();
    return { success: "Der Termin wurde gelöscht." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
