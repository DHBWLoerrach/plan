import type Database from "better-sqlite3";

import { FieldError } from "@/lib/domain/field-error";

/**
 * A transfer copies one newly captured entry from the edited course into courses of its comparison (ADR 0013). Which
 * courses those may be is a rule, not merely what the form happened to offer: the action is reachable without the
 * form, and the offered choices are derived from the very same conditions.
 *
 * Area permission is deliberately not decided here. It belongs to the domain operations, which refuse a course of a
 * foreign area whatever the way in (ADR 0011), and repeating it would put the same rule in two places.
 */
type TransferKind = "phase" | "event";

type TransferCourse = {
  id: string;
  code: string;
  year: string;
  semesters: number;
  studyStart: string;
  studyEnd: string;
  publishedAt: string | null;
};

function readCourses(sqlite: Database.Database, ids: string[]): Map<string, TransferCourse> {
  const placeholders = ids.map(() => "?").join(", ");
  const rows = sqlite.prepare(`SELECT course.id, course.code, substr(course.study_start, 1, 4) AS year,
      program.semesters, course.study_start AS studyStart, course.study_end AS studyEnd, course.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.id IN (${placeholders})`).all(...ids) as TransferCourse[];
  return new Map(rows.map((row) => [row.id, row]));
}

/** Why one course cannot receive a transfer from another, or `null` when it can. */
function refusal(source: TransferCourse, target: TransferCourse, kind: TransferKind): string | null {
  if (target.year !== source.year) return `${target.code} gehört zu Jahrgang ${target.year} und steht damit nicht im Vergleich von ${source.code}`;
  if (kind === "event") return null;
  if (target.publishedAt) return `${target.code} ist veröffentlicht; in einen lückenlosen veröffentlichten Verlauf wird keine einzelne Kursphase ergänzt`;
  if (target.semesters !== source.semesters) return `${target.code} hat eine andere Anzahl Semester als ${source.code}`;
  if (target.studyStart !== source.studyStart || target.studyEnd !== source.studyEnd) return `${target.code} hat einen anderen Studienzeitraum als ${source.code}`;
  return null;
}

/**
 * Checks the transfer targets of one creation against the course it starts from, before any of it is written. The
 * whole selection is refused rather than the offending target dropped: a transfer that silently reached fewer courses
 * than it named would be worse than one that plainly did not happen.
 */
export function assertTransferTargets(sqlite: Database.Database, input: { courseId: string; targetIds: string[]; kind: TransferKind }): void {
  const targetIds = [...new Set(input.targetIds.map((id) => id.trim()).filter(Boolean))].filter((id) => id !== input.courseId);
  if (!targetIds.length) return;
  const courses = readCourses(sqlite, [input.courseId, ...targetIds]);
  const source = courses.get(input.courseId);
  if (!source) throw new FieldError("courseIds", "Der bearbeitete Kurs wurde nicht gefunden.");
  for (const targetId of targetIds) {
    const target = courses.get(targetId);
    if (!target) throw new FieldError("courseIds", "Ein ausgewählter Kurs wurde nicht gefunden.");
    const reason = refusal(source, target, input.kind);
    if (reason) throw new FieldError("courseIds", `Es wurde nichts gespeichert: ${reason}.`);
  }
}
