import { createHash, randomUUID } from "node:crypto";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { changeAccountPassword, lockAccount, redeemPasswordLink, resetAccountPassword, unlockAccount } from "@/lib/services/password-link";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

function databaseWithPasswordLink({ expiresAt = "2030-01-08T00:00:00.000Z", status = "PASSWORD_PENDING" }: { expiresAt?: string; status?: string } = {}) {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "user-1", "admin@example.test", "admin@example.test", 0, "NONE", 1, status, Date.now(), Date.now(),
  );
  const token = "password-link-token";
  sqlite.prepare("INSERT INTO password_links (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(
    randomUUID(), "user-1", createHash("sha256").update(token).digest("hex"), expiresAt, "2030-01-01T00:00:00.000Z",
  );
  return { sqlite, token };
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("redeemPasswordLink", () => {
  it("activates the account, stores the Better Auth password hash and consumes the link", async () => {
    const { sqlite, token } = databaseWithPasswordLink();
    sqlite.prepare("INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
      "old-session", "old-session-token", "user-1", Date.now() + 60_000, Date.now(), Date.now(),
    );

    await redeemPasswordLink(sqlite, {
      token,
      password: "ein-sehr-langes-passwort",
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword: async (password) => `better-auth:${password}`,
    });

    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'user-1'").get()).toEqual({ status: "ACTIVE" });
    expect(sqlite.prepare("SELECT providerId, accountId, password FROM account WHERE userId = 'user-1'").get()).toEqual({
      providerId: "credential", accountId: "user-1", password: "better-auth:ein-sehr-langes-passwort",
    });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM session").get()).toEqual({ count: 0 });
  });

  it("rejects expired and previously consumed links without changing the account", async () => {
    const { sqlite, token } = databaseWithPasswordLink({ expiresAt: "2030-01-01T00:00:00.000Z" });

    await expect(redeemPasswordLink(sqlite, {
      token,
      password: "ein-sehr-langes-passwort",
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword: async (password) => `better-auth:${password}`,
    })).rejects.toThrow("ungültig oder abgelaufen");
    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'user-1'").get()).toEqual({ status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 1 });
  });

  it("allows the link to be used only once", async () => {
    const { sqlite, token } = databaseWithPasswordLink();
    const input = {
      token,
      password: "ein-sehr-langes-passwort",
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword: async (password: string) => `better-auth:${password}`,
    };

    await redeemPasswordLink(sqlite, input);
    await expect(redeemPasswordLink(sqlite, input)).rejects.toThrow("ungültig oder abgelaufen");
  });

  it("rejects a link for an account that no longer awaits password assignment", async () => {
    const { sqlite, token } = databaseWithPasswordLink({ status: "ACTIVE" });
    const hashPassword = async (password: string) => `better-auth:${password}`;

    await expect(redeemPasswordLink(sqlite, {
      token,
      password: "ein-sehr-langes-passwort",
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword,
    })).rejects.toThrow("ungültig oder abgelaufen");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 1 });
  });

  it("enforces Better Auth's configured password length before consuming the link", async () => {
    const { sqlite, token } = databaseWithPasswordLink();

    await expect(redeemPasswordLink(sqlite, {
      token,
      password: "zu-kurz",
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword: async (password) => `better-auth:${password}`,
    })).rejects.toThrow("mindestens 15");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 1 });
  });

  it("resets an active account by revoking its password and sessions before issuing a new hashed link", () => {
    const { sqlite } = databaseWithPasswordLink({ status: "ACTIVE" });
    sqlite.prepare("INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "credential-account", "user-1", "credential", "user-1", "old-hash", Date.now(), Date.now(),
    );
    sqlite.prepare("INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
      "old-session", "old-session-token", "user-1", Date.now() + 60_000, Date.now(), Date.now(),
    );

    const token = resetAccountPassword(sqlite, "user-1", new Date("2030-01-01T00:00:00.000Z"));

    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'user-1'").get()).toEqual({ status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM account").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM session").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash, expires_at AS expiresAt FROM password_links").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: "2030-01-08T00:00:00.000Z",
    });
  });

  it("locks an account by removing its local credential, sessions and open link, then can unlock it with a new link", () => {
    const { sqlite } = databaseWithPasswordLink({ status: "ACTIVE" });
    sqlite.prepare("INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "credential-account", "user-1", "credential", "user-1", "old-hash", Date.now(), Date.now(),
    );
    sqlite.prepare("INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
      "old-session", "old-session-token", "user-1", Date.now() + 60_000, Date.now(), Date.now(),
    );

    lockAccount(sqlite, "user-1", new Date("2030-01-01T00:00:00.000Z"));
    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'user-1'").get()).toEqual({ status: "LOCKED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM account").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM session").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 0 });

    const token = unlockAccount(sqlite, "user-1", new Date("2030-01-02T00:00:00.000Z"));
    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'user-1'").get()).toEqual({ status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash FROM password_links").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
  });

  it("keeps the current session while changing the password and revokes the other sessions", async () => {
    const { sqlite } = databaseWithPasswordLink({ status: "ACTIVE" });
    sqlite.prepare("INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "credential-account", "user-1", "credential", "user-1", "old-hash", Date.now(), Date.now(),
    );
    for (const sessionId of ["current-session", "other-session"]) {
      sqlite.prepare("INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
        sessionId, `${sessionId}-token`, "user-1", Date.now() + 60_000, Date.now(), Date.now(),
      );
    }

    await changeAccountPassword(sqlite, {
      userId: "user-1",
      currentSessionId: "current-session",
      currentPassword: "bisheriges-passwort",
      newPassword: "ein-sehr-langes-passwort",
      hashPassword: async (password) => `better-auth:${password}`,
      verifyPassword: async (hash, password) => hash === "old-hash" && password === "bisheriges-passwort",
    });

    expect(sqlite.prepare("SELECT password FROM account WHERE id = 'credential-account'").get()).toEqual({ password: "better-auth:ein-sehr-langes-passwort" });
    expect(sqlite.prepare("SELECT id FROM session ORDER BY id").all()).toEqual([{ id: "current-session" }]);
  });
});
