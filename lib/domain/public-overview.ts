import { plusDays } from "@/lib/domain/calendar-day";
import { courseCodeYear } from "@/lib/domain/generated-course-plan";
import { phaseSequenceKey } from "@/lib/domain/plan-comparison";
import { publicCutPath } from "@/lib/domain/public-cut";
import { phasePlaceLabel, type PhaseType } from "@/lib/domain/phase-type";
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
  /** Years with published courses that a course code in the search left out, so that their cells do not read as empty. */
  omitted?: number[];
}

/** A published course that has ended: no longer in the overview, but its plan stays readable. */
export interface EndedCourse { code: string; year: number }

export interface OverviewCourseSuggestion { code: string; href: string; year: number; abbreviation: string; detail: string }

export interface PublicOverview {
  programs: OverviewProgram[];
  years: OverviewYear[];
  courses: OverviewCourseSuggestion[];
  /** The next study start whose plans are still to come. */
  nextYear: number;
  today: string;
  /** Every program and year with a published course, ended ones included, as `cutKey` writes them. */
  publishedCuts: string[];
  endedCourses: EndedCourse[];
  /** A course code of the newest year without its parallel letter, like WPM26, which stays valid the longest. */
  exampleCode: string | null;
}

/** „not-published“: a running year whose plan is not out; „not-yet-published“: a study start still to come. */
export type OverviewEmptyReason =
  "nothing-published" | "nothing-running" | "no-match" | "not-in-year" | "not-published" | "not-yet-published" | "ended";

