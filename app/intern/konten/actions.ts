"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { sqlite } from "@/lib/db";
import { normalizeEmail } from "@/lib/domain/account-email.mjs";
import { getActiveAccount } from "@/lib/internal-auth";
import {
  createInternalAccount,
  issuePasswordLink,
  lockInternalAccount,
  unlockInternalAccount,
  updateAccountEmail,
  updateAccountPermissions,
} from "@/lib/services/account-admin";
import { passwordLinkUrl } from "@/lib/services/password-link-token.mjs";

import { errorMessage } from "../action-helpers";

const notAuthorizedMessage = "Sie sind nicht zur Kontoverwaltung berechtigt.";

async function requireSystemAdmin() {
  const account = await getActiveAccount();
  if (!account?.systemAdmin) throw new Error(notAuthorizedMessage);
  return account;
}

function readPermissions(formData: FormData) {
  const role = formData.get("role") === "AREA_EDITOR" ? "AREA_EDITOR" : "NONE";
  const systemAdmin = formData.get("systemAdmin") === "on";
  const areaIds = role === "AREA_EDITOR" ? formData.getAll("areaIds").map(String).filter(Boolean) : [];
  return { role, systemAdmin, areaIds } as const;
}

async function requestOrigin() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

function revalidateAccount(userId: string) {
  revalidatePath("/intern/konten");
  revalidatePath(`/intern/konten/${userId}`);
}

export type CreateAccountState = { error?: string; passwordLink?: string; email?: string };

export async function createAccountAction(_: CreateAccountState, formData: FormData): Promise<CreateAccountState> {
  try {
    await requireSystemAdmin();
    const email = String(formData.get("email") ?? "");
    const token = createInternalAccount(sqlite, { email, ...readPermissions(formData) });
    revalidatePath("/intern/konten");
    // The address shown next to the link is the one that was stored, normalised by the same rule.
    return { passwordLink: passwordLinkUrl(token, await requestOrigin()), email: normalizeEmail(email) };
  } catch (error) {
    return { error: errorMessage(error), email: String(formData.get("email") ?? "") };
  }
}

export type AccountActionState = { error?: string; success?: string; passwordLink?: string };

export async function updateEmailAction(_: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    await requireSystemAdmin();
    const userId = String(formData.get("userId") ?? "");
    updateAccountEmail(sqlite, { userId, email: String(formData.get("email") ?? "") });
    revalidateAccount(userId);
    return { success: "Die E-Mail-Adresse wurde geändert." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function updatePermissionsAction(_: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    await requireSystemAdmin();
    const userId = String(formData.get("userId") ?? "");
    updateAccountPermissions(sqlite, { userId, ...readPermissions(formData) });
    revalidateAccount(userId);
    return { success: "Rollen und Bereiche wurden aktualisiert." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function issueLinkAction(_: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    await requireSystemAdmin();
    const userId = String(formData.get("userId") ?? "");
    const token = issuePasswordLink(sqlite, userId);
    revalidateAccount(userId);
    return { passwordLink: passwordLinkUrl(token, await requestOrigin()), success: "Ein neuer Passwortlink wurde ausgestellt." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function lockAction(_: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    await requireSystemAdmin();
    const userId = String(formData.get("userId") ?? "");
    lockInternalAccount(sqlite, userId);
    revalidateAccount(userId);
    return { success: "Das Konto wurde gesperrt." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function unlockAction(_: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    await requireSystemAdmin();
    const userId = String(formData.get("userId") ?? "");
    const token = unlockInternalAccount(sqlite, userId);
    revalidateAccount(userId);
    return { passwordLink: passwordLinkUrl(token, await requestOrigin()), success: "Das Konto wurde freigegeben." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
