import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";

import { normalizeEmail } from "../domain/account-email.mjs";
import { assertAuthSecret, issuePasswordLink, normalizeBaseUrl, openOperationalDatabase } from "./admin-command.mjs";

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

  const sqlite = openOperationalDatabase(input.databasePath);
  try {
    assertMigrationsApplied(sqlite, input.migrationsDirectory ?? path.join(process.cwd(), "migrations"));
    assertDatabaseIntegrity(sqlite);

    const now = new Date();
    return sqlite.transaction(() => {
      const existingAccount = sqlite.prepare("SELECT 1 FROM users LIMIT 1").get();
      if (existingAccount) throw new Error("Es existiert bereits ein internes Konto. Der Bootstrap-Befehl kann nicht erneut ausgeführt werden.");

      const userId = randomUUID();
      sqlite.prepare(`
        INSERT INTO users (id, name, email, email_verified, role, system_admin, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, email, email, 0, "NONE", 1, "PASSWORD_PENDING", now.getTime(), now.getTime());
      return issuePasswordLink(sqlite, userId, baseUrl, now);
    })();
  } finally {
    sqlite.close();
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