export interface OverviewSelection {
  programs: OverviewProgram[];
  years: OverviewYear[];
  emptyReason: OverviewEmptyReason | null;
  /** Where the plan of a year that has ended can still be read, for the „ended“ reason. */
  endedPlan?: string;
  /** An ended course the query names exactly while running courses are found too, whose plan stays reachable. */
  archivedPlan?: { code: string; href: string };
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

/* What people call the plans, and the word that joins one to its program: „Semesterplan für Logistik“ asks for Logistik. */
const planWord = /^(?:(?:block|semester|studienzeit|studienverlaufs|vorlesungs|kurs)?plane?|studienverlauf|fur)$/u;

/**
 * The words of a query that ask for something, normalized, with the names of the plans left out before and after them.
 * Plan words in between stay, being part of what is asked for: „Semesterplan für Planung für Räume“ asks for „Planung für
 * Räume“.
 */
export function searchWords(query: string): string[] {
  /* Only a plan word standing on its own goes. A word with a digit is a course code, whose „PLAN“, as in „FRM26-PLAN“,
     belongs to it; other words part at their hyphens, so „Semesterplan-Logistik“ is two. */
  return normalizeSearch(searchTokens(query).join(" ")).split(" ").filter(Boolean);
}

function asksNothing(word: string): boolean {
  const form = normalizeSearch(word);
  return !form || planWord.test(form);
}

/** Words without what asks for nothing before and after them: plan words and lone punctuation. */
function trimmed(words: string[]): string[] {
  let start = 0;
  let end = words.length;
  while (start < end && asksNothing(words[start])) start += 1;
  while (end > start && asksNothing(words[end - 1])) end -= 1;
  return words.slice(start, end);
}

/** The query's words as typed, for the names; words without a digit part at their hyphens. */
function searchTokens(query: string): string[] {
  return trimmed(query.trim().split(/\s+/u).filter(Boolean)
    .flatMap((word) => /\d/u.test(word) ? [word] : word.split(/[-–—]/u).filter(Boolean)));
}

/**
 * The ways one word of a query may name a course: whole as typed, hyphens included, since „CAMPUS-WEST“ is a code and not
 * two words; and, for a word without a digit, without a plan word hyphened to it, as „Blockplan-DUAL“ asks for DUAL.
 */
function typedCodes(query: string): string[] {
  const words = trimmed(query.trim().split(/\s+/u).filter(Boolean));
  if (words.length !== 1) return [];
  const [word] = words;
  const unhyphened = /\d/u.test(word) ? word : trimmed(word.split(/([-–—])/u)).join("");
  return unhyphened && unhyphened !== word ? [word, unhyphened] : [word];
}

export interface HighlightPiece { text: string; marked: boolean; start: number }

/**
 * A text cut into the pieces the words of a query mark, for the suggestions. It is compared letter by letter in the
 * search's own form, so a position there is the same in the text: „ku“ marks „Kü“ of „Künstliche“.
 */
export function highlightPieces(text: string, query: string): HighlightPiece[] {
  const letters = [...text.normalize("NFC")];
  /* One unit per letter, so that a position in it counts letters: a letter whose search form takes more, like an emoji's
     two, stands as a space, which no word of a search holds. */
  const comparable = letters.map((letter) => {
    const form = normalizeSearch(letter);
    return form.length === 1 ? form : " ";
  }).join("");
  const marked = letters.map(() => false);
  for (const word of searchWords(query)) {
    for (let start = comparable.indexOf(word); start >= 0; start = comparable.indexOf(word, start + 1)) {
      marked.fill(true, start, start + word.length);
    }
  }
  const pieces: HighlightPiece[] = [];
  letters.forEach((letter, index) => {
    const last = pieces.at(-1);
    if (last && last.marked === marked[index]) last.text += letter;
    else pieces.push({ text: letter, marked: marked[index], start: index });
  });
  return pieces;
}

function searchText(query: string): string {
  return searchWords(query).join(" ");
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

function phaseStatus(phases: CoursePhase[], today: string): OverviewPhaseStatus | null {
  const ordered = phases.toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  const index = ordered.findIndex((phase) => phase.startDate <= today && today <= phase.endDate);
  if (index >= 0) {
    /* Phases of one type that follow each other without a day between, like practice across a semester boundary, are
       one stay in one place. */
    const { type, endDate } = ordered[index];
    let end = endDate;
    for (const phase of ordered.slice(index + 1)) {
      if (phase.type !== type || phase.startDate !== plusDays(end, 1)) break;
      end = phase.endDate;
    }
    return { type, text: `${phasePlaceLabel(type)} bis ${dayAndMonth(end)}` };
  }
  const next = ordered.find((phase) => phase.startDate > today);
  return next ? { type: next.type, text: `${phasePlaceLabel(next.type)} ab ${dayAndMonth(next.startDate)}` } : null;
}

/* The program's cut of a year shows all of its published courses, ended ones included, so one link stands for a group
   only where the group is exactly what that cut shows. */
function chipsFor(
  courses: OverviewCourse[], cutSize: number, phasesByCourse: ReadonlyMap<string, CoursePhase[]>, today: string,
): OverviewChip[] {
  const phasesFor = (course: OverviewCourse) => phasesByCourse.get(course.id) ?? [];
  if (courses.length > 1 && courses.length === cutSize) {
    const [first, ...parallels] = courses;
    const sequence = phaseSequenceKey(phasesFor(first));
    if (parallels.every((course) => phaseSequenceKey(phasesFor(course)) === sequence)) {
      const codes = courses.map((course) => course.code);
      return [{
        label: `${first.code} + ${suffixes(codes).slice(1).join(" + ")}`,
        href: publicCutPath({ kind: "program", year: first.year, abbreviation: first.programAbbreviation }),
        codes,
        status: phaseStatus(phasesFor(first), today),
      }];
    }
  }
  return courses.map((course) => ({
    label: course.code, href: publicCutPath({ kind: "course", code: course.code }), codes: [course.code], status: phaseStatus(phasesFor(course), today),
  }));
}

function groupBy<Item, Key>(items: Item[], keyOf: (item: Item) => Key): Map<Key, Item[]> {
  const groups = new Map<Key, Item[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * The landing page's table: one row per program, one column per year in which a published course has not ended yet.
 * Where all parallel courses of a year share their whole progression they become one link to the program's cut of that
 * year, as the plan matrix shows them in one column; otherwise every course keeps a link of its own. `cutSizes` counts
 * what each of those cuts shows; without it, a cut is taken to show just the courses given here.
 */
export function buildPublicOverview(
  courses: OverviewCourse[], phases: CoursePhase[], today: string, cutSizes?: Map<string, number>, endedCourses: EndedCourse[] = [],
): PublicOverview {
  const sorted = courses.toSorted((left, right) => collator.compare(left.code, right.code));
  const coursesByYear = [...groupBy(sorted, (course) => course.year)].toSorted(([left], [right]) => left - right);
  const years = coursesByYear.map(([year, inYear]) => describeYear(year, inYear.map((course) => course.studyStart), today));

  const phasesByCourse = groupBy(phases, (phase) => phase.courseId);
  const byProgram = groupBy(sorted, (course) => course.programAbbreviation);
  const programs = [...byProgram.values()].map((programCourses): OverviewProgram => {
    const { programAbbreviation, program } = programCourses[0];
    const cells: Record<number, OverviewChip[]> = {};
    for (const [year, inYear] of groupBy(programCourses, (course) => course.year)) {
      const cutSize = cutSizes?.get(cutKey(programAbbreviation, year)) ?? inYear.length;
      cells[year] = chipsFor(inYear, cutSize, phasesByCourse, today);
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
  const newest = years.at(-1)?.year;
  const exampleCode = sorted.find((course) => course.year === newest)?.code.match(codeUpToYear)?.[0] ?? null;
  const publishedCuts = cutSizes ? [...cutSizes.keys()] : [...new Set(sorted.map((course) => cutKey(course.programAbbreviation, course.year)))];
  return { programs, years, courses: suggestions, nextYear, today, publishedCuts, endedCourses, exampleCode };
}

/** A code as the search compares it, on both sides alike: „WIN25A-A“, „win25a a“ and „WIN25AA“ all find WIN25A-A. */
function codeKey(text: string): string {
  return normalizeSearch(text).replace(/\s/g, "");
}

/** Whether each word of a search text names the program, by a part of its name or the start of its abbreviation, in any order. */
function namesProgram(program: OverviewProgram, text: string): boolean {
  const name = normalizeSearch(program.name);
  const abbreviation = codeKey(program.abbreviation);
  return text.split(" ").every((word) => !word || name.includes(word) || abbreviation.startsWith(word));
}

function beginsCode(code: string, query: string): boolean {
  return Boolean(query) && codeKey(code).startsWith(codeKey(query));
}

/**
 * Whether a query names the program as a whole: by its exact abbreviation or name, or by its words. Such a program shows
 * all its courses; one found only by a course code, the courses that code begins.
 */
function programNamed(program: OverviewProgram, query: string): boolean {
  const normalized = searchText(query);
  const abbreviation = program.abbreviation.toLocaleLowerCase("de-DE");
  const name = normalizeSearch(program.name);
  return abbreviation === query.trim().toLocaleLowerCase("de-DE") || (Boolean(normalized) && codeKey(program.abbreviation) === codeKey(normalized))
    || name === normalizeSearch(query) || namesProgram(program, normalized);
}

function matchesProgram(program: OverviewProgram, query: string): boolean {
  return namesProgram(program, query) || program.codes.some((code) => beginsCode(code, query));
}

/**
 * The programs a query finds. A query naming a program exactly, by its abbreviation or its whole name, finds that one
 * alone, so Informatik is not also Wirtschaftsinformatik and TIF is not every program named Informatik.
 */
export function findPrograms(overview: PublicOverview, query: string): OverviewProgram[] {
  const normalized = searchText(query);
  /* An abbreviation typed exactly finds that program alone, before ones that read the same once normalized: ABC, not AB-C. */
  const typed = query.trim().toLocaleLowerCase("de-DE");
  const exactAbbreviation = overview.programs.filter((program) => program.abbreviation.toLocaleLowerCase("de-DE") === typed);
  if (typed && exactAbbreviation.length) return exactAbbreviation;
  const byAbbreviation = overview.programs.filter((program) => codeKey(program.abbreviation) === codeKey(normalized));
  if (normalized && byAbbreviation.length) return byAbbreviation;
  /* The whole query first, plan words and all, so that a name holding one, like „Planung für Räume“, finds itself. */
  for (const text of [normalizeSearch(query), normalized]) {
    const exact = overview.programs.filter((program) => normalizeSearch(program.name) === text);
    if (text && exact.length) return exact;
  }
  return overview.programs.filter((program) => matchesProgram(program, normalized));
}

/** The candidate whose key is the typed text exactly, before one that only reads the same once normalized: ABC before AB-C. */
function byKey<T>(candidates: T[], keyOf: (candidate: T) => string, typed: string): T | undefined {
  return candidates.find((candidate) => keyOf(candidate).toLocaleLowerCase("de-DE") === typed.toLocaleLowerCase("de-DE"))
    ?? candidates.find((candidate) => codeKey(keyOf(candidate)) === codeKey(typed));
}

/** The query as typed, its spaces kept, with the words that ask for nothing left out before it, after it, or both. */
function edgeTrimmed(query: string, before: boolean, after: boolean): string {
  const words = [...query.matchAll(/\S+/gu)];
  let start = 0;
  let end = words.length;
  while (before && start < end && asksNothing(words[start][0])) start += 1;
  while (after && end > start && asksNothing(words[end - 1][0])) end -= 1;
  return start < end ? query.slice(words[start].index, words[end - 1].index + words[end - 1][0].length) : "";
}

function endedCourseFor(overview: PublicOverview, query: string): EndedCourse | undefined {
  /* A code may hold spaces, even two in a row, and even a plan word: „FRM22  ALT“, „FRM22 PLAN“. So the query as typed
     comes first, then without what asks for nothing before it, after it and on both sides; every way exactly before any
     way normalized, so that a later, exact one is not taken over by an earlier one that only reads the same. */
  const candidates = [...new Set([
    query.trim(), edgeTrimmed(query, true, false), edgeTrimmed(query, false, true), edgeTrimmed(query, true, true), ...typedCodes(query),
  ].filter(Boolean))];
  const typedLower = candidates.map((candidate) => candidate.toLocaleLowerCase("de-DE"));
  return candidates.map((_, index) => overview.endedCourses.find((course) => course.code.toLocaleLowerCase("de-DE") === typedLower[index]))
    .find(Boolean)
    ?? candidates.map((candidate) => overview.endedCourses.find((course) => codeKey(course.code) === codeKey(candidate))).find(Boolean);
}

function unpublishedReason(
  overview: PublicOverview, query: string, chosenYear: number | null,
): { reason: OverviewEmptyReason; endedPlan?: string } | null {
  /* An archive hit outside the chosen study start would hand over a plan the filter excludes. */
  const course = endedCourseFor(overview, query);
  if (course) {
    return chosenYear === null || chosenYear === course.year
      ? { reason: "ended", endedPlan: publicCutPath({ kind: "course", code: course.code }) }
      : { reason: "not-in-year" };
  }
  /* What follows reads a code from its start, which takes one word: „WWI23 irgendwas“ asks for something else. */
  const typed = typedCodes(query).at(-1);
  if (!typed) return null;
  const match = codeKey(typed).match(codeUpToYear);
  const year = match ? courseCodeYear(match[0], overview.today) : undefined;
  if (!match || year === undefined) return null;
  const letters = typed.match(/^\D+/u)?.[0] ?? match[1];
  const program = byKey(overview.programs, (candidate) => candidate.abbreviation, letters);
  if (program?.cells[year]) return null;
  const cut = byKey(overview.publishedCuts.map((key) => key.split(" ")).filter(([, cutYear]) => Number(cutYear) === year),
    ([cutAbbreviation]) => cutAbbreviation, letters);
  /* A code that goes on past its year names one course, which the ended courses above would have known. */
  if (cut) {
    if (match[0] !== codeKey(typed)) return null;
    if (chosenYear !== null && chosenYear !== year) return { reason: "not-in-year" };
    return { reason: "ended", endedPlan: publicCutPath({ kind: "program", year, abbreviation: cut[0].toUpperCase() }) };
  }
  if (!program) return null;
  if (year >= overview.nextYear) return { reason: "not-yet-published" };
  return year >= program.runningFrom ? { reason: "not-published" } : null;
}

export function selectPublicOverview(overview: PublicOverview, { query, year }: { query: string; year: string }): OverviewSelection {
  const years = overview.years.some((candidate) => String(candidate.year) === year)
    ? overview.years.filter((candidate) => String(candidate.year) === year)
    : overview.years;
  const chosenYear = years.length === 1 && String(years[0].year) === year ? years[0].year : null;
  const found = findPrograms(overview, query);
  const normalized = searchText(query);
  const shown = (year: number) => years.some((candidate) => candidate.year === year);
  /* A program the query names is shown with all of its courses; one found by a course code with the courses that code
     begins only, so that FRM26 does not bring FRM25 along. */
  const programs = found.map((program) => {
    if (programNamed(program, query)) return program;
    const cells = Object.fromEntries(Object.entries(program.cells)
      .map(([year, chips]) => [year, chips.filter((chip) => chip.codes.some((code) => beginsCode(code, normalized)))] as const)
      .filter(([, chips]) => chips.length));
    return { ...program, cells, omitted: Object.keys(program.cells).filter((year) => !cells[year]).map(Number) };
  }).filter((program) => Object.keys(program.cells).some((year) => shown(Number(year))));
  let emptyReason: OverviewEmptyReason | null = null;
  let endedPlan: string | undefined;
  if (!programs.length) {
    /* Programs found only outside the chosen year leave an archive hit inside it the answer, like DUAL of 2023 beside a
       running DUAL-B of 2026. */
    const unpublished = unpublishedReason(overview, query, chosenYear);
    const nothingShown = overview.publishedCuts.length ? "nothing-running" : "nothing-published";
    emptyReason = found.length
      ? unpublished?.reason === "ended" ? "ended" : "not-in-year"
      : unpublished?.reason ?? (overview.programs.length ? "no-match" : nothingShown);
    endedPlan = emptyReason === "ended" ? unpublished?.endedPlan : undefined;
  }
  /* A search shows the years it found something in; without one, every year with a published course. */
  const columns = normalized ? years.filter((candidate) => programs.some((program) => program.cells[candidate.year])) : years;
  /* A whole code of an ended course stays reachable while running courses begin with it, like FRM23X beside FRM23X-IT. */
  const archived = programs.length ? endedCourseFor(overview, query) : undefined;
  const archivedPlan = archived && (chosenYear === null || chosenYear === archived.year)
    ? { code: archived.code, href: publicCutPath({ kind: "course", code: archived.code }) }
    : undefined;
  return {
    programs, years: columns.length ? columns : years, emptyReason,
    ...(endedPlan ? { endedPlan } : {}), ...(archivedPlan ? { archivedPlan } : {}),
  };
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
  const normalized = searchText(query);
  if (!normalized) return { programs: [], courses: [] };
  const inYear = (candidate: number) => year === "all" || String(candidate) === year;
  /* The same programs the table shows, so that choosing one never swaps a course code for a program with other plans. */
  const programs = selectPublicOverview(overview, { query, year }).programs;
  /* Courses only of the programs found; one found through a course code contributes only the courses that code begins. */
  const found = new Set(programs.map((program) => program.abbreviation));
  const named = new Set(programs.filter((program) => programNamed(program, query)).map((program) => program.abbreviation));
  const courses = overview.courses
    .filter((course) => inYear(course.year) && found.has(course.abbreviation)
      && (named.has(course.abbreviation) || beginsCode(course.code, normalized)))
    .toSorted((left, right) => right.year - left.year || collator.compare(left.code, right.code))
    .slice(0, suggestionLimit);
  return {
    /* Choosing a program shows all of it, so it counts all its years, not the ones a course code narrowed the table to. */
    programs: programs.slice(0, suggestionLimit).map((found) => {
      const program = overview.programs.find((candidate) => candidate.abbreviation === found.abbreviation)!;
      const count = Object.keys(program.cells).length;
      const years = count === 1 ? "1 Jahrgang" : `${count} Jahrgänge`;
      /* The field gets the name where the name finds this program alone, and the abbreviation where it would find another,
         one of the same name or one whose abbreviation the name is. */
      const byName = findPrograms(overview, program.name);
      const shared = byName.length !== 1 || byName[0].abbreviation !== program.abbreviation;
      return shared
        ? { abbreviation: program.abbreviation, name: program.name, label: program.abbreviation, detail: `${program.abbreviation} · ${years}` }
        : { abbreviation: program.abbreviation, name: program.name, label: program.name, detail: years };
    }),
    courses,
  };
}
