import "server-only";

import type Database from "better-sqlite3";

export type AreaOption = { id: string; name: string };

/**
 * The areas the account may manage: every area for system administration, otherwise exactly the assigned ones. It is
 * the scope every internal view decides what may be written against (ADR 0011).
 */
export function manageableAreas(sqlite: Database.Database, account: { id: string; systemAdmin: boolean }): AreaOption[] {
  return sqlite.prepare(`SELECT id, name FROM areas
    WHERE ? = 1 OR id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY name COLLATE NOCASE`).all(account.systemAdmin ? 1 : 0, account.id) as AreaOption[];
}

/**
 * Every area, whether or not the account may write in it. The course list reads and filters system wide and needs the
 * foreign areas as filter values; what may be written is decided separately (ADR 0011).
 */
export function allAreas(sqlite: Database.Database): AreaOption[] {
  return sqlite.prepare("SELECT id, name FROM areas ORDER BY name COLLATE NOCASE").all() as AreaOption[];
}
