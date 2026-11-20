import { plusDays } from "@/lib/domain/calendar-day";
import { courseCodeYear } from "@/lib/domain/generated-course-plan";
import { groupComparableCourses } from "@/lib/domain/plan-comparison";
import { publicCutPath } from "@/lib/domain/public-cut";
import type { PhaseType } from "@/lib/domain/phase-type";
import type { CoursePhase, CoursePlan } from "@/lib/domain/publication";

/** A published course that has not ended yet, with the current designations of its program. */
export type OverviewCourse = CoursePlan & { program: string; programAbbreviation: string; year: number };

/** Where a course stands: the phase it is in, or the next one where it is between phases or yet to begin. */
export interface OverviewPhaseStatus { type: PhaseType; text: string }

/** One link of a cell: a single course, or parallel courses that share their whole progression. */
export interface OverviewChip { label: string; href: string; codes: string[]; status: OverviewPhaseStatus | null }

/** `detail` is left out where the courses of a year stand at different points, like one begun and one still to begin. */
export interface OverviewYear { year: number; label: string; detail: string | null }


export interface OverviewProgram {
  abbreviation: string;
  name: string;
  cells: Record<number, OverviewChip[]>;
  codes: string[];
  /** The earliest study start of this program whose courses are still studying, by the program's duration. */
  runningFrom: number;
}

export interface OverviewCourseSuggestion { code: string; href: string; year: number; abbreviation: string; detail: string }

export interface PublicOverview {
  programs: OverviewProgram[];
  years: OverviewYear[];
  courses: OverviewCourseSuggestion[];
  /** The next study start whose plans are still to come. */
  nextYear: number;
  today: string;
  /** A course code of the newest year without its parallel letter, like WPM26, which stays valid the longest. */
  exampleCode: string | null;
}

/** „not-published“: a running year whose plan is not out; „not-yet-published“: a study start still to come. */
export type OverviewEmptyReason = "nothing-published" | "no-match" | "not-in-year" | "not-published" | "not-yet-published";

export interface OverviewSelection {
  programs: OverviewProgram[];
  years: OverviewYear[];
  emptyReason: OverviewEmptyReason | null;
}

const monthNames = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];
const collator = new Intl.Collator("de-DE");
/* The letters of a course code and the year after them, two digits or four, as the course management reads them. */
const codeUpToYear = /^([a-z]+)(?:20\d{2}|\d{2})(?!\d)/iu;
/* Most programs start on the first of October; a year counts as begun from then even before any plan of it is out. */
const usualStudyStart = "10-01";

/** Case, accents and the punctuation of program names do not decide a match: „bwl personal“ finds „BWL – Personal…“. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("de-DE")
    .replace(/[–—\-/,()]/g, " ").replace(/\s+/g, " ").trim();
}

function studyYear(start: string, today: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [year, month, day] = today.split("-").map(Number);
  const months = (year - startYear) * 12 + (month - startMonth) - (day < startDay ? 1 : 0);
  return Math.floor(months / 12) + 1;
}

function progress(start: string, today: string): string {
  return start > today ? "noch nicht begonnen" : `${studyYear(start, today)}. Studienjahr`;
}

function describeYear(year: number, starts: string[], today: string): OverviewYear {
  const months = new Set(starts.map((start) => start.slice(5, 7)));
  const label = months.size === 1 ? `Start ${monthNames[Number([...months][0]) - 1]} ${year}` : `Start ${year}`;
  const progresses = new Set(starts.map((start) => progress(start, today)));
  return { year, label, detail: progresses.size === 1 ? [...progresses][0] : null };
}

/** A course starting in the usual month of `year` studies until `semesters` half years later. */
function earliestRunningYear(semesters: number, today: string): number {
  const months = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
  const startMonth = Number(usualStudyStart.slice(0, 2)) - 1;
  return Math.floor((months - startMonth - semesters * 6) / 12) + 1;
}

function describeCourseStart(start: string, today: string): string {
  return `Start ${monthNames[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)} · ${progress(start, today)}`;
}

