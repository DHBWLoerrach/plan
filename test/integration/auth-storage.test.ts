import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const baseUrl = "https://blockplan.dhbw-loerrach.de";
const databases: Database.Database[] = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
  delete (globalThis as typeof globalThis & { dhbwSqlite?: Database.Database }).dhbwSqlite;
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

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
      (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt)
      VALUES (?, ?, ?, 0, 'NONE', 1, 'ACTIVE', ?, ?)`).run(
      userId,
      "Testkonto",
      "testkonto@dhbw-loerrach.de",
      now,
      now,
    );
    sqlite.prepare(`INSERT INTO account
      (id, accountId, providerId, userId, password, createdAt, updatedAt)
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
      typeof(user.createdAt) AS userCreatedAt,
      typeof(user.updatedAt) AS userUpdatedAt,
      typeof(account.createdAt) AS accountCreatedAt,
      typeof(account.updatedAt) AS accountUpdatedAt,
      typeof(session.expiresAt) AS sessionExpiresAt,
      typeof(session.createdAt) AS sessionCreatedAt,
      typeof(session.updatedAt) AS sessionUpdatedAt
      FROM user
      JOIN account ON account.userId = user.id
      JOIN session ON session.userId = user.id
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
