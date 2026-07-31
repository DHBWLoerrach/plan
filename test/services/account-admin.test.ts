import { createHash } from "node:crypto";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createInternalAccount, issuePasswordLink, lockInternalAccount, unlockInternalAccount, updateAccountEmail, updateAccountPermissions } from "@/lib/services/account-admin";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-01", "Technik", "technik");
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-02", "Wirtschaft", "wirtschaft");
  return sqlite;
}

function insertUser(sqlite: Database.Database, overrides: { id: string; email?: string; role?: string; systemAdmin?: number; status?: string }) {
  const email = overrides.email ?? `${overrides.id}@example.test`;
  sqlite.prepare("INSERT INTO user (id, name, email, email_verified, role, system_admin, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    overrides.id, email, email, 0, overrides.role ?? "NONE", overrides.systemAdmin ?? 0, overrides.status ?? "ACTIVE", Date.now(), Date.now(),
  );
}

function addCredential(sqlite: Database.Database, userId: string) {
  sqlite.prepare("INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    `${userId}-credential`, userId, "credential", userId, "old-hash", Date.now(), Date.now(),
  );
  sqlite.prepare("INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    `${userId}-session`, `${userId}-session-token`, userId, Date.now() + 60_000, Date.now(), Date.now(),
  );
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createInternalAccount", () => {
  it("creates a password-pending account with roles, areas and a hashed one-time link", () => {
    const sqlite = createDatabase();

    const token = createInternalAccount(sqlite, {
      email: "  New.User@DHBW-Loerrach.de ",
      role: "AREA_EDITOR",
      systemAdmin: false,
      areaIds: ["area-01", "area-02"],
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    const user = sqlite.prepare("SELECT email, name, role, system_admin AS systemAdmin, status FROM user").get() as Record<string, unknown>;
    expect(user).toEqual({ email: "new.user@dhbw-loerrach.de", name: "new.user@dhbw-loerrach.de", role: "AREA_EDITOR", systemAdmin: 0, status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT area_id AS areaId FROM area_assignments ORDER BY area_id").all()).toEqual([{ areaId: "area-01" }, { areaId: "area-02" }]);
    expect(sqlite.prepare("SELECT token_hash AS tokenHash, expires_at AS expiresAt FROM password_links").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: "2030-01-08T00:00:00.000Z",
    });
  });

  it("creates a pure system administration account without a role or area", () => {
    const sqlite = createDatabase();
    createInternalAccount(sqlite, { email: "admin@dhbw-loerrach.de", role: "NONE", systemAdmin: true, areaIds: [] });
    expect(sqlite.prepare("SELECT role, system_admin AS systemAdmin FROM user").get()).toEqual({ role: "NONE", systemAdmin: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM area_assignments").get()).toEqual({ count: 0 });
  });

  it("rejects invalid combinations, invalid emails and unknown areas without writing", () => {
    const sqlite = createDatabase();
    const base = { role: "NONE" as const, systemAdmin: false, areaIds: [] as string[] };

    expect(() => createInternalAccount(sqlite, { ...base, email: "keine-mail", systemAdmin: true })).toThrow("gültige dienstliche E-Mail-Adresse");
    expect(() => createInternalAccount(sqlite, { email: "no-role@dhbw-loerrach.de", role: "NONE", systemAdmin: false, areaIds: [] })).toThrow("mindestens");
    expect(() => createInternalAccount(sqlite, { email: "editor@dhbw-loerrach.de", role: "AREA_EDITOR", systemAdmin: false, areaIds: [] })).toThrow("mindestens einen Bereich");
    expect(() => createInternalAccount(sqlite, { email: "areas@dhbw-loerrach.de", role: "NONE", systemAdmin: true, areaIds: ["area-01"] })).toThrow("keine Bereiche");
    expect(() => createInternalAccount(sqlite, { email: "ghost@dhbw-loerrach.de", role: "AREA_EDITOR", systemAdmin: false, areaIds: ["area-99"] })).toThrow("existiert nicht");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM user").get()).toEqual({ count: 0 });
  });

  it("rejects a duplicate email address", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "existing", email: "taken@dhbw-loerrach.de", systemAdmin: 1 });
    expect(() => createInternalAccount(sqlite, { email: "TAKEN@dhbw-loerrach.de", role: "NONE", systemAdmin: true, areaIds: [] })).toThrow("bereits vergeben");
  });
});

describe("updateAccountEmail", () => {
  it("corrects the sign-in address without touching state, password, sessions or links", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "user-1", email: "old@dhbw-loerrach.de", systemAdmin: 1, status: "ACTIVE" });
    addCredential(sqlite, "user-1");

    updateAccountEmail(sqlite, { userId: "user-1", email: " Corrected@DHBW-Loerrach.de " });

    expect(sqlite.prepare("SELECT email, status FROM user WHERE id = 'user-1'").get()).toEqual({ email: "corrected@dhbw-loerrach.de", status: "ACTIVE" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM account").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM session").get()).toEqual({ count: 1 });
  });

  it("rejects an email already used by another account", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "user-1", email: "one@dhbw-loerrach.de", systemAdmin: 1 });
    insertUser(sqlite, { id: "user-2", email: "two@dhbw-loerrach.de", systemAdmin: 1 });
    expect(() => updateAccountEmail(sqlite, { userId: "user-2", email: "ONE@dhbw-loerrach.de" })).toThrow("bereits vergeben");
  });
});

