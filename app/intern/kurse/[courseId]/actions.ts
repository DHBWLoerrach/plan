"use server";

import { revalidatePath } from "next/cache";

import { sqlite } from "@/lib/db";
import { FieldError } from "@/lib/domain/field-error";
import { getActiveAccount } from "@/lib/internal-auth";
import { createCourseEvent, deleteCourseEvent, updateCourseEvent, type EventField, type EventInput } from "@/lib/services/event-admin";
import { createCoursePhases, deleteCoursePhase, updateCoursePhase, type PhaseDetails, type PhaseField, type PhaseInput } from "@/lib/services/phase-admin";
import { assertTransferTargets } from "@/lib/services/plan-transfer";

export type PlanFormState<TField extends string = string, TValues = never> = {
  error?: string;
  success?: string;
  field?: TField;
  values?: TValues;
};

/**
 * The first statement of every attempt, before anything is read from the database. A server action is a public
 * endpoint: whoever holds its identifier reaches it without ever passing the page, whose permission check therefore
 * guards nothing here. A refusal that reported on stored data before the session was established would answer
 * questions about the course inventory to a caller who is not signed in at all.
 */
async function requireAccountId() {
  const account = await getActiveAccount();
  if (!account) throw new Error("Ihre Sitzung ist nicht mehr gültig.");
  return account.id;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Die Aktion konnte nicht ausgeführt werden.";
}

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

/**
 * The course being edited followed by the courses the same entry is transferred to. `courseId` carries all of them,
 * so the domain sees one selection and creates one independent entry per course (ADR 0006). The edited course is
 * always first, so a refusal names it before any transfer target.
 *
 * Whether those targets are permitted is decided by `checkTransfer` inside the attempt, so a refusal reaches the form
 * with the captured values like any other one.
 */
function selectedCourseIds(formData: FormData): string[] {
  return [String(formData.get("courseId") ?? ""), ...formData.getAll("transferCourseId").map(String)];
}

/**
 * The form offers only courses of the comparison, but a form is a proposal and this action is reachable without it.
 * Called after the session is established and immediately before the write, with nothing awaited in between: what was
 * checked and what is stored must be the same state.
 */
function checkTransfer(courseIds: string[], kind: "phase" | "event"): void {
  assertTransferTargets(sqlite, { courseId: courseIds[0], targetIds: courseIds.slice(1), kind });
}

function phaseInput(formData: FormData): PhaseInput {
  return {
    courseIds: selectedCourseIds(formData),
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
    checkTransfer(input.courseIds, "phase");
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
    courseIds: selectedCourseIds(formData),
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
    checkTransfer(input.courseIds, "event");
    const created = createCourseEvent(sqlite, { accountId, ...input });
    revalidatePlan();
    return { success: created.length === 1 ? "Der Termin wurde gespeichert." : `${created.length} eigenständige Termine wurden gespeichert — je Kurs einer.` };
  } catch (error) {
    return rejected<EventField, EventInput>(error, input);
  }
}

type EventDetails = Omit<EventInput, "courseIds">;

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
