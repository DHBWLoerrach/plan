import { existsSync } from "node:fs";

import Database from "better-sqlite3";

import { issuePasswordLinkToken, passwordLinkUrl } from "./password-link-token.mjs";

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
 * Issues a password link and puts it where a command can print it: the application shows the link in the browser of
 * the administrator who triggered it, a command has only its output.
 *
 * @param {import("better-sqlite3").Database} sqlite
 * @param {string} userId
 * @param {URL} baseUrl
 * @param {Date} now
 * @returns {string} The link whose token lives exclusively in the URL fragment.
 */
export function issuePasswordLink(sqlite, userId, baseUrl, now) {
  return passwordLinkUrl(issuePasswordLinkToken(sqlite, userId, now), baseUrl);
}
