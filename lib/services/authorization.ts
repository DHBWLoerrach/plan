import type Database from "better-sqlite3";

/** Ensures the account is an active internal account allowed to edit the given area (system administration or an assigned area editor). Throws otherwise. */
export function assertAreaEditPermission(sqlite: Database.Database, accountId: string, areaId: string) {
  const account = sqlite.prepare("SELECT role, system_admin AS systemAdmin, status FROM user WHERE id = ?").get(accountId) as
    | { role: string; systemAdmin: number; status: string }
    | undefined;
  if (!account || account.status !== "ACTIVE") throw new Error("Sie sind nicht zur Bearbeitung berechtigt.");
  if (account.systemAdmin) return;
  const assignment = sqlite.prepare("SELECT 1 FROM area_assignments WHERE user_id = ? AND area_id = ?").get(accountId, areaId);
  if (account.role !== "AREA_EDITOR" || !assignment) throw new Error("Sie sind nicht zur Bearbeitung dieses Bereichs berechtigt.");
}
