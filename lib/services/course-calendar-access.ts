import type Database from "better-sqlite3";

export type CourseCalendarReference = { id: string; code: string };

/** Resolves only courses managed by this application; arbitrary external calendar identifiers are not exposed. */
export function findCourseCalendarReference(sqlite: Database.Database, courseId: string): CourseCalendarReference | undefined {
  return sqlite.prepare("SELECT id, code FROM courses WHERE id = ?").get(courseId) as CourseCalendarReference | undefined;
}
