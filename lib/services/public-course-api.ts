import type Database from "better-sqlite3";

import { normalizeCodePrefix } from "@/lib/domain/course-code";
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
 * than current courses, so an unpublished edit never changes the API. Snapshot codes are compared in JavaScript
 * because SQLite's NOCASE collation does not cover the German Unicode normalisation strategy.
 */
export function readPublicCourseBlockPlan(sqlite: Database.Database, courseCode: string): PublicCourseBlockPlanResult {
  const normalizedCode = normalizeCodePrefix(courseCode);
  if (!normalizedCode) return { kind: "not-found" };

  const courses = sqlite
    .prepare(`SELECT snapshot.id, snapshot.code, snapshot.program_name AS program, snapshot.program_abbreviation AS programAbbreviation,
        snapshot.study_start AS studyStart, snapshot.study_end AS studyEnd, snapshot.semesters
      FROM published_course_snapshots snapshot
      JOIN published_versions version ON version.id = snapshot.version_id`)
    .all() as PublishedCourseRow[];
  const matches = courses.filter((course) => normalizeCodePrefix(course.code) === normalizedCode);
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
