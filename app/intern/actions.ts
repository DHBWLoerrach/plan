"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";
import { changeAccountPassword, redeemPasswordLink } from "@/lib/services/password-link";
import { StaleStateError, publishBlockPlan, withdrawBlockPlan } from "@/lib/services/publication";
import { hashPassword, verifyPassword } from "better-auth/crypto";

async function accountId() {
  const account = await getActiveAccount();
  if (!account) throw new Error("Ihre Sitzung ist nicht mehr gültig.");
  return account.id;
}

export type PublicationFormState = { error?: string };

/** Every view a publication or withdrawal changes: the public search and detail page, and the internal pages naming the state. */
function revalidatePublicationViews(blockPlanId: string) {
  revalidatePath("/");
  revalidatePath(`/${blockPlanId}`);
  revalidatePath("/intern");
  revalidatePath("/intern/blockplaene");
  revalidatePath(`/intern/blockplaene/${blockPlanId}`);
  revalidatePath(`/intern/blockplaene/${blockPlanId}/vorschau`);
}

export async function publishAction(_: PublicationFormState, formData: FormData): Promise<PublicationFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const previewPath = `/intern/blockplaene/${blockPlanId}/vorschau`;
  let stale = false;
  try {
    publishBlockPlan(sqlite, {
      blockPlanId,
      accountId: await accountId(),
      seenDraftUpdatedAt: String(formData.get("draftUpdatedAt") ?? ""),
      seenPublishedVersionId: formData.get("publishedVersionId")?.toString() || null,
    });
  } catch (error) {
    // Only a draft that changed under the shown preview gets the reload; every other refusal stays at the button.
    if (!(error instanceof StaleStateError)) {
      return { error: error instanceof Error ? error.message : "Der Blockplan konnte nicht veröffentlicht werden." };
    }
    stale = true;
  }
  // A stale publication wrote nothing, so only the preview itself needs to be read again.
  if (stale) {
    revalidatePath(previewPath);
    redirect(`${previewPath}?geaendert=1`);
  }
  revalidatePublicationViews(blockPlanId);
  redirect(`/intern/blockplaene/${blockPlanId}?veroeffentlicht=1`);
}

export async function withdrawAction(_: PublicationFormState, formData: FormData): Promise<PublicationFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const editorPath = `/intern/blockplaene/${blockPlanId}`;
  let stale = false;
  try {
    withdrawBlockPlan(sqlite, {
      blockPlanId,
      accountId: await accountId(),
      seenPublishedVersionId: String(formData.get("publishedVersionId") ?? ""),
    });
  } catch (error) {
    if (!(error instanceof StaleStateError)) {
      return { error: error instanceof Error ? error.message : "Die Veröffentlichung konnte nicht zurückgenommen werden." };
    }
    stale = true;
  }
  // A withdrawal aimed at a version that is no longer shown wrote nothing; the editor reloads and says so.
  if (stale) {
    revalidatePath(editorPath);
    redirect(`${editorPath}?fassung-veraltet=1`);
  }
  revalidatePublicationViews(blockPlanId);
  redirect(`${editorPath}?zurueckgenommen=1`);
}

export type PasswordLinkActionState = { error?: string };

export async function setPasswordWithLinkAction(_: PasswordLinkActionState, formData: FormData): Promise<PasswordLinkActionState> {
  try {
    await redeemPasswordLink(sqlite, {
      token: String(formData.get("token") ?? ""),
      password: String(formData.get("password") ?? ""),
      hashPassword,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("mindestens") || error.message.includes("höchstens"))) {
      return { error: error.message };
    }
    return { error: "Der Passwortlink ist ungültig oder abgelaufen." };
  }
  redirect("/intern/anmelden?passwort=gesetzt");
}

export type ChangePasswordActionState = { currentPasswordError?: string; formError?: string; newPasswordError?: string; success?: string };

export async function changePasswordAction(_: ChangePasswordActionState, formData: FormData): Promise<ChangePasswordActionState> {
  const account = await getActiveAccount();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!account || !session || session.user.id !== account.id) return { formError: "Ihre Sitzung ist nicht mehr gültig." };
  try {
    await changeAccountPassword(sqlite, {
      userId: account.id,
      currentSessionId: session.session.id,
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      hashPassword,
      verifyPassword: async (hash, password) => verifyPassword({ hash, password }),
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("mindestens") || error.message.includes("höchstens"))) {
      return { newPasswordError: error.message };
    }
    if (error instanceof Error && error.message.includes("bisherige")) return { currentPasswordError: error.message };
    return { formError: "Das Passwort konnte nicht geändert werden." };
  }
  return { success: "Ihr Passwort wurde geändert. Andere Sitzungen wurden beendet." };
}
