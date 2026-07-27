import type Database from "better-sqlite3";

import { normalizeCourseCode } from "@/lib/domain/course-code";
import type { PhaseType } from "@/lib/domain/phase-type";

export interface PublicCourseBlockPlan {
  course: {
    code: string;
    program: { name: string; abbreviation: string };
    studyPeriod: { startDate: string; endDate: string };
  };
  semesters: {
    number: number;
    phases: { type: PhaseType; startDate: string; endDate: string }[];
  }[];
}

export type PublicCourseBlockPlanResult =
  | { kind: "found"; data: PublicCourseBlockPlan }
  | { kind: "not-found" }
  | { kind: "ambiguous" };

type PublishedCourseRow = {
  id: string;
  code: string;
  program: string;
  programAbbreviation: string;
  studyStart: string;
  studyEnd: string;
  semesters: number;
};

type PublishedPhaseRow = { semester: number; type: PhaseType; startDate: string; endDate: string };

/**
 * The public, published course plan addressed by its exact course code. This reads the immutable snapshots rather
 * than current courses, so an unpublished edit never changes the API. The stored normalised key lets SQLite find the
 * matching snapshot through its index without first loading every public course into application memory.
 */
export function readPublicCourseBlockPlan(sqlite: Database.Database, courseCode: string): PublicCourseBlockPlanResult {
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!normalizedCode) return { kind: "not-found" };

  const matches = sqlite
    .prepare(`SELECT snapshot.id, snapshot.code, snapshot.program_name AS program, snapshot.program_abbreviation AS programAbbreviation,
        snapshot.study_start AS studyStart, snapshot.study_end AS studyEnd, snapshot.semesters
      FROM published_course_search_keys search_key
      JOIN published_course_snapshots snapshot ON snapshot.id = search_key.course_snapshot_id
      WHERE search_key.normalized_code = ?`)
    .all(normalizedCode) as PublishedCourseRow[];
  if (!matches.length) return { kind: "not-found" };
  if (matches.length > 1) return { kind: "ambiguous" };

  const course = matches[0];
  const phases = sqlite
    .prepare(`SELECT semester, phase_type AS type, start_date AS startDate, end_date AS endDate
      FROM published_phases WHERE course_snapshot_id = ? ORDER BY semester, start_date, end_date`)
    .all(course.id) as PublishedPhaseRow[];
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
        return {
          number,
          phases: phases
            .filter((phase) => phase.semester === number)
            .map(({ type, startDate, endDate }) => ({ type, startDate, endDate })),
        };
      }),
    },
  };
}
