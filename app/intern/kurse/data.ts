import "server-only";

import type Database from "better-sqlite3";

import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import type { ComparisonScope } from "@/lib/domain/course-comparison";
import { matchesCodePrefix, normalizeCodePrefix } from "@/lib/domain/course-code";
import { courseStanding, type CourseStanding, type StandingPhase } from "@/lib/domain/course-progress";
import { publicationState, type PublicationState } from "@/lib/domain/course-status";
import { type CoursePlan, type PlanEvent, type PlanPhase } from "@/lib/domain/publication";

import { manageableAreas } from "../data";

type AccountScope = { id: string; systemAdmin: boolean };
/**
 * Whether the list stands on the courses this account is responsible for or on all of them. Reading across areas is
 * permitted (ADR 0011), but with eighteen study programs and few areas per account it is the exception, so the list
 * opens on the own ones and the address carries the widening.
 */
export type CourseResponsibility = "own" | "all";
export type CourseListFilters = { program: string | null; year: string | null; code: string | null; responsibility: CourseResponsibility };
/** What a course is marked with in every internal view: its visibility and whether this account may write to it. */
export type CourseMarking = { state: PublicationState; editable: boolean };
/**
 * `publishedOn` is the calendar day the course became visible on, and `null` where it is not. The list shows that day
 * instead of naming the state in every row: the state is what the day already says, while the day itself differs from
 * row to row and the state does not.
 */
export type CourseListRow = CourseMarking & { id: string; code: string; programId: string; program: string; areaId: string; areaName: string; studyStart: string; studyEnd: string; publishedOn: string | null };
/**
 * `totalInScope` is what the listed courses are counted against: every course of the chosen responsibility, before
 * study program, year and code narrow it. The responsibility itself is not part of that narrowing — it decides which
 * courses exist for this view at all, so widening it changes the whole rather than the part.
 */
export type CourseListData = { programs: LabeledOption[]; years: { year: string }[]; courses: CourseListRow[]; totalInScope: number };
export type InternalCourse = CourseMarking & { id: string; code: string; programId: string; program: string; areaId: string; areaName: string; studyStart: string; studyEnd: string; publishedAt: string | null };
/** An entry of a select: the value it submits and the text it shows. */
export type LabeledOption = { id: string; label: string };
/** A study program to choose from. It carries its number of semesters, from which a generated progression derives study end and phase count. */
export type ProgramOption = LabeledOption & { semesters: number };
/**
 * A course as the course page shows it, whether it is the edited one or one it is compared with. It carries the two
 * timestamps the publication controls compare against, so the page needs no second read of the same course beside the
 * one that produced its plan.
 */
export type PlanCourse = CoursePlan & CourseMarking & { areaId: string; areaName: string; program: string; programId: string; updatedAt: string; publishedAt: string | null };
/** A course on the overview. It carries no `editable`: the overview reads the own areas only, so all of them are. */
export type OverviewCourse = CourseStanding & { id: string; code: string; state: PublicationState };
export type OverviewYear = { year: string; courses: OverviewCourse[] };
export type OverviewProgram = { id: string; name: string; abbreviation: string; areaName: string; years: OverviewYear[] };
export type CoursePlanData = { course: PlanCourse; scope: ComparisonScope; comparison: PlanCourse[]; phases: PlanPhase[]; events: PlanEvent[] };
export type CourseSort = "code" | "program" | "studyPeriod" | "publication";
export type CourseSortDirection = "asc" | "desc";
export function isCourseSort(value: string | null): value is CourseSort {
  return value !== null && ["code", "program", "studyPeriod", "publication"].includes(value);
}
export function isCourseSortDirection(value: string | null): value is CourseSortDirection {
  return value === "asc" || value === "desc";
}

/** The two designations of a study program, because the same name may occur in more than one area once all of them are listed. */
function programLabel(program: { name: string; abbreviation: string }): string {
  return `${program.abbreviation} — ${program.name}`;
}

/** The areas this account may write to, as the set the list markings are decided against (ADR 0011). */
function editableAreaIds(sqlite: Database.Database, account: AccountScope): Set<string> {
  return new Set(manageableAreas(sqlite, account).map((area) => area.id));
}

