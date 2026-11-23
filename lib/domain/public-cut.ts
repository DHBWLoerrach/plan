/**
 * The cut a public view is formed over: a single course, a whole year of studies or a program or area within it.
 * A cut is bound to exactly one year, because the plan matrix compares semesters over one shared time axis and the
 * same semester of two years lies years apart (ADR 0010). It carries no id of its own: it addresses
 * itself through the current designations of its published courses.
 */
export type PublicCut =
  | { kind: "course"; code: string }
  | { kind: "year"; year: number }
  | { kind: "area"; year: number; name: string }
  | { kind: "program"; year: number; abbreviation: string; name?: string };

export type PublicCutKind = PublicCut["kind"];

const cutKindLabels: Record<PublicCutKind, string> = {
  course: "Kurs",
  year: "Jahrgang",
  area: "Bereich",
  program: "Studiengang",
};

/** What a cut is: the word its public view names itself with. */
export function publicCutKindLabel(kind: PublicCutKind): string {
  return cutKindLabels[kind];
}

/** The public address of a cut. The path is spoken and written German, so that a link survives a printed plan. */
export function publicCutPath(cut: PublicCut): string {
  switch (cut.kind) {
    case "course":
      return `/${encodeURIComponent(cut.code)}`;
    case "year":
      return `/jahrgang/${cut.year}`;
    case "area":
      return `/jahrgang/${cut.year}/bereich/${encodeURIComponent(cut.name)}`;
    case "program":
      return `/jahrgang/${cut.year}/studiengang/${encodeURIComponent(cut.abbreviation)}`;
  }
}

/** The heading of a cut: its course code, or the year together with the program or area restricting it. */
export function publicCutTitle(cut: PublicCut): string {
  switch (cut.kind) {
    case "course":
      return cut.code;
    case "year":
      return `Jahrgang ${cut.year}`;
    case "area":
      return `${cut.name} · Jahrgang ${cut.year}`;
    case "program":
      return `${cut.name ?? cut.abbreviation} · Jahrgang ${cut.year}`;
  }
}

/**
 * The year an address carries, or `null` when it is no calendar year. Anything else would silently widen the cut:
 * a path is not a filter that may fall away, it names what the page shows.
 */
function cutYear(value: string): number | null {
  return /^\d{4}$/.test(value) ? Number(value) : null;
}

export function yearCut(year: string): YearCut | null {
  const parsed = cutYear(year);
  return parsed === null ? null : { kind: "year", year: parsed };
}

/**
 * A route segment as written: the router hands it on still percent-encoded, so a course code or an area name with a
 * space, which `publicCutPath` encodes, arrives as „%20“. A segment that is no valid encoding stays as it came.
 */
export function routeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function areaCut(year: string, name: string): YearCut | null {
  const parsed = cutYear(year);
  return parsed === null || !name ? null : { kind: "area", year: parsed, name };
}

export function programCut(year: string, abbreviation: string): YearCut | null {
  const parsed = cutYear(year);
  return parsed === null || !abbreviation ? null : { kind: "program", year: parsed, abbreviation };
}

/** A cut of a year, as opposed to a single course, which has a page of its own. */
export type YearCut = Exclude<PublicCut, { kind: "course" }>;

/**
 * The cuts a shown cut leads on to: from one course to its year, its program and its area, and from a program or
 * area back to the whole year. They are the way from one course to its parallel courses and back.
 */
export function relatedCuts(cut: PublicCut, course: { program: string; programAbbreviation: string; area: string; year: number }): PublicCut[] {
  switch (cut.kind) {
    case "course":
      return [
        { kind: "year", year: course.year },
        { kind: "program", year: course.year, abbreviation: course.programAbbreviation, name: course.program },
        { kind: "area", year: course.year, name: course.area },
      ];
    case "year":
      return [];
    default:
      return [{ kind: "year", year: cut.year }];
  }
}
