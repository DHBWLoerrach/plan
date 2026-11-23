import type Database from "better-sqlite3";

import { assertPublishedCourseValid } from "@/lib/services/publication";

export function completeCourseChange(sqlite: Database.Database, courseId: string, accountId: string, now: Date): void {
  sqlite.prepare("UPDATE courses SET updated_at = ?, updated_by_account_id = ? WHERE id = ?")
    .run(now.toISOString(), accountId, courseId);
  assertPublishedCourseValid(sqlite, courseId);
}