/** The columns every internal course query selects to derive the markings from. The views show the markings, not these. */
type MarkingColumns = { areaId: string; publishedAt: string | null };

/** Turns the raw marking columns of one course row into the markings themselves, for whichever view read the row. */
function markCourse<TRow extends MarkingColumns>(row: TRow, editableAreas: Set<string>): TRow & CourseMarking {
  return { ...row, state: publicationState(row.publishedAt), editable: editableAreas.has(row.areaId) };
}

type CourseRow = MarkingColumns & { id: string; code: string; programId: string; program: string; areaName: string; studyStart: string; studyEnd: string };

/**
 * The day a publication falls on. `published_at` holds the instant it happened in UTC, and an evening publication
 * belongs to the following day in Berlin — the calendar every view of this application reckons in. The list shows a
 * day, so the instant becomes one here rather than in the view that draws it.
 */
function publishedOn(publishedAt: string | null): string | null {
  return publishedAt ? berlinCalendarDay(new Date(publishedAt)) : null;
}

/**
 * Every course of every area, because area editing reads system wide and only writes within its own areas (ADR 0011).
 * The study program and year filters therefore offer foreign values too — a filter that hid them would leave the
 * foreign courses findable in name only.
 */
export function courseListData(sqlite: Database.Database, account: AccountScope, filters: CourseListFilters, sort: CourseSort, direction: CourseSortDirection = "asc"): CourseListData {
  const editableAreas = editableAreaIds(sqlite, account);
  const programs = (sqlite.prepare("SELECT id, name, abbreviation FROM programs ORDER BY abbreviation COLLATE NOCASE").all() as { id: string; name: string; abbreviation: string }[])
    .map((program) => ({ id: program.id, label: programLabel(program) }));
  const years = sqlite.prepare("SELECT DISTINCT substr(study_start, 1, 4) AS year FROM courses ORDER BY year DESC").all() as CourseListData["years"];
  const rows = sqlite.prepare(`SELECT course.id, course.code, program.id AS programId, program.name AS program, area.id AS areaId, area.name AS areaName,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    ORDER BY course.code COLLATE NOCASE`).all() as CourseRow[];
  /* The responsibility narrows after the marking rather than in the query, because „own“ means exactly what the
     marking already decided — a second predicate in SQL could drift away from it. The three remaining filters then
     narrow beside it instead of in the query, so that the whole and the part the list counts itself against are
     taken from one and the same set of rows. */
  const scoped = rows.map((row) => ({ ...markCourse(row, editableAreas), publishedOn: publishedOn(row.publishedAt) }))
    .filter((course) => filters.responsibility === "all" || course.editable);
  const codePrefix = normalizeCodePrefix(filters.code);
  const courses = scoped.filter((course) =>
    (!filters.program || course.programId === filters.program)
    && (!filters.year || course.studyStart.slice(0, 4) === filters.year)
    && (!codePrefix || matchesCodePrefix(course.code, codePrefix)));
  const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });
  const valueOf = (course: CourseListRow): string => {
    switch (sort) {
      case "program": return course.program;
      case "studyPeriod": return course.studyStart;
      /* Sorted by the day the column shows, not by the state behind it. Courses without one share the empty value and
         gather at one end, where the tie-break by course code orders them among themselves. */
      case "publication": return course.publishedOn ?? "";
      default: return course.code;
    }
  };
  courses.sort((left, right) => {
    const primary = collator.compare(valueOf(left), valueOf(right)) * (direction === "asc" ? 1 : -1);
    return primary || collator.compare(left.code, right.code);
  });
  return { programs, years, courses, totalInScope: scoped.length };
}

type OverviewRow = Omit<MarkingColumns, "areaId"> & { id: string; code: string; studyStart: string; studyEnd: string; programId: string; programName: string; abbreviation: string; areaName: string };

