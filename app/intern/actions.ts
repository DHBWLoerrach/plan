"use server";

import { revalidatePath } from "next/cache";

import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";
import { publishBlockPlan, withdrawBlockPlan } from "@/lib/services/publication";

async function accountId() {
  const account = await getActiveAccount();
  if (!account) throw new Error("Ihre Sitzung ist nicht mehr gültig.");
  return account.id;
}

export async function publishAction(formData: FormData) {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  publishBlockPlan(sqlite, {
    blockPlanId,
    accountId: await accountId(),
    seenDraftUpdatedAt: String(formData.get("draftUpdatedAt") ?? ""),
    seenPublishedVersionId: formData.get("publishedVersionId")?.toString() || null,
  });
  revalidatePath("/");
  revalidatePath(`/${blockPlanId}`);
  revalidatePath(`/intern/blockplaene/${blockPlanId}`);
}

export async function withdrawAction(formData: FormData) {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  withdrawBlockPlan(sqlite, {
    blockPlanId,
    accountId: await accountId(),
    seenPublishedVersionId: String(formData.get("publishedVersionId") ?? ""),
  });
  revalidatePath("/");
  revalidatePath(`/${blockPlanId}`);
  revalidatePath(`/intern/blockplaene/${blockPlanId}`);
}
