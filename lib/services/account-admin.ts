import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeEmail } from "@/lib/domain/account-email.mjs";
import { lockAccount, reissuePasswordLink, resetAccountPassword, unlockAccount } from "@/lib/services/password-link";
import { issuePasswordLinkToken } from "@/lib/services/password-link-token.mjs";

const lastActiveSystemAdminMessage = "Das letzte aktive Systemadministrationskonto muss erhalten bleiben.";
const notFoundMessage = "Das interne Konto wurde nicht gefunden.";

type Role = "NONE" | "AREA_EDITOR";

type Permissions = { role: Role; systemAdmin: boolean; areaIds: string[] };

type CreateInternalAccountInput = Permissions & { email: string; now?: Date };

export function createInternalAccount(sqlite: Database.Database, input: CreateInternalAccountInput): string {
  const email = normalizeEmail(input.email);
  const areaIds = validatePermissions(input);
  const now = input.now ?? new Date();
  return sqlite.transaction(() => {
    assertEmailAvailable(sqlite, email, null);
    assertAreasExist(sqlite, areaIds);
    const userId = randomUUID();
    sqlite.prepare(`
      INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt)
      VALUES (?, ?, ?, 0, ?, ?, 'PASSWORD_PENDING', ?, ?)
    `).run(userId, email, email, input.role, input.systemAdmin ? 1 : 0, now.getTime(), now.getTime());
    assignAreas(sqlite, userId, areaIds);
    return issuePasswordLinkToken(sqlite, userId, now);
  })();
}

export function updateAccountEmail(sqlite: Database.Database, input: { userId: string; email: string; now?: Date }): void {
  const email = normalizeEmail(input.email);
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    requireUser(sqlite, input.userId);
    assertEmailAvailable(sqlite, email, input.userId);
    sqlite.prepare("UPDATE user SET email = ?, name = ?, updatedAt = ? WHERE id = ?").run(email, email, now.getTime(), input.userId);
  })();
}

export function updateAccountPermissions(sqlite: Database.Database, input: { userId: string } & Permissions & { now?: Date }): void {
  const areaIds = validatePermissions(input);
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const user = requireUser(sqlite, input.userId);
    assertAreasExist(sqlite, areaIds);
    const removesSystemAdmin = Boolean(user.systemAdmin) && !input.systemAdmin;
    if (removesSystemAdmin && user.status === "ACTIVE" && activeSystemAdminCount(sqlite) <= 1) {
      throw new Error(lastActiveSystemAdminMessage);
    }
    sqlite.prepare("UPDATE user SET role = ?, system_admin = ?, updatedAt = ? WHERE id = ?").run(input.role, input.systemAdmin ? 1 : 0, now.getTime(), input.userId);
    sqlite.prepare("DELETE FROM area_assignments WHERE user_id = ?").run(input.userId);
    assignAreas(sqlite, input.userId, areaIds);
  })();
}

export function issuePasswordLink(sqlite: Database.Database, userId: string, now = new Date()): string {
  return sqlite.transaction(() => {
    const user = requireUser(sqlite, userId);
    if (user.status === "LOCKED") throw new Error("Ein gesperrtes Konto muss zuerst freigegeben werden.");
    if (user.status === "ACTIVE") {
      assertNotLastActiveSystemAdmin(sqlite, user);
      return resetAccountPassword(sqlite, userId, now);
    }
    return reissuePasswordLink(sqlite, userId, now);
  })();
}

export function lockInternalAccount(sqlite: Database.Database, userId: string, now = new Date()): void {
  sqlite.transaction(() => {
    const user = requireUser(sqlite, userId);
    assertNotLastActiveSystemAdmin(sqlite, user);
    lockAccount(sqlite, userId, now);
  })();
}

export function unlockInternalAccount(sqlite: Database.Database, userId: string, now = new Date()): string {
  return unlockAccount(sqlite, userId, now);
}

type UserRow = { id: string; systemAdmin: number; status: string };

function requireUser(sqlite: Database.Database, userId: string): UserRow {
  const user = sqlite.prepare("SELECT id, system_admin AS systemAdmin, status FROM user WHERE id = ?").get(userId) as UserRow | undefined;
  if (!user) throw new Error(notFoundMessage);
  return user;
}

function assertNotLastActiveSystemAdmin(sqlite: Database.Database, user: UserRow): void {
  if (Boolean(user.systemAdmin) && user.status === "ACTIVE" && activeSystemAdminCount(sqlite) <= 1) {
    throw new Error(lastActiveSystemAdminMessage);
  }
}

function activeSystemAdminCount(sqlite: Database.Database): number {
  return (sqlite.prepare("SELECT COUNT(*) AS count FROM user WHERE system_admin = 1 AND status = 'ACTIVE'").get() as { count: number }).count;
}

function validatePermissions(input: Permissions): string[] {
  if (input.role === "NONE" && !input.systemAdmin) {
    throw new Error("Ein internes Konto benötigt mindestens die Bereichsbearbeitung oder die Systemadministration.");
  }
  const areaIds = [...new Set(input.areaIds)];
  if (input.role === "AREA_EDITOR" && areaIds.length === 0) {
    throw new Error("Die Bereichsbearbeitung setzt mindestens einen Bereich voraus.");
  }
  if (input.role === "NONE" && areaIds.length > 0) {
    throw new Error("Ohne Bereichsbearbeitung dürfen keine Bereiche zugeordnet werden.");
  }
  return areaIds;
}

function assignAreas(sqlite: Database.Database, userId: string, areaIds: string[]): void {
  const insert = sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)");
  for (const areaId of areaIds) insert.run(userId, areaId);
}

function assertAreasExist(sqlite: Database.Database, areaIds: string[]): void {
  for (const areaId of areaIds) {
    if (!sqlite.prepare("SELECT 1 FROM areas WHERE id = ?").get(areaId)) throw new Error("Ein zugeordneter Bereich existiert nicht.");
  }
}

function assertEmailAvailable(sqlite: Database.Database, email: string, exceptUserId: string | null): void {
  const existing = sqlite.prepare("SELECT id FROM user WHERE email = ?").get(email) as { id: string } | undefined;
  if (existing && existing.id !== exceptUserId) throw new Error("Diese E-Mail-Adresse ist bereits vergeben.");
}
