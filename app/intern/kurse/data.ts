import "server-only";

import { sqlite } from "@/lib/db";

export type ProgramOption = { id: string; label: string };

/** Programs the account may manage, as labelled select options (system administration sees all areas). */
export function programOptions(account: { id: string; systemAdmin: boolean }): ProgramOption[] {
  const rows = sqlite.prepare(`SELECT program.id, program.name, program.abbreviation, area.name AS areaName
    FROM programs program JOIN areas area ON area.id = program.area_id
    WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY area.name COLLATE NOCASE, program.name COLLATE NOCASE`).all(account.systemAdmin ? 1 : 0, account.id) as
    { id: string; name: string; abbreviation: string; areaName: string }[];
  return rows.map((program) => ({ id: program.id, label: `${program.abbreviation} — ${program.name} (${program.areaName})` }));
}

export function searchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = searchParams[key];
  return typeof value === "string" && value ? value : null;
}
