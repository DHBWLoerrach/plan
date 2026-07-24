"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";
import { attachCourse, createBlockPlanFromCourse, deleteBlockPlan, detachCourse, renameBlockPlan } from "@/lib/services/block-plan-admin";
import { type EventField, EventFieldError, type EventInput, createDraftEvent, deleteDraftEvent, updateDraftEvent } from "@/lib/services/event-admin";

export type BlockPlanFormState = { error?: string; success?: string };

/** A rejected event keeps the entered values and names the field, so the editor can show both (BARRIEREFREIHEIT.md). */
export type EventFormState = BlockPlanFormState & { field?: EventField; values?: EventInput };

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

function rejectedEvent(error: unknown, input: EventInput): EventFormState {
  return { error: errorMessage(error), field: error instanceof EventFieldError ? error.field : undefined, values: input };
}

export async function createEventAction(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const input = eventInput(formData);
  try {
    createDraftEvent(sqlite, { accountId: await requireAccountId(), blockPlanId, ...input });
  } catch (error) {
    return rejectedEvent(error, input);
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
    return rejectedEvent(error, input);
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
