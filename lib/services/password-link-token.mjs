import { createHash, randomBytes, randomUUID } from "node:crypto";

/**
 * The one-time password link itself. The application (`lib/services/password-link.ts`) and the
 * operational commands (`lib/services/admin-command.mjs`) both issue links, and a token issued by
 * one is redeemed by the other — so lifetime, hashing and the replacement of an open link exist
 * once. Two copies could drift into a link the application refuses to accept.
 *
 * JavaScript rather than TypeScript because the operational commands run through `node` without a
 * build step, the same reason `lib/db/migration-order.mjs` gives.
 */

/** Password links expire after seven days. */
const passwordLinkLifetimeMs = 7 * 24 * 60 * 60 * 1000;

/**
 * The address a token is handed out as. The token lives exclusively in the URL fragment, so it reaches no server log
 * and no referrer header — a promise that has to hold for the application and the operational commands alike.
 *
 * @param {string} token
 * @param {URL | string} baseUrl
 * @returns {string}
 */
export function passwordLinkUrl(token, baseUrl) {
  const url = new URL("/intern/passwort-vergeben", baseUrl);
  url.hash = token;
  return url.toString();
}

/**
 * Replaces any open password link of the account with a fresh, only-hashed one-time link.
 *
 * @param {import("better-sqlite3").Database} sqlite
 * @param {string} userId
 * @param {Date} now
 * @returns {string} The plain token; only its hash reaches the database.
 */
export function issuePasswordLinkToken(sqlite, userId, now) {
  const token = randomBytes(32).toString("base64url");
  sqlite.prepare("DELETE FROM password_links WHERE user_id = ?").run(userId);
  sqlite.prepare(`
    INSERT INTO password_links (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    randomUUID(), userId, createHash("sha256").update(token).digest("hex"),
    new Date(now.getTime() + passwordLinkLifetimeMs).toISOString(), now.toISOString(),
  );
  return token;
}
