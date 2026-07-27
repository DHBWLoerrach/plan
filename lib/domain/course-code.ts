/**
 * The comparison key of a course code: what makes `TIF25A` and `tif25a` the same Kurskennung. Course administration
 * stores it, publication compares against it and the public course API is addressed by it — one rule, because a
 * second one would let the database, the publication check and the API disagree about what a course is called.
 */
export function normalizeCourseCode(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}

/**
 * The course code filter of the public search and of the internal block plan list. It matches the beginning of a
 * course code without regard to case, so `tif24` finds both `TIF24A` and `TIF24B` (MVP-SPEZIFIKATION.md).
 */
export function normalizeCodePrefix(value: string | null | undefined): string | null {
  return (value && normalizeCourseCode(value)) || null;
}

export function matchesCodePrefix(code: string, prefix: string): boolean {
  return code.toLocaleLowerCase("de-DE").startsWith(prefix);
}
