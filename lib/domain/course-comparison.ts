/**
 * How far the comparison beside an edited course reaches. It never leaves the year of that course, because the plan
 * matrix compares semesters over one shared time axis and the same semester of two years lies years apart (ADR 0010).
 *
 * A comparison is a view, not an object: it is read from the address on every request and never stored. Unlike a
 * public cut it does not address the page — the course does — it only decides which courses stand beside it.
 */
export type ComparisonScope = "program" | "area" | "year" | "none";

export interface ComparisonScopeEntry {
  scope: ComparisonScope;
  /** The value the address carries. Written German, like every other internal address of this application. */
  parameter: string;
  label: string;
  /** What the switch says the option shows, so the reader knows the width before choosing it. */
  description: string;
}

/** Offered from the closest comparison outwards, with the undisturbed single course last. */
export const comparisonScopes: readonly ComparisonScopeEntry[] = [
  { scope: "program", parameter: "studiengang", label: "Studiengang", description: "Die Parallelkurse desselben Studiengangs im selben Jahrgang." },
  { scope: "area", parameter: "bereich", label: "Bereich", description: "Alle Kurse des Bereichs im selben Jahrgang." },
  { scope: "year", parameter: "jahrgang", label: "Jahrgang", description: "Alle Kurse des Jahrgangs, über alle Bereiche hinweg." },
  { scope: "none", parameter: "keiner", label: "Kein Vergleich", description: "Nur dieser Kurs, ohne weitere Spalten." },
];

/**
 * The parallel courses of the own study program: what a course is planned against unless something else is asked for.
 * They are the courses whose plan is usually meant to agree with it, so the deviation worth seeing shows up unbidden.
 */
export const defaultComparisonScope: ComparisonScope = "program";

/** The scope an address asks for. An unknown or missing value is the default, never an error: a view cannot be wrong. */
export function comparisonScope(parameter: string | null | undefined): ComparisonScope {
  return comparisonScopes.find((entry) => entry.parameter === parameter)?.scope ?? defaultComparisonScope;
}

function scopeEntry(scope: ComparisonScope): ComparisonScopeEntry {
  return comparisonScopes.find((entry) => entry.scope === scope)!;
}

export function comparisonScopeParameter(scope: ComparisonScope): string {
  return scopeEntry(scope).parameter;
}

export function comparisonScopeLabel(scope: ComparisonScope): string {
  return scopeEntry(scope).label;
}

/**
 * The address of one course, optionally with the comparison it is seen against. A course has exactly one internal
 * address: everything that may be done to it is done there, and a foreign course shows the same page without the
 * parts that would write. The default scope carries no parameter, so the plain course address stays the one that gets
 * linked and bookmarked.
 */
export function coursePath(courseId: string, scope: ComparisonScope = defaultComparisonScope): string {
  const path = `/intern/kurse/${encodeURIComponent(courseId)}`;
  return scope === defaultComparisonScope ? path : `${path}?vergleich=${comparisonScopeParameter(scope)}`;
}
