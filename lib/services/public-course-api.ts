import type Database from "better-sqlite3";

import { normalizeCourseCode } from "@/lib/domain/course-code";
import type { PhaseType } from "@/lib/domain/phase-type";

export interface PublicCourseBlockPlan {
  course: {
    code: string;
    program: { name: string; abbreviation: string };
    studyPeriod: { startDate: string; endDate: string };
  };
  semesters: { number: number; phases: { type: PhaseType; startDate: string; endDate: string }[] }[];
}
export type PublicCourseBlockPlanResult = { kind: "found"; data: PublicCourseBlockPlan } | { kind: "not-found" };

type CourseRow = {
  id: string;
  code: string;
  program: string;
  programAbbreviation: string;
  studyStart: string;
  studyEnd: string;
  semesters: number;
};
type PhaseRow = { semester: number; type: PhaseType; startDate: string; endDate: string };

/** The public API exposes the current rows of a course exactly while its publication timestamp is set. */
export function readPublicCourseBlockPlan(sqlite: Database.Database, courseCode: string): PublicCourseBlockPlanResult {
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!normalizedCode) return { kind: "not-found" };
  const course = sqlite.prepare(`SELECT course.id, course.code, program.name AS program,
      program.abbreviation AS programAbbreviation, course.study_start AS studyStart,
      course.study_end AS studyEnd, program.semesters
    FROM courses course JOIN programs program ON program.id = course.program_id
    WHERE course.normalized_code = ? AND course.published_at IS NOT NULL`).get(normalizedCode) as CourseRow | undefined;
  if (!course) return { kind: "not-found" };
  const phases = sqlite.prepare(`SELECT semester, phase_type AS type, start_date AS startDate, end_date AS endDate
    FROM course_phases WHERE course_id = ? ORDER BY semester, start_date, end_date`).all(course.id) as PhaseRow[];
  return {
    kind: "found",
    data: {
      course: {
        code: course.code,
        program: { name: course.program, abbreviation: course.programAbbreviation },
        studyPeriod: { startDate: course.studyStart, endDate: course.studyEnd },
      },
      semesters: Array.from({ length: course.semesters }, (_, index) => {
        const number = index + 1;
        return { number, phases: phases.filter((phase) => phase.semester === number).map(({ type, startDate, endDate }) => ({ type, startDate, endDate })) };
      }),
    },
  };
}