describe("updateAccountPermissions", () => {
  it("replaces role, system administration and area assignments together", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "user-1", role: "AREA_EDITOR", systemAdmin: 0, status: "ACTIVE" });
    sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("user-1", "area-01");
    insertUser(sqlite, { id: "admin", systemAdmin: 1, status: "ACTIVE" });

    updateAccountPermissions(sqlite, { userId: "user-1", role: "AREA_EDITOR", systemAdmin: true, areaIds: ["area-02"] });

    expect(sqlite.prepare("SELECT role, system_admin AS systemAdmin FROM user WHERE id = 'user-1'").get()).toEqual({ role: "AREA_EDITOR", systemAdmin: 1 });
    expect(sqlite.prepare("SELECT area_id AS areaId FROM area_assignments WHERE user_id = 'user-1'").all()).toEqual([{ areaId: "area-02" }]);
  });

  it("rejects removing system administration from the last active system administration account", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "sole-admin", role: "AREA_EDITOR", systemAdmin: 1, status: "ACTIVE" });
    sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("sole-admin", "area-01");
    insertUser(sqlite, { id: "pending-admin", systemAdmin: 1, status: "PASSWORD_PENDING" });

    expect(() => updateAccountPermissions(sqlite, { userId: "sole-admin", role: "AREA_EDITOR", systemAdmin: false, areaIds: ["area-01"] })).toThrow("letzte aktive Systemadministrationskonto");
    expect(sqlite.prepare("SELECT system_admin AS systemAdmin FROM user WHERE id = 'sole-admin'").get()).toEqual({ systemAdmin: 1 });
  });

  it("allows removing system administration when another active system administration account remains", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "admin-1", role: "AREA_EDITOR", systemAdmin: 1, status: "ACTIVE" });
    sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("admin-1", "area-01");
    insertUser(sqlite, { id: "admin-2", systemAdmin: 1, status: "ACTIVE" });

    updateAccountPermissions(sqlite, { userId: "admin-1", role: "AREA_EDITOR", systemAdmin: false, areaIds: ["area-01"] });
    expect(sqlite.prepare("SELECT system_admin AS systemAdmin FROM user WHERE id = 'admin-1'").get()).toEqual({ systemAdmin: 0 });
  });
});

describe("issuePasswordLink", () => {
  it("resets an active account by revoking its password and sessions", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "user-1", role: "AREA_EDITOR", systemAdmin: 0, status: "ACTIVE" });
    sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("user-1", "area-01");
    addCredential(sqlite, "user-1");
    insertUser(sqlite, { id: "admin", systemAdmin: 1, status: "ACTIVE" });

    const token = issuePasswordLink(sqlite, "user-1", new Date("2030-01-01T00:00:00.000Z"));

    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'user-1'").get()).toEqual({ status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM account WHERE user_id = 'user-1'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM session WHERE user_id = 'user-1'").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash FROM password_links WHERE user_id = 'user-1'").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
  });

  it("reissues a fresh link for a pending account and invalidates the previous one", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "user-1", systemAdmin: 1, status: "PASSWORD_PENDING" });
    const first = issuePasswordLink(sqlite, "user-1", new Date("2030-01-01T00:00:00.000Z"));
    const second = issuePasswordLink(sqlite, "user-1", new Date("2030-01-02T00:00:00.000Z"));

    expect(second).not.toEqual(first);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM password_links WHERE user_id = 'user-1'").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash FROM password_links WHERE user_id = 'user-1'").get()).toEqual({
      tokenHash: createHash("sha256").update(second).digest("hex"),
    });
  });

  it("rejects issuing a link for a locked account", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "user-1", role: "AREA_EDITOR", status: "LOCKED" });
    sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("user-1", "area-01");
    expect(() => issuePasswordLink(sqlite, "user-1")).toThrow("gesperrt");
  });

  it("rejects resetting the last active system administration account", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "sole-admin", systemAdmin: 1, status: "ACTIVE" });
    addCredential(sqlite, "sole-admin");
    expect(() => issuePasswordLink(sqlite, "sole-admin")).toThrow("letzte aktive Systemadministrationskonto");
    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'sole-admin'").get()).toEqual({ status: "ACTIVE" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM account WHERE user_id = 'sole-admin'").get()).toEqual({ count: 1 });
  });
});

describe("lockInternalAccount and unlockInternalAccount", () => {
  it("locks an ordinary account and reactivates it through a fresh link", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "user-1", role: "AREA_EDITOR", status: "ACTIVE" });
    sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("user-1", "area-01");
    addCredential(sqlite, "user-1");
    insertUser(sqlite, { id: "admin", systemAdmin: 1, status: "ACTIVE" });

    lockInternalAccount(sqlite, "user-1", new Date("2030-01-01T00:00:00.000Z"));
    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'user-1'").get()).toEqual({ status: "LOCKED" });
    expect(sqlite.prepare("SELECT area_id AS areaId FROM area_assignments WHERE user_id = 'user-1'").all()).toEqual([{ areaId: "area-01" }]);

    const token = unlockInternalAccount(sqlite, "user-1", new Date("2030-01-02T00:00:00.000Z"));
    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'user-1'").get()).toEqual({ status: "PASSWORD_PENDING" });
    expect(sqlite.prepare("SELECT token_hash AS tokenHash FROM password_links WHERE user_id = 'user-1'").get()).toEqual({
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
  });

  it("rejects locking the last active system administration account", () => {
    const sqlite = createDatabase();
    insertUser(sqlite, { id: "sole-admin", systemAdmin: 1, status: "ACTIVE" });
    addCredential(sqlite, "sole-admin");
    expect(() => lockInternalAccount(sqlite, "sole-admin")).toThrow("letzte aktive Systemadministrationskonto");
    expect(sqlite.prepare("SELECT status FROM user WHERE id = 'sole-admin'").get()).toEqual({ status: "ACTIVE" });
  });
});
