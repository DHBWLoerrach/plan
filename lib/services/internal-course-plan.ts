import "server-only";

import type Database from "better-sqlite3";

import type { ComparisonScope } from "@/lib/domain/course-comparison";
import type { CoursePlan, PlanEvent, PlanPhase } from "@/lib/domain/publication";
import { editableAreaIds, markCourse, type AccountScope, type CourseMarking } from "@/lib/services/course-read-access";

export type PlanCourse = CoursePlan & CourseMarking & { areaId: string; areaName: string; program: string; programId: string; updatedAt: string; publishedAt: string | null };
export type CoursePlanData = { course: PlanCourse; scope: ComparisonScope; comparison: PlanCourse[]; phases: PlanPhase[]; events: PlanEvent[] };

type PlanCourseRow = Omit<PlanCourse, keyof CourseMarking>;

const planCourseColumns = `course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd,
  program.semesters, program.id AS programId, program.name AS program, program.area_id AS areaId, area.name AS areaName,
  course.published_at AS publishedAt, course.updated_at AS updatedAt
  FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id`;

function comparisonCourseRows(sqlite: Database.Database, course: PlanCourseRow, scope: ComparisonScope): PlanCourseRow[] {
  const restriction = scope === "program" ? "AND course.program_id = ?" : scope === "area" ? "AND program.area_id = ?" : "";
  const parameters = scope === "program" ? [course.programId] : scope === "area" ? [course.areaId] : [];
  return sqlite.prepare(`SELECT ${planCourseColumns}
    WHERE course.id <> ? AND substr(course.study_start, 1, 4) = substr(?, 1, 4) ${restriction}
    ORDER BY course.code COLLATE NOCASE`).all(course.id, course.studyStart, ...parameters) as PlanCourseRow[];
}

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
    .all(...ids) as (Omit<PlanEvent, "provisional"> & { provisional: number })[];
  return {
    course,
    scope,
    comparison,
    phases,
    events: events.map(({ provisional, ...event }) => ({ ...event, provisional: Boolean(provisional) })),
  };
}
