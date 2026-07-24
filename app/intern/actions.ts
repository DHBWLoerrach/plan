"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";
import { changeAccountPassword, redeemPasswordLink } from "@/lib/services/password-link";
import { publishBlockPlan, withdrawBlockPlan } from "@/lib/services/publication";
import { hashPassword, verifyPassword } from "better-auth/crypto";

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
