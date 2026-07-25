import { daysBetween, plusDays } from "@/lib/domain/calendar-day";
import type { PhaseType } from "@/lib/domain/phase-type";
import type { PlanPhase } from "@/lib/domain/publication";

export type NextPhaseDefaults = {
  courseIds: string[];
  semester: string;
  /** Empty when the selected courses do not share one predecessor type. */
  type: string;
  /** Empty when the selected courses do not share one predecessor end date. */
  startDate: string;
  endDate: string;
  /** One entry per selected course when no unambiguous default was possible; an empty end date means no phase yet. */
  ambiguousPredecessors: { code: string; endDate: string }[];
};

const oppositeType: Record<PhaseType, PhaseType> = { THEORY: "PRACTICE", PRACTICE: "THEORY" };

/**
 * The predecessor of a course in the opened semester: its phase with the latest end date among all phases up to and
 * including that semester. Phases of later semesters stay out, so editing an earlier semester of an already planned
 * course still continues where that semester left off.
 */
function predecessor(phases: PlanPhase[], courseId: string, semester: number): PlanPhase | undefined {
  return phases
    .filter((phase) => phase.courseId === courseId && phase.semester <= semester)
    .reduce<PlanPhase | undefined>((latest, phase) => (!latest || phase.endDate > latest.endDate ? phase : latest), undefined);
}

/**
 * The values the create form starts with after a phase was saved. One form serves every selected course, because
 * `createDraftPhases` gives each of them an independent phase with equal details. A default is therefore only offered
 * when it fits every selected course: otherwise the fields stay empty and the differing predecessors are named, since
 * a date that silently holds for just one course is the error that is hardest to find later.
 */
export function nextPhaseDefaults({ phases, courses, semester }: {
  phases: PlanPhase[];
  courses: { id: string; code: string }[];
  semester: number;
}): NextPhaseDefaults {
  const base = { courseIds: courses.map((course) => course.id), semester: String(semester), type: "", startDate: "", endDate: "" };
  const predecessors = courses.map((course) => ({ code: course.code, phase: predecessor(phases, course.id, semester) }));
  const found = predecessors.filter((entry) => entry.phase);
  if (!found.length) return { ...base, ambiguousPredecessors: [] };

  const unanimous = found.length === courses.length
    && new Set(found.map((entry) => entry.phase!.endDate)).size === 1
    && new Set(found.map((entry) => entry.phase!.type)).size === 1;
  if (!unanimous) {
    return {
      ...base,
      ambiguousPredecessors: predecessors.map((entry) => ({ code: entry.code, endDate: entry.phase?.endDate ?? "" })),
    };
  }

  const shared = found[0].phase!;
  return { ...base, type: oppositeType[shared.type], startDate: plusDays(shared.endDate, 1), ambiguousPredecessors: [] };
}

export type PhaseNeighbour = {
  code: string;
  semester: number;
  type: PhaseType;
  startDate: string;
  endDate: string;
};

export type UnplannedSpan = { code: string; from: string; to: string; days: number };

export type SemesterContext = {
  /** Per course the last phase belonging to an earlier semester. */
  before: PhaseNeighbour[];
  /** Per course the first phase belonging to a later semester. */
  after: PhaseNeighbour[];
  /** Per course the span between what is planned so far and the following semester. */
  unplanned: UnplannedSpan[];
};

function neighbour(code: string, phase: PlanPhase): PhaseNeighbour {
  return { code, semester: phase.semester, type: phase.type, startDate: phase.startDate, endDate: phase.endDate };
}

function earliest(phases: PlanPhase[]): PlanPhase | undefined {
  return phases.reduce<PlanPhase | undefined>((first, phase) => (!first || phase.startDate < first.startDate ? phase : first), undefined);
}

/**
 * What borders the opened semester. The editor shows one semester at a time, so planning the next block needs to see
 * where the previous one ended and where an already planned following one begins. The unassigned span is measured
 * from the latest phase up to and including the opened semester, which is what a continuing draft actually has to
 * fill.
 */
export function semesterContext({ courses, phases, semester }: {
  courses: { id: string; code: string }[];
  phases: PlanPhase[];
  semester: number;
}): SemesterContext {
  const context: SemesterContext = { before: [], after: [], unplanned: [] };
  for (const course of courses) {
    const ofCourse = phases.filter((phase) => phase.courseId === course.id);
    const previous = predecessor(ofCourse, course.id, semester - 1);
    const next = earliest(ofCourse.filter((phase) => phase.semester > semester));
    if (previous) context.before.push(neighbour(course.code, previous));
    if (next) context.after.push(neighbour(course.code, next));

    const planned = predecessor(ofCourse, course.id, semester);
    if (!planned || !next) continue;
    const days = daysBetween(planned.endDate, next.startDate);
    if (days > 0) context.unplanned.push({ code: course.code, from: planned.endDate, to: next.startDate, days });
  }
  return context;
}
