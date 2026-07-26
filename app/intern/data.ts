import "server-only";

import type Database from "better-sqlite3";

export type AreaOption = { id: string; name: string };

/**
 * The areas the account may manage: every area for system administration, otherwise exactly the assigned ones. Both
 * the internal lists and the start page derive what they show from this scope (FACHLICHE_REGELN.md).
 */
export function manageableAreas(sqlite: Database.Database, account: { id: string; systemAdmin: boolean }): AreaOption[] {
  return sqlite.prepare(`SELECT id, name FROM areas
    WHERE ? = 1 OR id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY name COLLATE NOCASE`).all(account.systemAdmin ? 1 : 0, account.id) as AreaOption[];
}
