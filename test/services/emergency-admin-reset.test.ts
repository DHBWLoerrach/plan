import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { resetSystemAdminPassword } from "@/lib/services/emergency-admin-reset.mjs";

const temporaryDirectories: string[] = [];

type AccountSeed = { email?: string; systemAdmin?: number; status?: string };

function createDatabase({ email = "admin@dhbw-loerrach.de", systemAdmin = 1, status = "ACTIVE" }: AccountSeed = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dhbw-mgmt-emergency-reset-"));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, "database.sqlite");
  const sqlite = new Database(databasePath);
  sqlite.exec(readFileSync(path.join(process.cwd(), "migrations/0000_initial.sql"), "utf8"));
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "admin-1", email, email, 0, "NONE", systemAdmin, status, 1000, 1000,
  );
  sqlite.prepare("INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "account-1", "admin-1", "credential", "admin-1", "scrypt-hash", 1000, 1000,
  );
  sqlite.prepare("INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
    "session-1", "token-1", "admin-1", Date.now() + 1000, 1000, 1000,
  );
  sqlite.close();
  return databasePath;
}

const validInput = { baseUrl: "https://blockplan.dhbw-loerrach.de", authSecret: "a".repeat(32) };

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("resetSystemAdminPassword", () => {
  it("prints the complete password link exactly once when invoked as a CLI command", () => {
    const databasePath = createDatabase();

    const output = execFileSync(process.execPath, [path.join(process.cwd(), "scripts/reset-admin-password.mjs"), "--email", "admin@dhbw-loerrach.de"], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: databasePath, BETTER_AUTH_SECRET: "a".repeat(32), BETTER_AUTH_URL: "https://blockplan.dhbw-loerrach.de" },
    });

    expect(output.split("\n").filter(Boolean)).toHaveLength(1);
    expect(output).toMatch(/^https:\/\/blockplan\.dhbw-loerrach\.de\/intern\/passwort-vergeben#[A-Za-z0-9_-]+\n$/);
  });

  it("revokes password and sessions of the last active system administration account and issues a hashed link", () => {
    const databasePath = createDatabase();

    const passwordLink = resetSystemAdminPassword({ ...validInput, databasePath, email: "Admin@dhbw-loerrach.de" });

    const token = new URL(passwordLink).hash.slice(1);
    const sqlite = new Database(databasePath, { readonly: true });
    expect(sqlite.prepare("SELECT status, system_admin AS systemAdmin FROM user WHERE id = 'admin-1'").get()).toEqual({ status: "PASSWORD_PENDING", systemAdmin: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM account WHERE userId = 'admin-1'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM session WHERE userId = 'admin-1'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash FROM password_links WHERE user_id = 'admin-1'").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
    sqlite.close();
  });

  it("replaces an open password link of an account still awaiting its first password", () => {
    const databasePath = createDatabase({ status: "PASSWORD_PENDING" });
    const seedDatabase = new Database(databasePath);
    seedDatabase.prepare("INSERT INTO password_links (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(
      "link-1", "admin-1", "previous-hash", "2030-01-08T00:00:00.000Z", "2030-01-01T00:00:00.000Z",
    );
    seedDatabase.close();

    const token = new URL(resetSystemAdminPassword({ ...validInput, databasePath, email: "admin@dhbw-loerrach.de" })).hash.slice(1);

    const sqlite = new Database(databasePath, { readonly: true });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash FROM password_links WHERE user_id = 'admin-1'").all()).toEqual([
      { tokenHash: createHash("sha256").update(token).digest("hex") },
    ]);
    sqlite.close();
  });

  it("refuses accounts it would have to create or grant permissions for, and locked accounts", () => {
    expect(() => resetSystemAdminPassword({ ...validInput, databasePath: createDatabase(), email: "unbekannt@dhbw-loerrach.de" }))
      .toThrow("kein internes Konto");
    expect(() => resetSystemAdminPassword({ ...validInput, databasePath: createDatabase({ systemAdmin: 0 }), email: "admin@dhbw-loerrach.de" }))
      .toThrow("keine Systemadministration");
    expect(() => resetSystemAdminPassword({ ...validInput, databasePath: createDatabase({ status: "LOCKED" }), email: "admin@dhbw-loerrach.de" }))
      .toThrow("freigegeben");
  });

  it("leaves the account untouched when it refuses", () => {
    const databasePath = createDatabase({ systemAdmin: 0 });

    expect(() => resetSystemAdminPassword({ ...validInput, databasePath, email: "admin@dhbw-loerrach.de" })).toThrow();

    const sqlite = new Database(databasePath, { readonly: true });
    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'admin-1'").get()).toEqual({ status: "ACTIVE" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM account WHERE userId = 'admin-1'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM session WHERE userId = 'admin-1'").get()).toEqual({ count: 1 });
    sqlite.close();
  });

  it("rejects missing configuration before touching the database", () => {
    expect(() => resetSystemAdminPassword({ ...validInput, databasePath: createDatabase(), email: "admin@dhbw-loerrach.de", authSecret: "" }))
      .toThrow("BETTER_AUTH_SECRET");
    expect(() => resetSystemAdminPassword({ ...validInput, databasePath: "", email: "admin@dhbw-loerrach.de" }))
      .toThrow("DATABASE_URL");
  });
});
