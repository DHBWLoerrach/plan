"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";
import { attachCourse, createBlockPlanFromCourse, deleteBlockPlan, detachCourse, renameBlockPlan } from "@/lib/services/block-plan-admin";
import { FieldError } from "@/lib/domain/field-error";
import { type EventField, type EventInput, createDraftEvent, deleteDraftEvent, updateDraftEvent } from "@/lib/services/event-admin";
import { type PhaseDetails, type PhaseField, type PhaseInput, createDraftPhases, deleteDraftPhase, updateDraftPhase } from "@/lib/services/phase-admin";
import { type NextPhaseDefaults, nextPhaseDefaults } from "@/lib/domain/phase-sequence";

import { blockPlanCourses, blockPlanDraftPhases } from "./data";

export type BlockPlanFormState = { error?: string; success?: string };

/** A rejected save keeps the entered values and names the field, so the editor can show both (BARRIEREFREIHEIT.md). */
export type EditorFormState<TField extends string, TValues> = BlockPlanFormState & { field?: TField; values?: TValues };
export type EventFormState = EditorFormState<EventField, EventInput> & { token?: string };
export type PhaseFormState = EditorFormState<PhaseField, PhaseInput> & {
  /** The values the create form starts the next course phase with. */
  next?: NextPhaseDefaults;
  /** Set when a change moved the phase into another semester, so the section can say where it went. */
  movedToSemester?: number;
  /** Changes on every successful save and remounts the uncontrolled fields. */
  token?: string;
};
export type PhaseDetailsFormState = EditorFormState<PhaseField, PhaseDetails> & { movedToSemester?: number };

async function requireAccountId() {
  const account = await getActiveAccount();
  if (!account) throw new Error("Ihre Sitzung ist nicht mehr gültig.");
  return account.id;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Die Aktion konnte nicht ausgeführt werden.";
}

function revalidateBlockPlan(blockPlanId: string) {
  revalidatePath("/intern");
  revalidatePath("/intern/kurse");
  revalidatePath(`/intern/blockplaene/${blockPlanId}`);
}

export async function createBlockPlanFromCourseAction(_: BlockPlanFormState, formData: FormData): Promise<BlockPlanFormState> {
  const courseId = String(formData.get("courseId") ?? "");
  let blockPlanId: string;
  try {
    blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: await requireAccountId(), courseId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  revalidatePath(`/intern/kurse/${courseId}`);
  redirect(`/intern/blockplaene/${blockPlanId}?angelegt=1`);
}

export async function renameBlockPlanAction(_: BlockPlanFormState, formData: FormData): Promise<BlockPlanFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  try {
    renameBlockPlan(sqlite, { accountId: await requireAccountId(), blockPlanId, name: String(formData.get("name") ?? "") });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  return { success: "Die Bezeichnung wurde gespeichert." };
}

export async function attachCourseAction(_: BlockPlanFormState, formData: FormData): Promise<BlockPlanFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  try {
    attachCourse(sqlite, { accountId: await requireAccountId(), blockPlanId, courseId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  revalidatePath(`/intern/kurse/${courseId}`);
  return { success: "Der Kurs wurde dem Blockplan zugeordnet." };
}

export async function detachCourseAction(_: BlockPlanFormState, formData: FormData): Promise<BlockPlanFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  try {
    detachCourse(sqlite, { accountId: await requireAccountId(), blockPlanId, courseId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  revalidatePath(`/intern/kurse/${courseId}`);
  return { success: "Der Kurs wurde vom Blockplan gelöst." };
}

function eventInput(formData: FormData): EventInput {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    provisional: formData.get("provisional") !== null,
    courseIds: formData.getAll("courseIds").map(String),
  };
}

function rejected<TField extends string, TValues>(error: unknown, values: TValues): EditorFormState<TField, TValues> {
  return { error: errorMessage(error), field: error instanceof FieldError ? (error.field as TField) : undefined, values };
}

export async function createEventAction(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const input = eventInput(formData);
  try {
    createDraftEvent(sqlite, { accountId: await requireAccountId(), blockPlanId, ...input });
  } catch (error) {
    return rejected<EventField, EventInput>(error, input);
  }
  revalidateBlockPlan(blockPlanId);
  return { success: "Der Termin wurde angelegt." };
}

export async function updateEventAction(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const input = eventInput(formData);
  try {
    updateDraftEvent(sqlite, { accountId: await requireAccountId(), eventId, ...input });
  } catch (error) {
    return rejected<EventField, EventInput>(error, input);
  }
  revalidateBlockPlan(blockPlanId);
  return { success: "Die Terminangaben wurden gespeichert." };
}

export async function deleteEventAction(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  try {
    deleteDraftEvent(sqlite, { accountId: await requireAccountId(), eventId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  // The deleted event disappears with its form, so the confirmation lives on the reloaded page instead.
  redirect(`/intern/blockplaene/${blockPlanId}?termin-geloescht=1`);
}

function phaseDetails(formData: FormData): PhaseDetails {
  return {
    semester: String(formData.get("semester") ?? ""),
    type: String(formData.get("type") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
  };
}

function phaseInput(formData: FormData): PhaseInput {
  return { ...phaseDetails(formData), courseIds: formData.getAll("courseIds").map(String) };
}

export async function createPhasesAction(_: PhaseFormState, formData: FormData): Promise<PhaseFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const input = phaseInput(formData);
  let created: string[];
  try {
    created = createDraftPhases(sqlite, { accountId: await requireAccountId(), blockPlanId, ...input });
  } catch (error) {
    return rejected<PhaseField, PhaseInput>(error, input);
  }
  revalidateBlockPlan(blockPlanId);
  // The defaults for the next phase come from the saved draft, so they already include what was just created.
  const selected = blockPlanCourses(blockPlanId).filter((course) => input.courseIds.includes(course.id));
  return {
    success: created.length > 1
      ? `${created.length} eigenständige Kursphasen wurden angelegt — je ausgewähltem Kurs eine.`
      : "Die Kursphase wurde angelegt.",
    next: nextPhaseDefaults({ phases: blockPlanDraftPhases(blockPlanId), courses: selected, semester: Number(input.semester) }),
    token: created[0],
  };
}

export async function updatePhaseAction(_: PhaseDetailsFormState, formData: FormData): Promise<PhaseDetailsFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const phaseId = String(formData.get("phaseId") ?? "");
  const details = phaseDetails(formData);
  try {
    updateDraftPhase(sqlite, { accountId: await requireAccountId(), phaseId, ...details });
  } catch (error) {
    return rejected<PhaseField, PhaseDetails>(error, details);
  }
  revalidateBlockPlan(blockPlanId);
  // A phase may have been moved out of the opened semester; it then leaves the list and the section says where to.
  const saved = Number(details.semester);
  const opened = Number(formData.get("openSemester") ?? saved);
  return { success: "Die Kursphase wurde gespeichert.", movedToSemester: saved === opened ? undefined : saved };
}

export async function deletePhaseAction(_: PhaseFormState, formData: FormData): Promise<PhaseFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const phaseId = String(formData.get("phaseId") ?? "");
  try {
    deleteDraftPhase(sqlite, { accountId: await requireAccountId(), phaseId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  return { success: "Die Kursphase wurde aus dem Entwurf gelöscht." };
}

export async function deleteBlockPlanAction(_: BlockPlanFormState, formData: FormData): Promise<BlockPlanFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  try {
    deleteBlockPlan(sqlite, { accountId: await requireAccountId(), blockPlanId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  redirect("/intern?blockplan-geloescht=1");
}
