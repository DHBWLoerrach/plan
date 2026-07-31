import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { productionOrigin } from "@/lib/product";

const baseUrl = productionOrigin;
const databases: Database.Database[] = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
  delete (globalThis as typeof globalThis & { dhbwSqlite?: Database.Database }).dhbwSqlite;
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/**
 * The seam between the application's own SQL and the configured Drizzle adapter, not Better Auth on
 * its own: `lib/services/password-link.ts` writes `user` and `account` timestamps as epoch
 * milliseconds directly, while Better Auth writes the `session` of the same sign-in through the
 * adapter. Both have to agree on one representation — Better Auth's raw SQLite adapter would put ISO
 * strings in the same columns. An upgrade that changes this is a real finding, not test noise. It
 * belongs to local accounts and goes when they do.
 */
describe("Better Auth storage", () => {
  it("stores shared authentication timestamps as epoch-millisecond integers", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "dhbw-mgmt-auth-storage-"));
    temporaryDirectories.push(directory);
    vi.stubEnv("DATABASE_URL", path.join(directory, "database.sqlite"));
    vi.stubEnv("BETTER_AUTH_URL", baseUrl);
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
    vi.resetModules();
    const [{ auth }, { sqlite }] = await Promise.all([
      import("@/lib/auth"),
      import("@/lib/db"),
    ]);
    databases.push(sqlite);
    const password = "ein-sicheres-passwort";
    const now = Date.now();
    const userId = "auth-storage-user";
    sqlite.prepare(`INSERT INTO user
      (id, name, email, email_verified, role, system_admin, status, created_at, updated_at)
      VALUES (?, ?, ?, 0, 'NONE', 1, 'ACTIVE', ?, ?)`).run(
      userId,
      "Testkonto",
      "testkonto@dhbw-loerrach.de",
      now,
      now,
    );
    sqlite.prepare(`INSERT INTO account
      (id, account_id, provider_id, user_id, password, created_at, updated_at)
      VALUES (?, ?, 'credential', ?, ?, ?, ?)`).run(
      "auth-storage-account",
      userId,
      userId,
      await hashPassword(password),
      now,
      now,
    );

    const response = await auth.handler(new Request(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({
        email: "testkonto@dhbw-loerrach.de",
        password,
      }),
    }));

    expect(response.status).toBe(200);
    expect(sqlite.prepare(`SELECT
      typeof(user.created_at) AS userCreatedAt,
      typeof(user.updated_at) AS userUpdatedAt,
      typeof(account.created_at) AS accountCreatedAt,
      typeof(account.updated_at) AS accountUpdatedAt,
      typeof(session.expires_at) AS sessionExpiresAt,
      typeof(session.created_at) AS sessionCreatedAt,
      typeof(session.updated_at) AS sessionUpdatedAt
      FROM user
      JOIN account ON account.user_id = user.id
      JOIN session ON session.user_id = user.id
      WHERE user.id = ?`).get(userId)).toEqual({
      userCreatedAt: "integer",
      userUpdatedAt: "integer",
      accountCreatedAt: "integer",
      accountUpdatedAt: "integer",
      sessionExpiresAt: "integer",
      sessionCreatedAt: "integer",
      sessionUpdatedAt: "integer",
    });
  });
});
