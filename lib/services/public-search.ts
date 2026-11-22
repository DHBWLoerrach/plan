import type Database from "better-sqlite3";

import { cutKey, type EndedCourse } from "@/lib/domain/public-overview";
import type { PublicCut } from "@/lib/domain/public-cut";
import { normalizeCourseCode } from "@/lib/domain/course-code";
import type { CoursePlan, CourseEvent, CoursePhase } from "@/lib/domain/publication";

/** A currently published course, enriched with the current designations that address its cuts. */
export type PublicCourse = CoursePlan & { area: string; program: string; programAbbreviation: string; year: number };
export interface PublicCutDetail {
  cut: PublicCut;
  courses: PublicCourse[];
  phases: CoursePhase[];
  events: CourseEvent[];
}

type StoredEventRow = Omit<CourseEvent, "courseIds" | "provisional"> & { courseId: string; provisional: number };

/**
 * Every published course that has not ended by `today`, with its phases: what the landing page lays out. `cutSizes`
 * counts the published courses of each program and year, ended ones included, as the program's cut of that year shows them;
 * `endedCourses` names the published courses that have ended, whose plans a search can still lead to.
 */
export function readPublicOverview(sqlite: Database.Database, today: string): {
  courses: PublicCourse[]; phases: CoursePhase[]; cutSizes: Map<string, number>; endedCourses: EndedCourse[];
} {
  const courses = sqlite.prepare(`SELECT course.id, course.code, area.name AS area, program.name AS program,
      program.abbreviation AS programAbbreviation,
      course.study_start AS studyStart, course.study_end AS studyEnd, program.semesters,
      CAST(substr(course.study_start, 1, 4) AS INTEGER) AS year
    FROM courses course JOIN programs program ON program.id = course.program_id
    JOIN areas area ON area.id = program.area_id
    WHERE course.published_at IS NOT NULL AND course.study_end >= ?
    ORDER BY course.code COLLATE NOCASE`).all(today) as PublicCourse[];
  const phases = sqlite.prepare(`SELECT phase.course_id AS courseId, phase.semester, phase.phase_type AS type,
      phase.start_date AS startDate, phase.end_date AS endDate
    FROM course_phases phase JOIN courses course ON course.id = phase.course_id
    WHERE course.published_at IS NOT NULL AND course.study_end >= ?
    ORDER BY phase.course_id, phase.semester, phase.start_date, phase.end_date`).all(today) as CoursePhase[];
  const sizes = sqlite.prepare(`SELECT program.abbreviation AS abbreviation, CAST(substr(course.study_start, 1, 4) AS INTEGER) AS year,
      COUNT(*) AS size
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.published_at IS NOT NULL
    GROUP BY lower(program.abbreviation), year`).all() as Array<{ abbreviation: string; year: number; size: number }>;
  const endedCourses = sqlite.prepare(`SELECT course.code, CAST(substr(course.study_start, 1, 4) AS INTEGER) AS year
    FROM courses course
    WHERE course.published_at IS NOT NULL AND course.study_end < ?
    ORDER BY course.code COLLATE NOCASE`).all(today) as EndedCourse[];
  return { courses, phases, cutSizes: new Map(sizes.map((row) => [cutKey(row.abbreviation, row.year), row.size])), endedCourses };
}

function cutQuery(cut: PublicCut): { sql: string; parameters: unknown[] } | null {
  switch (cut.kind) {
    case "course": {
      const code = normalizeCourseCode(cut.code);
      return code ? { sql: "course.normalized_code = ?", parameters: [code] } : null;
    }
    case "year": return { sql: "CAST(substr(course.study_start, 1, 4) AS INTEGER) = ?", parameters: [cut.year] };
    case "area": return { sql: "area.name = ? AND CAST(substr(course.study_start, 1, 4) AS INTEGER) = ?", parameters: [cut.name, cut.year] };
    case "program": return { sql: "program.abbreviation = ? COLLATE NOCASE AND CAST(substr(course.study_start, 1, 4) AS INTEGER) = ?", parameters: [cut.abbreviation, cut.year] };
  }
}

function readCoursesForCut(sqlite: Database.Database, cut: PublicCut): PublicCourse[] {
  const query = cutQuery(cut);
  if (!query) return [];
  return sqlite.prepare(`SELECT course.id, course.code, area.name AS area, program.name AS program,
      program.abbreviation AS programAbbreviation,
      course.study_start AS studyStart, course.study_end AS studyEnd, program.semesters,
      CAST(substr(course.study_start, 1, 4) AS INTEGER) AS year
    FROM courses course JOIN programs program ON program.id = course.program_id
    JOIN areas area ON area.id = program.area_id
    WHERE course.published_at IS NOT NULL AND ${query.sql}
    ORDER BY course.code COLLATE NOCASE`).all(...query.parameters) as PublicCourse[];
}

function readDetailForCourses(sqlite: Database.Database, courses: PublicCourse[]) {
  const ids = courses.map((course) => course.id);
  const placeholders = ids.map(() => "?").join(", ");
  const phases = sqlite.prepare(`SELECT course_id AS courseId, semester, phase_type AS type,
      start_date AS startDate, end_date AS endDate FROM course_phases
    WHERE course_id IN (${placeholders}) ORDER BY semester, start_date, end_date`).all(...ids) as CoursePhase[];
  const events = sqlite.prepare(`SELECT id, course_id AS courseId, title, description, category,
      start_date AS startDate, end_date AS endDate, provisional FROM course_events
    WHERE course_id IN (${placeholders}) ORDER BY start_date, title COLLATE NOCASE, id`).all(...ids) as StoredEventRow[];
  return {
    phases,
    events: events.map(({ courseId, provisional, ...event }) => ({ ...event, provisional: Boolean(provisional), courseIds: [courseId] })),
  };
}

export function readPublicCut(sqlite: Database.Database, cut: PublicCut): PublicCutDetail | null {
  const courses = readCoursesForCut(sqlite, cut);
  if (!courses.length) return null;
  const canonicalCut = cut.kind === "course"
    ? { kind: "course" as const, code: courses[0].code }
    : cut.kind === "program"
      ? { kind: "program" as const, year: cut.year, abbreviation: courses[0].programAbbreviation, name: courses[0].program }
      : cut;
  return { cut: canonicalCut, courses, ...readDetailForCourses(sqlite, courses) };
}