function sharedPrefix(codes: string[]): string {
  let prefix = codes[0];
  for (const code of codes.slice(1)) {
    while (!code.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

/** What tells parallel courses apart within their year: „A“ and „B“ of WWI24A and WWI24B. */
function suffixes(codes: string[]): string[] {
  const prefix = sharedPrefix(codes);
  return prefix ? codes.map((code) => code.slice(prefix.length)) : codes;
}

/** Identifies a program's cut of one year, whose abbreviation the address matches regardless of case. */
export function cutKey(abbreviation: string, year: number): string {
  return `${abbreviation.toLowerCase()} ${year}`;
}

function dayAndMonth(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
}

/* Where the students are, as partners ask it, rather than the planners' „Theorie“ and „Praxis“. */
const phasePlace: Record<PhaseType, string> = { THEORY: "An der DHBW", PRACTICE: "Im Unternehmen" };

function phaseStatus(courseId: string, phases: CoursePhase[], today: string): OverviewPhaseStatus | null {
  const own = phases.filter((phase) => phase.courseId === courseId).toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  const index = own.findIndex((phase) => phase.startDate <= today && today <= phase.endDate);
  if (index >= 0) {
    /* Phases of one type that follow each other without a day between, like practice across a semester boundary, are
       one stay in one place. */
    const { type } = own[index];
    let end = own[index].endDate;
    for (const phase of own.slice(index + 1)) {
      if (phase.type !== type || phase.startDate !== plusDays(end, 1)) break;
      end = phase.endDate;
    }
    return { type, text: `${phasePlace[type]} bis ${dayAndMonth(end)}` };
  }
  const next = own.find((phase) => phase.startDate > today);
  return next ? { type: next.type, text: `${phasePlace[next.type]} ab ${dayAndMonth(next.startDate)}` } : null;
}

/* The program's cut of a year shows all of its published courses, ended ones included, so one link stands for a group
   only where the group is exactly what that cut shows. */
function chipsFor(
  courses: OverviewCourse[], groups: ReturnType<typeof groupComparableCourses>, cutSize: number, phases: CoursePhase[], today: string,
): OverviewChip[] {
  if (groups.length === 1 && courses.length > 1 && courses.length === cutSize) {
    const codes = groups[0].courses.map((course) => course.code);
    return [{
      label: `${codes[0]} + ${suffixes(codes).slice(1).join(" + ")}`,
      href: publicCutPath({ kind: "program", year: courses[0].year, abbreviation: courses[0].programAbbreviation }),
      codes,
      status: phaseStatus(groups[0].courses[0].id, phases, today),
    }];
  }
  return courses.map((course) => ({
    label: course.code, href: publicCutPath({ kind: "course", code: course.code }), codes: [course.code], status: phaseStatus(course.id, phases, today),
  }));
}

/**
 * The landing page's table: one row per program, one column per year in which a published course has not ended yet.
 * Where all parallel courses of a year share their whole progression they become one link to the program's cut of that
 * year, as the plan matrix shows them in one column; otherwise every course keeps a link of its own. `cutSizes` counts
 * what each of those cuts shows; without it, a cut is taken to show just the courses given here.
 */
export function buildPublicOverview(
  courses: OverviewCourse[], phases: CoursePhase[], today: string, cutSizes?: Map<string, number>,
): PublicOverview {
  const sorted = courses.toSorted((left, right) => collator.compare(left.code, right.code));
  const yearNumbers = [...new Set(sorted.map((course) => course.year))].toSorted((left, right) => left - right);
  const years = yearNumbers.map((year) => describeYear(year, sorted.filter((course) => course.year === year).map((course) => course.studyStart), today));

  const byProgram = new Map<string, OverviewCourse[]>();
  for (const course of sorted) byProgram.set(course.programAbbreviation, [...(byProgram.get(course.programAbbreviation) ?? []), course]);
  const programs = [...byProgram.values()].map((programCourses): OverviewProgram => {
    const { programAbbreviation, program } = programCourses[0];
    const cells: Record<number, OverviewChip[]> = {};
    for (const year of yearNumbers) {
      const inYear = programCourses.filter((course) => course.year === year);
      if (!inYear.length) continue;
      cells[year] = chipsFor(inYear, groupComparableCourses(inYear, phases), cutSizes?.get(cutKey(programAbbreviation, year)) ?? inYear.length, phases, today);
    }
    return {
      abbreviation: programAbbreviation,
      name: program,
      cells,
      codes: programCourses.map((course) => course.code),
      runningFrom: earliestRunningYear(Math.max(...programCourses.map((course) => course.semesters)), today),
    };
  }).toSorted((left, right) => collator.compare(left.name, right.name));

  const started = sorted.filter((course) => course.studyStart <= today).map((course) => course.year);
  const thisYear = Number(today.slice(0, 4));
  const nextYear = Math.max(...started.map((year) => year + 1), today.slice(5) >= usualStudyStart ? thisYear + 1 : thisYear);
  const suggestions = sorted.map((course) => ({
    code: course.code,
    href: publicCutPath({ kind: "course", code: course.code }),
    year: course.year,
    abbreviation: course.programAbbreviation,
    detail: describeCourseStart(course.studyStart, today),
  }));
  const newest = yearNumbers.at(-1);
  const exampleCode = sorted.find((course) => course.year === newest)?.code.match(codeUpToYear)?.[0] ?? null;
  return { programs, years, courses: suggestions, nextYear, today, exampleCode };
}

/** A code as the search compares it, on both sides alike: „WIN25A-A“, „win25a a“ and „WIN25AA“ all find WIN25A-A. */
function codeKey(text: string): string {
  return normalizeSearch(text).replace(/\s/g, "");
}

/** Whether a normalized query names the program itself, by a part of its name or the start of its abbreviation. */
function namesProgram(program: OverviewProgram, query: string): boolean {
  return !query || normalizeSearch(program.name).includes(query) || codeKey(program.abbreviation).startsWith(codeKey(query));
}

function beginsCode(code: string, query: string): boolean {
  return Boolean(query) && codeKey(code).startsWith(codeKey(query));
}

function matchesProgram(program: OverviewProgram, query: string): boolean {
  return namesProgram(program, query) || program.codes.some((code) => beginsCode(code, query));
}

/**
 * The programs a query finds. A query naming a program exactly, by its abbreviation or its whole name, finds that one
 * alone, so Informatik is not also Wirtschaftsinformatik and TIF is not every program named Informatik.
 */
export function findPrograms(overview: PublicOverview, query: string): OverviewProgram[] {
  const normalized = normalizeSearch(query);
  const byAbbreviation = overview.programs.filter((program) => codeKey(program.abbreviation) === codeKey(query));
  if (normalized && byAbbreviation.length) return byAbbreviation;
  const exact = overview.programs.filter((program) => normalizeSearch(program.name) === normalized);
  return exact.length ? exact : overview.programs.filter((program) => matchesProgram(program, normalized));
}

/** A course code of a known program for a running or coming year without a published plan, like WWI27 before it is out. */
function unpublishedReason(overview: PublicOverview, query: string): OverviewEmptyReason | null {
  const match = codeKey(query).match(codeUpToYear);
  const year = match ? courseCodeYear(match[0], overview.today) : undefined;
  if (!match || year === undefined) return null;
  const program = overview.programs.find((candidate) => codeKey(candidate.abbreviation) === match[1].toLowerCase());
  if (!program || program.cells[year]) return null;
  if (year >= overview.nextYear) return "not-yet-published";
  return year >= program.runningFrom ? "not-published" : null;
}

export function selectPublicOverview(overview: PublicOverview, { query, year }: { query: string; year: string }): OverviewSelection {
  const years = overview.years.some((candidate) => String(candidate.year) === year)
    ? overview.years.filter((candidate) => String(candidate.year) === year)
    : overview.years;
  const found = findPrograms(overview, query);
  const normalized = normalizeSearch(query);
  const shown = (year: number) => years.some((candidate) => candidate.year === year);
  /* A program the query names is shown for any of its years; one found only by a course code, for that course's year. */
  const programs = found.filter((program) => namesProgram(program, normalized)
    ? Object.keys(program.cells).some((year) => shown(Number(year)))
    : overview.courses.some((course) => course.abbreviation === program.abbreviation && beginsCode(course.code, normalized) && shown(course.year)));
  let emptyReason: OverviewEmptyReason | null = null;
  if (!overview.programs.length) emptyReason = "nothing-published";
  else if (!programs.length) {
    emptyReason = found.length ? "not-in-year" : unpublishedReason(overview, query) ?? "no-match";
  }
  return { programs, years, emptyReason };
}

export interface OverviewSuggestions {
  /** `label` is what choosing a program puts into the field: its name, or its abbreviation where another program shares the name. */
  programs: Array<{ abbreviation: string; name: string; label: string; detail: string }>;
  courses: OverviewCourseSuggestion[];
}

const suggestionLimit = 6;

/**
 * The suggestions under the search field: matching programs, then the courses of those programs and courses whose code
 * the query begins. A chosen study start narrows them as it narrows the table.
 */
export function suggestPublicOverview(overview: PublicOverview, query: string, year = "all"): OverviewSuggestions {
  const normalized = normalizeSearch(query);
  if (!normalized) return { programs: [], courses: [] };
  const inYear = (candidate: number) => year === "all" || String(candidate) === year;
  /* The same programs the table shows, so that choosing one never swaps a course code for a program with other plans. */
  const programs = selectPublicOverview(overview, { query, year }).programs;
  /* Courses only of the programs found; one found through a course code contributes only the courses that code begins. */
  const found = new Set(programs.map((program) => program.abbreviation));
  const named = new Set(programs.filter((program) => namesProgram(program, normalized)).map((program) => program.abbreviation));
  const courses = overview.courses
    .filter((course) => inYear(course.year) && found.has(course.abbreviation)
      && (named.has(course.abbreviation) || beginsCode(course.code, normalized)))
    .toSorted((left, right) => right.year - left.year || collator.compare(left.code, right.code))
    .slice(0, suggestionLimit);
  return {
    programs: programs.slice(0, suggestionLimit).map((program) => {
      const count = Object.keys(program.cells).length;
      const years = count === 1 ? "1 Jahrgang" : `${count} Jahrgänge`;
      const shared = overview.programs.some((other) => other !== program && normalizeSearch(other.name) === normalizeSearch(program.name));
      return shared
        ? { abbreviation: program.abbreviation, name: program.name, label: program.abbreviation, detail: `${program.abbreviation} · ${years}` }
        : { abbreviation: program.abbreviation, name: program.name, label: program.name, detail: years };
    }),
    courses,
  };
}
