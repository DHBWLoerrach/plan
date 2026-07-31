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
  sqlite.prepare("INSERT INTO users (id, name, email, email_verified, role, system_admin, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
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
    sqlite.prepare("INSERT INTO sessions (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "old-session", "old-session-token", "user-1", Date.now() + 60_000, Date.now(), Date.now(),
    );

    await redeemPasswordLink(sqlite, {
      token,
      password: "Ein-sehr-langes-Passwort1!",
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword: async (password) => `better-auth:${password}`,
    });

    expect(sqlite.prepare("SELECT status FROM users WHERE id = 'user-1'").get()).toEqual({ status: "ACTIVE" });
    expect(sqlite.prepare("SELECT provider_id AS providerId, account_id AS accountId, password FROM accounts WHERE user_id = 'user-1'").get()).toEqual({
      providerId: "credential", accountId: "user-1", password: "better-auth:Ein-sehr-langes-Passwort1!",
    });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 });
  });

  it("rejects expired and previously consumed links without changing the account", async () => {
    const { sqlite, token } = databaseWithPasswordLink({ expiresAt: "2030-01-01T00:00:00.000Z" });

    await expect(redeemPasswordLink(sqlite, {
      token,
      password: "Ein-sehr-langes-Passwort1!",
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword: async (password) => `better-auth:${password}`,
    })).rejects.toThrow("ungültig oder abgelaufen");
    expect(sqlite.prepare("SELECT status FROM users WHERE id = 'user-1'").get()).toEqual({ status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 1 });
  });

  it("allows the link to be used only once", async () => {
    const { sqlite, token } = databaseWithPasswordLink();
    const input = {
      token,
      password: "Ein-sehr-langes-Passwort1!",
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
      password: "Ein-sehr-langes-Passwort1!",
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword,
    })).rejects.toThrow("ungültig oder abgelaufen");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 1 });
  });

  // Every rule of the password decides alone, and none of them may consume the link on the way.
  it.each([
    { rejected: "shorter than 15 characters", password: "zu-kurz", message: "mindestens 15" },
    { rejected: "without an uppercase letter", password: "einsicherespasswort1!", message: "Großbuchstaben" },
    { rejected: "without a digit", password: "Ein-sicheres-Passwort!", message: "Ziffer" },
    { rejected: "without a special character", password: "EinSicheresPasswort1", message: "Sonderzeichen" },
    { rejected: "with a special character outside the allowed set", password: "EinSicheresPasswort1§", message: "zulässiges Sonderzeichen" },
  ])("rejects a password $rejected before consuming the link", async ({ password, message }) => {
    const { sqlite, token } = databaseWithPasswordLink();

    await expect(redeemPasswordLink(sqlite, {
      token,
      password,
      now: new Date("2030-01-02T00:00:00.000Z"),
      hashPassword: async (value) => `better-auth:${value}`,
    })).rejects.toThrow(message);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 1 });
  });

  it("resets an active account by revoking its password and sessions before issuing a new hashed link", () => {
    const { sqlite } = databaseWithPasswordLink({ status: "ACTIVE" });
    sqlite.prepare("INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "credential-account", "user-1", "credential", "user-1", "old-hash", Date.now(), Date.now(),
    );
    sqlite.prepare("INSERT INTO sessions (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "old-session", "old-session-token", "user-1", Date.now() + 60_000, Date.now(), Date.now(),
    );

    const token = resetAccountPassword(sqlite, "user-1", new Date("2030-01-01T00:00:00.000Z"));

    expect(sqlite.prepare("SELECT status FROM users WHERE id = 'user-1'").get()).toEqual({ status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM accounts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash, expires_at AS expiresAt FROM password_links").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: "2030-01-08T00:00:00.000Z",
    });
  });

  it("locks an account by removing its local credential, sessions and open link, then can unlock it with a new link", () => {
    const { sqlite } = databaseWithPasswordLink({ status: "ACTIVE" });
    sqlite.prepare("INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "credential-account", "user-1", "credential", "user-1", "old-hash", Date.now(), Date.now(),
    );
    sqlite.prepare("INSERT INTO sessions (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "old-session", "old-session-token", "user-1", Date.now() + 60_000, Date.now(), Date.now(),
    );

    lockAccount(sqlite, "user-1", new Date("2030-01-01T00:00:00.000Z"));
    expect(sqlite.prepare("SELECT status FROM users WHERE id = 'user-1'").get()).toEqual({ status: "LOCKED" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM accounts").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links").get()).toEqual({ count: 0 });

    const token = unlockAccount(sqlite, "user-1", new Date("2030-01-02T00:00:00.000Z"));
    expect(sqlite.prepare("SELECT status FROM users WHERE id = 'user-1'").get()).toEqual({ status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash FROM password_links").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
  });

  it("keeps the current session while changing the password and revokes the other sessions", async () => {
    const { sqlite } = databaseWithPasswordLink({ status: "ACTIVE" });
    sqlite.prepare("INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "credential-account", "user-1", "credential", "user-1", "old-hash", Date.now(), Date.now(),
    );
    for (const sessionId of ["current-session", "other-session"]) {
      sqlite.prepare("INSERT INTO sessions (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        sessionId, `${sessionId}-token`, "user-1", Date.now() + 60_000, Date.now(), Date.now(),
      );
    }

    await changeAccountPassword(sqlite, {
      userId: "user-1",
      currentSessionId: "current-session",
      currentPassword: "bisheriges-passwort",
      newPassword: "Ein-sehr-langes-Passwort1!",
      hashPassword: async (password) => `better-auth:${password}`,
      verifyPassword: async (hash, password) => hash === "old-hash" && password === "bisheriges-passwort",
    });

    expect(sqlite.prepare("SELECT password FROM accounts WHERE id = 'credential-account'").get()).toEqual({ password: "better-auth:Ein-sehr-langes-Passwort1!" });
    expect(sqlite.prepare("SELECT id FROM sessions ORDER BY id").all()).toEqual([{ id: "current-session" }]);
  });

  it("keeps the credential and every session when the previous password is wrong", async () => {
    const { sqlite } = databaseWithPasswordLink({ status: "ACTIVE" });
    sqlite.prepare("INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "credential-account", "user-1", "credential", "user-1", "old-hash", Date.now(), Date.now(),
    );
    for (const sessionId of ["current-session", "other-session"]) {
      sqlite.prepare("INSERT INTO sessions (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        sessionId, `${sessionId}-token`, "user-1", Date.now() + 60_000, Date.now(), Date.now(),
      );
    }

    await expect(changeAccountPassword(sqlite, {
      userId: "user-1",
      currentSessionId: "current-session",
      currentPassword: "falsch",
      newPassword: "Ein-sehr-langes-Passwort1!",
      hashPassword: async (password) => `better-auth:${password}`,
      verifyPassword: async () => false,
    })).rejects.toMatchObject({ field: "currentPassword" });

    expect(sqlite.prepare("SELECT password FROM accounts WHERE id = 'credential-account'").get()).toEqual({ password: "old-hash" });
    expect(sqlite.prepare("SELECT id FROM sessions ORDER BY id").pluck().all()).toEqual(["current-session", "other-session"]);
  });
});
