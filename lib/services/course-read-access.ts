import "server-only";

import type Database from "better-sqlite3";

import { publicationState, type PublicationState } from "@/lib/domain/course-status";

export type AccountScope = { id: string; systemAdmin: boolean };
export type CourseMarking = { state: PublicationState; editable: boolean };
export type MarkingColumns = { areaId: string; publishedAt: string | null };

export function editableAreaIds(sqlite: Database.Database, account: AccountScope): Set<string> {
  const ids = sqlite.prepare(`SELECT id FROM areas
    WHERE ? = 1 OR id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)`)
    .pluck().all(Number(account.systemAdmin), account.id) as string[];
  return new Set(ids);
}

export function markCourse<TRow extends MarkingColumns>(row: TRow, editableAreas: ReadonlySet<string>): TRow & CourseMarking {
  return { ...row, state: publicationState(row.publishedAt), editable: editableAreas.has(row.areaId) };
}
