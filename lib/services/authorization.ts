import type Database from "better-sqlite3";

/**
 * Ensures the account may write to the given course. The deciding area is the one of the study program of that course,
 * so the answer does not depend on whether the course is assigned to a block plan. A course that cannot be found is
 * refused like a missing permission: without a course there is no area the write could belong to.
 */
export function assertCourseEditPermission(sqlite: Database.Database, accountId: string, courseId: string) {
  const course = sqlite.prepare(`SELECT program.area_id AS areaId FROM courses course
    JOIN programs program ON program.id = course.program_id WHERE course.id = ?`).get(courseId) as { areaId: string } | undefined;
  if (!course) throw new Error("Sie sind nicht zur Bearbeitung berechtigt.");
  assertAreaEditPermission(sqlite, accountId, course.areaId);
}

/**
 * Ensures the account may write to every one of the given courses, as a joint creation for several selected courses
 * requires (FACHLICHE_REGELN.md). An empty selection is refused: an empty round of questions must not pass for consent.
 */
export function assertCoursesEditPermission(sqlite: Database.Database, accountId: string, courseIds: string[]) {
  if (!courseIds.length) throw new Error("Sie sind nicht zur Bearbeitung berechtigt.");
  for (const courseId of courseIds) assertCourseEditPermission(sqlite, accountId, courseId);
}

/** Ensures the account is an active internal account allowed to edit the given area (system administration or an assigned area editor). Throws otherwise. */
export function assertAreaEditPermission(sqlite: Database.Database, accountId: string, areaId: string) {
  const account = sqlite.prepare("SELECT role, system_admin AS systemAdmin, status FROM users WHERE id = ?").get(accountId) as
    | { role: string; systemAdmin: number; status: string }
    | undefined;
  if (!account || account.status !== "ACTIVE") throw new Error("Sie sind nicht zur Bearbeitung berechtigt.");
  if (account.systemAdmin) return;
  const assignment = sqlite.prepare("SELECT 1 FROM area_assignments WHERE user_id = ? AND area_id = ?").get(accountId, areaId);
  if (account.role !== "AREA_EDITOR" || !assignment) throw new Error("Sie sind nicht zur Bearbeitung dieses Bereichs berechtigt.");
}
