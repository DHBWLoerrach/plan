export type NamedCourse = { code: string; studyStart: string };

/**
 * The internally and publicly shown name of a block plan: the given designation, or otherwise a name derived from
 * the year and the current course codes, for example „2026 · TIF26A, WWI26A“ (FACHLICHE_REGELN.md). The area is
 * never part of the name and is always displayed separately.
 */
export function blockPlanDisplayName(name: string | null, courses: NamedCourse[]): string {
  if (name) return name;
  // A block plan always has at least one course (FACHLICHE_REGELN.md), but the preview of a draft that lost its last
  // one must still be able to name what it shows instead of deriving a year and codes from nothing.
  if (!courses.length) return "Blockplan ohne Kurse";
  const year = courses[0].studyStart.slice(0, 4);
  const codes = courses.map((course) => course.code).toSorted((left, right) => left.localeCompare(right, "de"));
  return `${year} · ${codes.join(", ")}`;
}
