import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { productionOrigin } from "@/lib/product";
import { bootstrapInitialSystemAdmin } from "@/lib/services/initial-admin.mjs";
import { applySchema, migrationIds } from "@/test/schema";

const temporaryDirectories: string[] = [];
// Intentionally literal: these CLI tests protect the decided production host instead of mirroring their input.
const productionPasswordLinkPattern = /^https:\/\/plan\.apps\.szi\.dhbw-loerrach\.de\/intern\/passwort-vergeben#[A-Za-z0-9_-]+\n$/;

function createDatabase({ migrated = true }: { migrated?: boolean } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dhbw-mgmt-initial-admin-"));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, "database.sqlite");
  const sqlite = new Database(databasePath);
  sqlite.exec("CREATE TABLE _migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
  applySchema(sqlite);
  if (migrated) {
    const record = sqlite.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)");
    for (const migrationId of migrationIds()) record.run(migrationId, new Date().toISOString());
  }
  sqlite.close();
  return databasePath;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("bootstrapInitialSystemAdmin", () => {
  it("prints the complete password link exactly once when invoked as a CLI command", () => {
    const databasePath = createDatabase();

    const output = execFileSync(process.execPath, [path.join(process.cwd(), "scripts/bootstrap-admin.mjs"), "--email", "admin@dhbw-loerrach.de"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: databasePath,
        BETTER_AUTH_SECRET: "a".repeat(32),
        BETTER_AUTH_URL: productionOrigin,
      },
    });

    expect(output.split("\n").filter(Boolean)).toHaveLength(1);
    expect(output).toMatch(productionPasswordLinkPattern);
  });

  it("creates the first pending system administration account and a hashed password link", () => {
    const databasePath = createDatabase();

    const passwordLink = bootstrapInitialSystemAdmin({
      databasePath,
      email: "Admin@dhbw-loerrach.de",
      baseUrl: productionOrigin,
      authSecret: "a".repeat(32),
    });

    const token = new URL(passwordLink).hash.slice(1);
    const sqlite = new Database(databasePath, { readonly: true });
    expect(`${passwordLink}\n`).toMatch(productionPasswordLinkPattern);
    expect(sqlite.prepare("SELECT email, name, role, system_admin AS systemAdmin, status FROM users").all()).toEqual([
      {
        email: "admin@dhbw-loerrach.de",
        name: "admin@dhbw-loerrach.de",
        role: "NONE",
        systemAdmin: 1,
        status: "PASSWORD_PENDING",
      },
    ]);
    expect(sqlite.prepare("SELECT token_hash AS tokenHash FROM password_links").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
    sqlite.close();
  });

  it("rejects a second bootstrap attempt without changing the existing account", () => {
    const databasePath = createDatabase();
    const sqlite = new Database(databasePath);
    sqlite.prepare("INSERT INTO users (id, name, email, email_verified, role, system_admin, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "existing-user", "existing@example.test", "existing@example.test", 0, "NONE", 1, "PASSWORD_PENDING", Date.now(), Date.now(),
    );
    sqlite.close();

    expect(() => bootstrapInitialSystemAdmin({
      databasePath,
      email: "admin@dhbw-loerrach.de",
      baseUrl: productionOrigin,
      authSecret: "a".repeat(32),
    })).toThrow("Es existiert bereits ein internes Konto");

    const verificationDatabase = new Database(databasePath, { readonly: true });
    expect(verificationDatabase.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 });
    verificationDatabase.close();
  });

  it("rejects missing migrations and configuration before creating an account", () => {
    const databasePath = createDatabase({ migrated: false });

    expect(() => bootstrapInitialSystemAdmin({
      databasePath,
      email: "admin@dhbw-loerrach.de",
      baseUrl: productionOrigin,
      authSecret: "a".repeat(32),
    })).toThrow("Ausstehende Migrationen");
    expect(() => bootstrapInitialSystemAdmin({
      databasePath: createDatabase(),
      email: "admin@dhbw-loerrach.de",
      baseUrl: productionOrigin,
      authSecret: "",
    })).toThrow("BETTER_AUTH_SECRET");
  });

  it("rejects database foreign-key violations before creating an account", () => {
    const databasePath = createDatabase();
    const sqlite = new Database(databasePath);
    sqlite.pragma("foreign_keys = OFF");
    sqlite.prepare("INSERT INTO accounts (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "orphan-account", "orphan-account", "credential", "missing-user", Date.now(), Date.now(),
    );
    sqlite.close();

    expect(() => bootstrapInitialSystemAdmin({
      databasePath,
      email: "admin@dhbw-loerrach.de",
      baseUrl: productionOrigin,
      authSecret: "a".repeat(32),
    })).toThrow("Fremdschlüsselintegrität");
  });
});
