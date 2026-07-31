import "server-only";

import type Database from "better-sqlite3";

import { matchesCodePrefix, normalizeCodePrefix } from "@/lib/domain/course-code";
import { courseStanding, type CourseStanding, type StandingPhase } from "@/lib/domain/course-progress";
import { courseStatus, type CourseStatus, type PublicationState } from "@/lib/domain/course-status";
import { type DraftCourse, type DraftEvent, type DraftPhase } from "@/lib/domain/publication";

import { type AreaOption, allAreas, manageableAreas } from "../data";

type AccountScope = { id: string; systemAdmin: boolean };
export type CourseListFilters = { area: string | null; program: string | null; year: string | null; code: string | null; state: PublicationState | null };
/** What a course is marked with in every internal view: its publication state, whether it is in progress and whether this account may write to it. */
export type CourseMarking = { state: PublicationState; workInProgress: boolean; editable: boolean };
export type CourseListRow = CourseMarking & { id: string; code: string; program: string; areaId: string; areaName: string; studyStart: string; studyEnd: string };
export type CourseListData = { areas: AreaOption[]; programs: LabeledOption[]; years: { year: string }[]; courses: CourseListRow[] };
export type InternalCourse = CourseMarking & { id: string; code: string; programId: string; program: string; areaId: string; areaName: string; studyStart: string; studyEnd: string; publishedIn: string | null };
/** An entry of a select: the value it submits and the text it shows. */
export type LabeledOption = { id: string; label: string };
export type CutCourse = DraftCourse & CourseMarking & { areaId: string; areaName: string };
/** A course on the overview. It carries no `editable`: the overview reads the own areas only, so all of them are. */
export type OverviewCourse = CourseStatus & CourseStanding & { id: string; code: string };
export type OverviewYear = { year: string; courses: OverviewCourse[] };
export type OverviewProgram = { id: string; name: string; abbreviation: string; areaName: string; years: OverviewYear[] };
export type CourseCutData = { year: string; courses: CutCourse[]; phases: (DraftPhase & { id: string })[]; events: (DraftEvent & { affectedCourseCodes: string[] })[] };
export type CourseSort = "code" | "year";
export const courseSortLabels: Record<CourseSort, string> = { code: "Kurskennung", year: "Jahrgang, dann Kurskennung" };
const courseOrderClauses: Record<CourseSort, string> = { code: "course.code COLLATE NOCASE", year: "substr(course.study_start, 1, 4) DESC, course.code COLLATE NOCASE" };
export function isCourseSort(value: string | null): value is CourseSort { return value !== null && Object.hasOwn(courseSortLabels, value); }

/** The two designations of a study program, because the same name may occur in more than one area once all of them are listed. */
function programLabel(program: { name: string; abbreviation: string }): string {
  return `${program.abbreviation} — ${program.name}`;
}

/** The areas this account may write to, as the set the list markings are decided against (ADR 0011). */
function editableAreaIds(sqlite: Database.Database, account: AccountScope): Set<string> {
  return new Set(manageableAreas(sqlite, account).map((area) => area.id));
}

/** The columns every internal course query selects to derive the markings from. The views show the markings, not these. */
type MarkingColumns = { areaId: string; hasEverBeenPublished: number; draftUpdatedAt: string; publishedAt: string | null };

/** Turns the raw marking columns of one course row into the markings themselves, for whichever view read the row. */
function markCourse<TRow extends MarkingColumns>(row: TRow, editableAreas: Set<string>): Omit<TRow, "hasEverBeenPublished" | "draftUpdatedAt" | "publishedAt"> & CourseMarking {
  const { hasEverBeenPublished, draftUpdatedAt, publishedAt, ...rest } = row;
  return { ...rest, ...courseStatus({ hasEverBeenPublished: Boolean(hasEverBeenPublished), publishedAt, draftUpdatedAt }), editable: editableAreas.has(row.areaId) };
}

type CourseRow = MarkingColumns & { id: string; code: string; program: string; areaName: string; studyStart: string; studyEnd: string };

/**
 * Every course of every area, because area editing reads system wide and only writes within its own areas (ADR 0011).
 * The area, study program and year filters therefore offer foreign values too — a filter that hid them would leave the
 * foreign courses findable in name only.
 */
