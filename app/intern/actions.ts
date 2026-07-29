"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import { FieldError } from "@/lib/domain/field-error";
import { getActiveAccount } from "@/lib/internal-auth";
import { changeAccountPassword, redeemPasswordLink } from "@/lib/services/password-link";
import { hashPassword, verifyPassword } from "better-auth/crypto";

/**
 * Signing out is a form submission rather than a link: a link would be prefetched by Next and would
 * end the session on a mere GET. The session cookie is cleared by the `nextCookies` plugin.
 */
export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/intern/anmelden");
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
    // A rejected password names its rule; everything else about the link stays as unspecific as it has to be.
    if (error instanceof FieldError) return { error: error.message };
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
    if (error instanceof FieldError) {
      return error.field === "currentPassword" ? { currentPasswordError: error.message } : { newPasswordError: error.message };
    }
    return { formError: "Das Passwort konnte nicht geändert werden." };
  }
  return { success: "Ihr Passwort wurde geändert. Andere Sitzungen wurden beendet." };
}
