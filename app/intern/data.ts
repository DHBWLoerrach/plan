import "server-only";

import type Database from "better-sqlite3";

export type AreaOption = { id: string; name: string };

/**
 * Every area, whether or not the account may write in it. Permissions are assigned for any of them; what an account
 * may write is decided separately (ADR 0011).
 */
export function allAreas(sqlite: Database.Database): AreaOption[] {
  return sqlite.prepare("SELECT id, name FROM areas ORDER BY name COLLATE NOCASE").all() as AreaOption[];
}
