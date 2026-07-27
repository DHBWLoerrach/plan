import { createHash, randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { maximumPasswordLength, minimumPasswordLength, specialCharacterPattern } from "@/lib/domain/password-rules";
import { issuePasswordLinkToken } from "@/lib/services/password-link-token.mjs";

const invalidPasswordLinkMessage = "Der Passwortlink ist ungültig oder abgelaufen.";

type PasswordHasher = (password: string) => Promise<string>;
type PasswordVerifier = (hash: string, password: string) => Promise<boolean>;

type RedeemPasswordLinkInput = {
  token: string;
  password: string;
  now?: Date;
  hashPassword: PasswordHasher;
};

type PasswordLink = { userId: string; expiresAt: string };

type AccountStatus = "ACTIVE" | "LOCKED" | "PASSWORD_PENDING";

export async function redeemPasswordLink(sqlite: Database.Database, input: RedeemPasswordLinkInput) {
  validatePassword(input.password);
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const now = input.now ?? new Date();
  const link = findPasswordLink(sqlite, tokenHash);
  if (!link || !isUsableLink(sqlite, link, now)) throw new Error(invalidPasswordLinkMessage);

  const passwordHash = await input.hashPassword(input.password);
  sqlite.transaction(() => {
    const transactionNow = input.now ?? new Date();
    const currentLink = findPasswordLink(sqlite, tokenHash);
    if (!currentLink || !isUsableLink(sqlite, currentLink, transactionNow)) throw new Error(invalidPasswordLinkMessage);

    const account = sqlite.prepare("SELECT id FROM account WHERE userId = ? AND providerId = 'credential'").get(currentLink.userId) as { id: string } | undefined;
    if (account) {
      sqlite.prepare("UPDATE account SET password = ?, updatedAt = ? WHERE id = ?").run(passwordHash, transactionNow.getTime(), account.id);
    } else {
      sqlite.prepare(`
        INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), currentLink.userId, "credential", currentLink.userId, passwordHash, transactionNow.getTime(), transactionNow.getTime());
    }
    sqlite.prepare("DELETE FROM session WHERE userId = ?").run(currentLink.userId);
    sqlite.prepare("UPDATE user SET status = 'ACTIVE', updatedAt = ? WHERE id = ?").run(transactionNow.getTime(), currentLink.userId);
    sqlite.prepare("DELETE FROM password_links WHERE user_id = ?").run(currentLink.userId);
  })();
}

export async function changeAccountPassword(sqlite: Database.Database, input: {
  userId: string;
  currentSessionId: string;
  currentPassword: string;
  newPassword: string;
  hashPassword: PasswordHasher;
  verifyPassword: PasswordVerifier;
}) {
  validatePassword(input.newPassword);
  const account = findCredentialAccount(sqlite, input.userId);
  if (!account?.password || !await input.verifyPassword(account.password, input.currentPassword)) {
    throw new Error("Das bisherige Passwort ist nicht korrekt.");
  }
  const passwordHash = await input.hashPassword(input.newPassword);
  sqlite.transaction(() => {
    const currentAccount = findCredentialAccount(sqlite, input.userId);
    if (!currentAccount) throw new Error("Das bisherige Passwort ist nicht korrekt.");
    sqlite.prepare("UPDATE account SET password = ?, updatedAt = ? WHERE id = ?").run(passwordHash, Date.now(), currentAccount.id);
    sqlite.prepare("DELETE FROM session WHERE userId = ? AND id <> ?").run(input.userId, input.currentSessionId);
  })();
}

export function resetAccountPassword(sqlite: Database.Database, userId: string, now = new Date()) {
  return transitionToPasswordPending(sqlite, userId, ["ACTIVE"], now);
}

export function unlockAccount(sqlite: Database.Database, userId: string, now = new Date()) {
  return transitionToPasswordPending(sqlite, userId, ["LOCKED"], now);
}

export function reissuePasswordLink(sqlite: Database.Database, userId: string, now = new Date()) {
  return transitionToPasswordPending(sqlite, userId, ["PASSWORD_PENDING"], now);
}

export function lockAccount(sqlite: Database.Database, userId: string, now = new Date()) {
  sqlite.transaction(() => {
    const user = findUser(sqlite, userId);
    if (!user || user.status === "LOCKED") throw new Error("Das interne Konto kann nicht gesperrt werden.");
    sqlite.prepare("DELETE FROM account WHERE userId = ? AND providerId = 'credential'").run(userId);
    sqlite.prepare("DELETE FROM session WHERE userId = ?").run(userId);
    sqlite.prepare("DELETE FROM password_links WHERE user_id = ?").run(userId);
    sqlite.prepare("UPDATE user SET status = 'LOCKED', updatedAt = ? WHERE id = ?").run(now.getTime(), userId);
  })();
}

export function validatePassword(password: string) {
  const length = [...password].length;
  if (length < minimumPasswordLength) throw new Error(`Das Passwort muss mindestens ${minimumPasswordLength} Zeichen lang sein.`);
  if (length > maximumPasswordLength) throw new Error(`Das Passwort darf höchstens ${maximumPasswordLength} Zeichen lang sein.`);
  if (!/\p{Lu}/u.test(password)) throw new Error("Das Passwort muss mindestens einen Großbuchstaben enthalten.");
  if (!/\p{Nd}/u.test(password)) throw new Error("Das Passwort muss mindestens eine Ziffer enthalten.");
  if (!specialCharacterPattern.test(password)) throw new Error("Das Passwort muss mindestens ein zulässiges Sonderzeichen enthalten.");
}

function findPasswordLink(sqlite: Database.Database, tokenHash: string) {
  return sqlite.prepare("SELECT user_id AS userId, expires_at AS expiresAt FROM password_links WHERE token_hash = ?").get(tokenHash) as PasswordLink | undefined;
}

function transitionToPasswordPending(sqlite: Database.Database, userId: string, allowedStatuses: AccountStatus[], now: Date) {
  return sqlite.transaction(() => {
    const user = findUser(sqlite, userId);
    if (!user || !allowedStatuses.includes(user.status as AccountStatus)) throw new Error("Das interne Konto kann keinen Passwortlink erhalten.");
    sqlite.prepare("DELETE FROM account WHERE userId = ? AND providerId = 'credential'").run(userId);
    sqlite.prepare("DELETE FROM session WHERE userId = ?").run(userId);
    sqlite.prepare("UPDATE user SET status = 'PASSWORD_PENDING', updatedAt = ? WHERE id = ?").run(now.getTime(), userId);
    return issuePasswordLinkToken(sqlite, userId, now);
  })();
}

function findUser(sqlite: Database.Database, userId: string) {
  return sqlite.prepare("SELECT status FROM user WHERE id = ?").get(userId) as { status: string } | undefined;
}

function findCredentialAccount(sqlite: Database.Database, userId: string) {
  return sqlite.prepare("SELECT id, password FROM account WHERE userId = ? AND providerId = 'credential'").get(userId) as { id: string; password: string | null } | undefined;
}

function isUsableLink(sqlite: Database.Database, link: PasswordLink, now: Date) {
  const expiresAt = new Date(link.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return false;
  const user = findUser(sqlite, link.userId);
  return user?.status === "PASSWORD_PENDING";
}
