import "server-only";

import { sqlite } from "@/lib/db";

export type AccountStatus = "PASSWORD_PENDING" | "ACTIVE" | "LOCKED";
export type AccountListRow = {
  id: string;
  email: string;
  role: string;
  systemAdmin: number;
  status: AccountStatus;
  areas: string | null;
};
export type AreaOption = { id: string; name: string };
export type ManagedAccount = {
  id: string;
  email: string;
  role: "NONE" | "AREA_EDITOR";
  systemAdmin: number;
  status: AccountStatus;
};
export type ManagedAccountDetails = {
  account: ManagedAccount;
  areas: AreaOption[];
  areaIds: string[];
};

/** Internal accounts matching the optional status filter. */
export function listAccounts(status?: AccountStatus): AccountListRow[] {
  return sqlite.prepare(`SELECT user.id, user.email, user.role, user.system_admin AS systemAdmin, user.status,
      (SELECT GROUP_CONCAT(area.name, ', ') FROM area_assignments assignment
        JOIN areas area ON area.id = assignment.area_id WHERE assignment.user_id = user.id) AS areas
    FROM user WHERE (? IS NULL OR user.status = ?)
    ORDER BY user.email COLLATE NOCASE`).all(status ?? null, status ?? null) as AccountListRow[];
}

/** Areas available for account permission assignment. */
export function accountAreaOptions(): AreaOption[] {
  return sqlite.prepare("SELECT id, name FROM areas ORDER BY name COLLATE NOCASE").all() as AreaOption[];
}

/** Account and permission data required by the administration form. */
export function findManagedAccount(userId: string): ManagedAccountDetails | undefined {
  const account = sqlite.prepare("SELECT id, email, role, system_admin AS systemAdmin, status FROM user WHERE id = ?")
    .get(userId) as ManagedAccount | undefined;
  if (!account) return undefined;
  const areaIds = (sqlite.prepare("SELECT area_id AS areaId FROM area_assignments WHERE user_id = ?")
    .all(userId) as { areaId: string }[]).map((row) => row.areaId);
  return { account, areas: accountAreaOptions(), areaIds };
}
