/**
 * How far the comparison view of a course reaches. It never leaves the year of that course, because the plan matrix
 * compares semesters over one shared time axis and the same semester of two years lies years apart (ADR 0010).
 *
 * A comparison is a view, not an object: it is read from the address on every request and never stored. It is a view
 * of its own beside the planning state of the course — there the course is edited and only told where its parallel
 * courses differ, here the courses stand side by side in full and nothing is written.
 */
export type ComparisonScope = "program" | "area" | "year";

export interface ComparisonScopeEntry {
  scope: ComparisonScope;
  /** The value the address carries. Written German, like every other internal address of this application. */
  parameter: string;
  label: string;
  /** What the switch says the option shows, so the reader knows the width before choosing it. */
  description: string;
}

/** Offered from the closest comparison outwards. */
export const comparisonScopes: readonly ComparisonScopeEntry[] = [
  { scope: "program", parameter: "studiengang", label: "Studiengang", description: "Die Parallelkurse desselben Studiengangs im selben Jahrgang." },
  { scope: "area", parameter: "bereich", label: "Bereich", description: "Alle Kurse des Bereichs im selben Jahrgang." },
  { scope: "year", parameter: "jahrgang", label: "Jahrgang", description: "Alle Kurse des Jahrgangs, über alle Bereiche hinweg." },
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
 * The address of one course. Without a scope it is the planning state, the page a course is edited on and the one that
 * gets linked and bookmarked. With a scope it is the comparison view in that width, which always names its scope in
 * the address: the parameter is what tells the two views apart.
 */
export function coursePath(courseId: string, scope?: ComparisonScope): string {
  const path = `/intern/kurse/${encodeURIComponent(courseId)}`;
  return scope ? `${path}?vergleich=${comparisonScopeParameter(scope)}` : path;
}
