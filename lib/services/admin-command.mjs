import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import Database from "better-sqlite3";

const passwordLinkLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new Error("Eine gültige dienstliche E-Mail-Adresse ist erforderlich.");
  return email;
}

export function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("BETTER_AUTH_URL muss eine vollständige HTTP(S)-URL sein.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("BETTER_AUTH_URL muss eine vollständige HTTP(S)-URL ohne Zugangsdaten, Query oder Fragment sein.");
  }
  return url;
}

export function assertAuthSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET muss gesetzt sein und mindestens 32 Zeichen enthalten.");
  }
}

export function openOperationalDatabase(databasePath) {
  if (!databasePath || !existsSync(databasePath)) throw new Error("DATABASE_URL muss auf eine vorhandene SQLite-Datenbank zeigen.");
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

/**
 * Replaces any open password link of the account with a fresh, only-hashed one-time link.
 *
 * @returns {string} The link whose token lives exclusively in the URL fragment.
 */
export function issuePasswordLink(sqlite, userId, baseUrl, now) {
  const token = randomBytes(32).toString("base64url");
  sqlite.prepare("DELETE FROM password_links WHERE user_id = ?").run(userId);
  sqlite.prepare(`
    INSERT INTO password_links (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    randomUUID(), userId, createHash("sha256").update(token).digest("hex"),
    new Date(now.getTime() + passwordLinkLifetimeMs).toISOString(), now.toISOString(),
  );

  const passwordLink = new URL("/intern/passwort-vergeben", baseUrl);
  passwordLink.hash = token;
  return passwordLink.toString();
}
