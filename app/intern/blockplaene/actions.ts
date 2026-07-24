"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";
import { attachCourse, createBlockPlanFromCourse, deleteBlockPlan, detachCourse, renameBlockPlan } from "@/lib/services/block-plan-admin";

export type BlockPlanFormState = { error?: string; success?: string };

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