export function courseListData(sqlite: Database.Database, account: AccountScope, filters: CourseListFilters, sort: CourseSort): CourseListData {
  const areas = allAreas(sqlite);
  const editableAreas = editableAreaIds(sqlite, account);
  const programs = (sqlite.prepare("SELECT id, name, abbreviation FROM programs ORDER BY abbreviation COLLATE NOCASE").all() as { id: string; name: string; abbreviation: string }[])
    .map((program) => ({ id: program.id, label: programLabel(program) }));
  const years = sqlite.prepare("SELECT DISTINCT substr(study_start, 1, 4) AS year FROM courses ORDER BY year DESC").all() as CourseListData["years"];
  const rows = sqlite.prepare(`SELECT course.id, course.code, program.name AS program, area.id AS areaId, area.name AS areaName,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.has_ever_been_published AS hasEverBeenPublished,
      course.draft_updated_at AS draftUpdatedAt, published.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    LEFT JOIN published_courses published ON published.course_id = course.id
    WHERE (? IS NULL OR program.area_id = ?) AND (? IS NULL OR course.program_id = ?) AND (? IS NULL OR substr(course.study_start, 1, 4) = ?)
    ORDER BY ${courseOrderClauses[sort]}`).all(filters.area, filters.area, filters.program, filters.program, filters.year, filters.year) as CourseRow[];
  const codePrefix = normalizeCodePrefix(filters.code);
  const courses = rows
    .filter((row) => !codePrefix || matchesCodePrefix(row.code, codePrefix))
    .map((row) => markCourse(row, editableAreas))
    .filter((course) => !filters.state || course.state === filters.state);
  return { areas, programs, years, courses };
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
  const rows = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd,
      program.id AS programId, program.name AS programName, program.abbreviation, area.name AS areaName,
      course.has_ever_been_published AS hasEverBeenPublished, course.draft_updated_at AS draftUpdatedAt, published.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    LEFT JOIN published_courses published ON published.course_id = course.id
    WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY area.name COLLATE NOCASE, program.abbreviation COLLATE NOCASE, program.id,
      substr(course.study_start, 1, 4), course.code COLLATE NOCASE`)
    .all(account.systemAdmin ? 1 : 0, account.id) as OverviewRow[];

  /* The phases of all those courses at once: one query per course would repeat the area predicate for every tile. */
  const phaseRows = sqlite.prepare(`SELECT phase.course_id AS courseId, phase.semester, phase.phase_type AS type,
      phase.start_date AS startDate, phase.end_date AS endDate
    FROM course_phases phase JOIN courses course ON course.id = phase.course_id JOIN programs program ON program.id = course.program_id
    WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY phase.start_date`).all(account.systemAdmin ? 1 : 0, account.id) as (StandingPhase & { courseId: string })[];
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
      ...courseStatus({ hasEverBeenPublished: Boolean(row.hasEverBeenPublished), publishedAt: row.publishedAt, draftUpdatedAt: row.draftUpdatedAt }),
    });
  }
  return programs;
}

export function findInternalCourse(sqlite: Database.Database, courseId: string, account: AccountScope): InternalCourse | undefined {
  const row = sqlite.prepare(`SELECT course.id, course.code, course.program_id AS programId, program.name AS program, program.area_id AS areaId, area.name AS areaName,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.has_ever_been_published AS hasEverBeenPublished,
      course.draft_updated_at AS draftUpdatedAt, published.published_at AS publishedAt, published.code AS publishedIn
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    LEFT JOIN published_courses published ON published.course_id = course.id WHERE course.id = ?`)
    .get(courseId) as (MarkingColumns & Omit<InternalCourse, keyof CourseMarking | "areaId">) | undefined;
  return row && markCourse(row, editableAreaIds(sqlite, account));
}

/**
 * The study programs a course may be assigned to. Assigning one is a write, so this stays within the areas of the
 * account. `semesters` narrows it further for an adoption, which requires template and target to agree on the number
 * of semesters — offering the others would only lead into a refusal.
 */
export function programOptions(sqlite: Database.Database, account: AccountScope, semesters?: number): LabeledOption[] {
  const rows = sqlite.prepare(`SELECT program.id, program.name, program.abbreviation, area.name AS areaName FROM programs program JOIN areas area ON area.id = program.area_id
    WHERE (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)) AND (? IS NULL OR program.semesters = ?)
    ORDER BY area.name COLLATE NOCASE, program.name COLLATE NOCASE`).all(account.systemAdmin ? 1 : 0, account.id, semesters ?? null, semesters ?? null) as { id: string; name: string; abbreviation: string; areaName: string }[];
  return rows.map((program) => ({ id: program.id, label: `${programLabel(program)} (${program.areaName})` }));
}

type CutCourseRow = MarkingColumns & DraftCourse & { areaName: string };

/** A cut may hold courses of foreign areas: comparing them side by side is the point of reading system wide (ADR 0011). */
export function courseCutData(sqlite: Database.Database, account: AccountScope, input: { year: string; courseIds: string[] }): CourseCutData | null {
  const courseIds = [...new Set(input.courseIds.map((id) => id.trim()).filter(Boolean))];
  if (!/^\d{4}$/u.test(input.year) || !courseIds.length) return null;
  const placeholders = courseIds.map(() => "?").join(", ");
  const rows = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd, program.semesters,
      program.area_id AS areaId, area.name AS areaName, course.has_ever_been_published AS hasEverBeenPublished,
      course.draft_updated_at AS draftUpdatedAt, published.published_at AS publishedAt
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    LEFT JOIN published_courses published ON published.course_id = course.id
    WHERE course.id IN (${placeholders}) AND substr(course.study_start, 1, 4) = ? ORDER BY course.code COLLATE NOCASE`).all(...courseIds, input.year) as CutCourseRow[];
  if (rows.length !== courseIds.length) return null;
  const editableAreas = editableAreaIds(sqlite, account);
  const courses = rows.map((row) => markCourse(row, editableAreas));
  const phases = sqlite.prepare(`SELECT id, course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM course_phases WHERE course_id IN (${placeholders}) ORDER BY semester, start_date, id`).all(...courseIds) as CourseCutData["phases"];
  const events = sqlite.prepare(`SELECT event.id, event.course_id AS courseId, event.title, event.description, event.category, event.start_date AS startDate, event.end_date AS endDate, event.provisional, course.code
    FROM course_events event JOIN courses course ON course.id = event.course_id WHERE event.course_id IN (${placeholders}) ORDER BY event.start_date, event.title COLLATE NOCASE, event.id`).all(...courseIds) as (Omit<DraftEvent, "courseIds" | "provisional"> & { courseId: string; code: string; provisional: number })[];
  return { year: input.year, courses, phases, events: events.map(({ courseId, code, provisional, ...event }) => ({ ...event, provisional: Boolean(provisional), courseIds: [courseId], affectedCourseCodes: [code] })) };
}