/**
 * The courses of the areas this account may write in, grouped the way the overview shows them: by study program, and
 * within it by year ascending. Unlike the course list this stays inside the own areas — the overview is the way into
 * one's own work, while reading across every area is what the list is for (ADR 0011).
 *
 * The grouping walks the rows in the order the query returns them, so the sorting lives in the `ORDER BY` alone. The
 * study program is grouped by its id rather than by its designation, because the same name may occur in more than one
 * area; the id is therefore also what settles the order within an area.
 */
export function overviewPrograms(sqlite: Database.Database, account: AccountScope, today: string): OverviewProgram[] {
  return ownAreaPrograms(sqlite, account, today, false);
}

/**
 * The same grouping, narrowed to the courses whose study period includes `today` — the ones the day page reads the
 * lecture calendars of. A course that has not begun or has finished has no lectures to show, and reading its calendar
 * would only cost a request to the DHBW calendar system per course.
 */
export function studyingPrograms(sqlite: Database.Database, account: AccountScope, today: string): OverviewProgram[] {
  return ownAreaPrograms(sqlite, account, today, true);
}

function ownAreaPrograms(sqlite: Database.Database, account: AccountScope, today: string, studyingOnly: boolean): OverviewProgram[] {
  const scope = [account.systemAdmin ? 1 : 0, account.id, studyingOnly ? 1 : 0, today, today];
  const rows = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd,
      program.id AS programId, program.name AS programName, program.abbreviation, area.name AS areaName,
      course.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    WHERE (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))
      AND (? = 0 OR (course.study_start <= ? AND course.study_end >= ?))
    ORDER BY area.name COLLATE NOCASE, program.abbreviation COLLATE NOCASE, program.id,
      substr(course.study_start, 1, 4), course.code COLLATE NOCASE`)
    .all(...scope) as OverviewRow[];

  /* The phases of all those courses at once: one query per course would repeat the area predicate for every tile. */
  const phaseRows = sqlite.prepare(`SELECT phase.course_id AS courseId, phase.semester, phase.phase_type AS type,
      phase.start_date AS startDate, phase.end_date AS endDate
    FROM course_phases phase JOIN courses course ON course.id = phase.course_id JOIN programs program ON program.id = course.program_id
    WHERE (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))
      AND (? = 0 OR (course.study_start <= ? AND course.study_end >= ?))
    ORDER BY phase.start_date`).all(...scope) as (StandingPhase & { courseId: string })[];
  const phasesByCourse = new Map<string, StandingPhase[]>();
  for (const { courseId, ...phase } of phaseRows) {
    const phases = phasesByCourse.get(courseId);
    if (phases) phases.push(phase);
    else phasesByCourse.set(courseId, [phase]);
  }

  const programs: OverviewProgram[] = [];
  for (const row of rows) {
    let program = programs.at(-1);
    if (program?.id !== row.programId) {
      program = { id: row.programId, name: row.programName, abbreviation: row.abbreviation, areaName: row.areaName, years: [] };
      programs.push(program);
    }
    const startYear = row.studyStart.slice(0, 4);
    let year = program.years.at(-1);
    if (year?.year !== startYear) {
      year = { year: startYear, courses: [] };
      program.years.push(year);
    }
    year.courses.push({
      id: row.id, code: row.code,
      ...courseStanding(row, phasesByCourse.get(row.id) ?? [], today),
      state: publicationState(row.publishedAt),
    });
  }
  return programs;
}

export function findInternalCourse(sqlite: Database.Database, courseId: string, account: AccountScope): InternalCourse | undefined {
  const row = sqlite.prepare(`SELECT course.id, course.code, course.program_id AS programId, program.name AS program, program.area_id AS areaId, area.name AS areaName,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    WHERE course.id = ?`)
    .get(courseId) as (MarkingColumns & Omit<InternalCourse, keyof CourseMarking | "areaId">) | undefined;
  return row && markCourse(row, editableAreaIds(sqlite, account));
}

/**
 * The study programs a course may be assigned to. Assigning one is a write, so this stays within the areas of the
 * account. `semesters` narrows it further for an adoption, which requires template and target to agree on the number
 * of semesters — offering the others would only lead into a refusal.
 */
export function programOptions(sqlite: Database.Database, account: AccountScope, semesters?: number): ProgramOption[] {
  const rows = sqlite.prepare(`SELECT program.id, program.name, program.abbreviation, program.semesters, area.name AS areaName FROM programs program JOIN areas area ON area.id = program.area_id
    WHERE (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)) AND (? IS NULL OR program.semesters = ?)
    ORDER BY area.name COLLATE NOCASE, program.name COLLATE NOCASE`).all(account.systemAdmin ? 1 : 0, account.id, semesters ?? null, semesters ?? null) as { id: string; name: string; abbreviation: string; semesters: number; areaName: string }[];
  return rows.map((program) => ({ id: program.id, label: `${programLabel(program)} (${program.areaName})`, semesters: program.semesters }));
}

type PlanCourseRow = MarkingColumns & CoursePlan & { areaName: string; program: string; programId: string; updatedAt: string };

const planCourseColumns = `course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd,
  program.semesters, program.id AS programId, program.name AS program, program.area_id AS areaId, area.name AS areaName,
  course.published_at AS publishedAt, course.updated_at AS updatedAt
  FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id`;

/**
 * The courses that stand beside an edited one, always within its year (ADR 0010). They may belong to foreign areas:
 * seeing them is the point of reading system wide, writing to them stays refused (ADR 0011).
 */
function comparisonCourseRows(sqlite: Database.Database, course: PlanCourseRow, scope: ComparisonScope): PlanCourseRow[] {
  if (scope === "none") return [];
  const restriction = scope === "program" ? "AND course.program_id = ?" : scope === "area" ? "AND program.area_id = ?" : "";
  const parameters = scope === "program" ? [course.programId] : scope === "area" ? [course.areaId] : [];
  return sqlite.prepare(`SELECT ${planCourseColumns}
    WHERE course.id <> ? AND substr(course.study_start, 1, 4) = substr(?, 1, 4) ${restriction}
    ORDER BY course.code COLLATE NOCASE`).all(course.id, course.studyStart, ...parameters) as PlanCourseRow[];
}

/**
 * One course with its saved plan and the courses its comparison currently shows. The edited course and the compared
 * ones are read apart on purpose: only the first is ever written to, while the others exist so that a deviation is
 * seen while it is being made. Phases and events cover all of them, because the matrix draws every column.
 */
export function coursePlanData(sqlite: Database.Database, account: AccountScope, courseId: string, scope: ComparisonScope): CoursePlanData | null {
  const row = sqlite.prepare(`SELECT ${planCourseColumns} WHERE course.id = ?`).get(courseId) as PlanCourseRow | undefined;
  if (!row) return null;
  const editableAreas = editableAreaIds(sqlite, account);
  const course = markCourse(row, editableAreas);
  const comparison = comparisonCourseRows(sqlite, row, scope).map((candidate) => markCourse(candidate, editableAreas));
  const ids = [course.id, ...comparison.map((candidate) => candidate.id)];
  const placeholders = ids.map(() => "?").join(", ");
  const phases = sqlite.prepare(`SELECT phase.id, phase.course_id AS courseId, phase.semester, phase.phase_type AS type,
      phase.start_date AS startDate, phase.end_date AS endDate, course.code
    FROM course_phases phase JOIN courses course ON course.id = phase.course_id
    WHERE phase.course_id IN (${placeholders}) ORDER BY phase.semester, phase.start_date, phase.id`).all(...ids) as PlanPhase[];
  const events = sqlite.prepare(`SELECT event.id, event.course_id AS courseId, event.title, event.description, event.category,
      event.start_date AS startDate, event.end_date AS endDate, event.provisional, course.code
    FROM course_events event JOIN courses course ON course.id = event.course_id
    WHERE event.course_id IN (${placeholders}) ORDER BY event.start_date, event.title COLLATE NOCASE, event.id`)
    .all(...ids) as (Omit<PlanEvent, "courseIds" | "provisional"> & { courseId: string; provisional: number })[];
  return {
    course,
    scope,
    comparison,
    phases,
    events: events.map(({ courseId: eventCourseId, provisional, ...event }) => ({ ...event, provisional: Boolean(provisional), courseIds: [eventCourseId] })),
  };
}
