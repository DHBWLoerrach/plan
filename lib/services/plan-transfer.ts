import type Database from "better-sqlite3";

import { FieldError } from "@/lib/domain/field-error";
import { transferRefusal, type TransferCourse, type TransferKind, type TransferSelection } from "@/lib/domain/plan-transfer";
import { assertCoursesEditPermission } from "@/lib/services/authorization";

export function requirePlanEntryCourses(
  sqlite: Database.Database,
  input: TransferSelection & { accountId: string },
  kind: TransferKind,
): TransferCourse[] {
  const sourceId = input.sourceCourseId.trim();
  if (!sourceId) {
    throw new FieldError("courseIds", kind === "phase" ? "Wählen Sie mindestens einen Kurs für die Kursphase." : "Ein Termin betrifft mindestens einen Kurs.");
  }
  const ids = [...new Set([sourceId, ...input.targetCourseIds.map((id) => id.trim()).filter(Boolean)])];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = sqlite.prepare(`SELECT course.id, course.code, program.semesters,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.id IN (${placeholders})`).all(...ids) as TransferCourse[];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const courses = ids.map((id) => {
    const course = byId.get(id);
    if (!course) {
      throw new FieldError("courseIds", id === sourceId ? "Der bearbeitete Kurs wurde nicht gefunden." : "Ein ausgewählter Kurs wurde nicht gefunden.");
    }
    return course;
  });
  assertCoursesEditPermission(sqlite, input.accountId, ids);
  const [source, ...targets] = courses;
  for (const target of targets) {
    const reason = transferRefusal(source, target, kind);
    if (reason) throw new FieldError("courseIds", `Es wurde nichts gespeichert: ${reason}.`);
  }
  return courses;
}
