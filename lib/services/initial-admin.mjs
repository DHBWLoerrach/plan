import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const passwordLinkLifetimeMs = 7 * 24 * 60 * 60 * 1000;

/**
 * @typedef {object} InitialAdminBootstrapInput
 * @property {string} databasePath
 * @property {string} email
 * @property {string} baseUrl
 * @property {string} authSecret
 * @property {string} [migrationsDirectory]
 */

/**
 * Creates the initial, password-pending system administration account.
 *
 * @param {InitialAdminBootstrapInput} input
 * @returns {string} A one-time password link whose token is only in the URL fragment.
 */
export function bootstrapInitialSystemAdmin(input) {
  const email = normalizeEmail(input.email);
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  assertAuthSecret(input.authSecret);
  assertDatabaseExists(input.databasePath);

  const sqlite = new Database(input.databasePath);
  try {
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    assertMigrationsApplied(sqlite, input.migrationsDirectory ?? path.join(process.cwd(), "drizzle"));
    assertDatabaseIntegrity(sqlite);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();
    const timestamp = now.getTime();

    sqlite.transaction(() => {
      const existingAccount = sqlite.prepare("SELECT 1 FROM user LIMIT 1").get();
      if (existingAccount) throw new Error("Es existiert bereits ein internes Konto. Der Bootstrap-Befehl kann nicht erneut ausgeführt werden.");

      const userId = randomUUID();
      sqlite.prepare(`
        INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, email, email, 0, "NONE", 1, "PASSWORD_PENDING", timestamp, timestamp);
      sqlite.prepare(`
        INSERT INTO password_links (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), userId, tokenHash, new Date(timestamp + passwordLinkLifetimeMs).toISOString(), now.toISOString());
    })();

    const passwordLink = new URL("/intern/passwort-vergeben", baseUrl);
    passwordLink.hash = token;
    return passwordLink.toString();
  } finally {
    sqlite.close();
  }
}

function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new Error("Eine gültige dienstliche E-Mail-Adresse ist erforderlich.");
  return email;
}

function normalizeBaseUrl(value) {
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

function assertAuthSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET muss gesetzt sein und mindestens 32 Zeichen enthalten.");
  }
}

function assertDatabaseExists(databasePath) {
  if (!databasePath || !existsSync(databasePath)) {
    throw new Error("DATABASE_URL muss auf eine vorhandene SQLite-Datenbank zeigen.");
  }
}

function assertMigrationsApplied(sqlite, migrationsDirectory) {
  const migrationTable = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migrations'").get();
  if (!migrationTable) throw new Error("Die Migrationstabelle fehlt. Führen Sie zuerst die Migrationen aus.");

  const expectedMigrationIds = readdirSync(migrationsDirectory)
    .filter((fileName) => /^\d+_.+\.sql$/u.test(fileName))
    .map((fileName) => fileName.slice(0, -".sql".length));
  const appliedMigrationIds = new Set(sqlite.prepare("SELECT id FROM _migrations").all().map((migration) => migration.id));
  const missingMigrationIds = expectedMigrationIds.filter((migrationId) => !appliedMigrationIds.has(migrationId));
  if (missingMigrationIds.length > 0) throw new Error(`Ausstehende Migrationen: ${missingMigrationIds.join(", ")}.`);
}

function assertDatabaseIntegrity(sqlite) {
  if (sqlite.pragma("integrity_check", { simple: true }) !== "ok") {
    throw new Error("Die SQLite-Integritätsprüfung ist fehlgeschlagen.");
  }
  if (sqlite.prepare("PRAGMA foreign_key_check").all().length > 0) {
    throw new Error("Die SQLite-Fremdschlüsselintegrität ist verletzt.");
  }
}
