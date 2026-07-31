import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { productionOrigin } from "@/lib/product";
import { resetSystemAdminPassword } from "@/lib/services/emergency-admin-reset.mjs";
import { applySchema } from "@/test/schema";

const temporaryDirectories: string[] = [];
// Intentionally literal: this CLI test protects the decided production host instead of mirroring its input.
const productionPasswordLinkPattern = /^https:\/\/plan\.apps\.szi\.dhbw-loerrach\.de\/intern\/passwort-vergeben#[A-Za-z0-9_-]+\n$/;

type AccountSeed = { email?: string; systemAdmin?: number; status?: string };

function createDatabase({ email = "admin@dhbw-loerrach.de", systemAdmin = 1, status = "ACTIVE" }: AccountSeed = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dhbw-mgmt-emergency-reset-"));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, "database.sqlite");
  const sqlite = new Database(databasePath);
  applySchema(sqlite);
  sqlite.prepare("INSERT INTO users (id, name, email, email_verified, role, system_admin, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "admin-1", email, email, 0, "NONE", systemAdmin, status, 1000, 1000,
  );
  sqlite.prepare("INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "account-1", "admin-1", "credential", "admin-1", "scrypt-hash", 1000, 1000,
  );
  sqlite.prepare("INSERT INTO sessions (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    "session-1", "token-1", "admin-1", Date.now() + 1000, 1000, 1000,
  );
  sqlite.close();
  return databasePath;
}

const validInput = { baseUrl: productionOrigin, authSecret: "a".repeat(32) };

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("resetSystemAdminPassword", () => {
  it("prints the complete password link exactly once when invoked as a CLI command", () => {
    const databasePath = createDatabase();

    const output = execFileSync(process.execPath, [path.join(process.cwd(), "scripts/reset-admin-password.mjs"), "--email", "admin@dhbw-loerrach.de"], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: databasePath, BETTER_AUTH_SECRET: "a".repeat(32), BETTER_AUTH_URL: productionOrigin },
    });

    expect(output.split("\n").filter(Boolean)).toHaveLength(1);
    expect(output).toMatch(productionPasswordLinkPattern);
  });

  it("revokes password and sessions of the last active system administration account and issues a hashed link", () => {
    const databasePath = createDatabase();

    const passwordLink = resetSystemAdminPassword({ ...validInput, databasePath, email: "Admin@dhbw-loerrach.de" });

    const token = new URL(passwordLink).hash.slice(1);
    const sqlite = new Database(databasePath, { readonly: true });
    expect(sqlite.prepare("SELECT status, system_admin AS systemAdmin FROM users WHERE id = 'admin-1'").get()).toEqual({ status: "PASSWORD_PENDING", systemAdmin: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM accounts WHERE user_id = 'admin-1'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = 'admin-1'").get()).toEqual({ count: 0 });
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
    expect(sqlite.prepare("SELECT status FROM users WHERE id = 'admin-1'").get()).toEqual({ status: "ACTIVE" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM accounts WHERE user_id = 'admin-1'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = 'admin-1'").get()).toEqual({ count: 1 });
    sqlite.close();
  });

  it("rejects missing configuration before touching the database", () => {
    expect(() => resetSystemAdminPassword({ ...validInput, databasePath: createDatabase(), email: "admin@dhbw-loerrach.de", authSecret: "" }))
      .toThrow("BETTER_AUTH_SECRET");
    expect(() => resetSystemAdminPassword({ ...validInput, databasePath: "", email: "admin@dhbw-loerrach.de" }))
      .toThrow("DATABASE_URL");
  });
});
