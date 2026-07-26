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

export type SemesterContext = {
  /** Per course the last phase belonging to an earlier semester. */
  before: PhaseNeighbour[];
  /** Per course the first phase belonging to a later semester. */
  after: PhaseNeighbour[];
};

export type PhaseGapBoundary = Pick<PlanPhase, "type" | "startDate" | "endDate">;

export type PhaseGap = {
  from: string;
  /** Missing for an open gap whose end is not known yet. */
  to?: string;
  /** Missing together with `to`; bounded gaps always carry their inclusive day count. */
  days?: number;
  predecessor?: PhaseGapBoundary;
  successor?: PhaseGapBoundary;
};

/**
 * Equal types at both boundaries allow the opposite type to alternate with both. Different boundary types make that
 * impossible; in that case the suggestion avoids duplicating the already planned successor.
 */
export function suggestedPhaseTypeForGap(gap: Pick<PhaseGap, "predecessor" | "successor">): PhaseType | "" {
  if (!gap.predecessor) return gap.successor ? oppositeType[gap.successor.type] : "";
  if (gap.successor && oppositeType[gap.predecessor.type] === gap.successor.type) {
    return oppositeType[gap.successor.type];
  }
  return oppositeType[gap.predecessor.type];
}

function neighbour(code: string, phase: PlanPhase): PhaseNeighbour {
  return { code, semester: phase.semester, type: phase.type, startDate: phase.startDate, endDate: phase.endDate };
}

function earliest(phases: PlanPhase[]): PlanPhase | undefined {
  return phases.reduce<PlanPhase | undefined>((first, phase) => (!first || phase.startDate < first.startDate ? phase : first), undefined);
}

/**
 * What borders the opened semester. The editor shows one semester at a time, so planning the next block needs to see
 * where the previous one ended and where an already planned following one begins.
 */
export function semesterContext({ courses, phases, semester }: {
  courses: { id: string; code: string }[];
  phases: PlanPhase[];
  semester: number;
}): SemesterContext {
  const context: SemesterContext = { before: [], after: [] };
  for (const course of courses) {
    const ofCourse = phases.filter((phase) => phase.courseId === course.id);
    const previous = predecessor(ofCourse, course.id, semester - 1);
    const next = earliest(ofCourse.filter((phase) => phase.semester > semester));
    if (previous) context.before.push(neighbour(course.code, previous));
    if (next) context.after.push(neighbour(course.code, next));
  }
  return context;
}

function boundedGap(
  from: string,
  to: string,
  predecessor?: PhaseGapBoundary,
  successor?: PhaseGapBoundary,
): PhaseGap | null {
  if (from > to) return null;
  return {
    from,
    to,
    days: daysBetween(plusDays(from, -1), plusDays(to, 1)),
    predecessor,
    successor,
  };
}

/**
 * Every unassigned span shown for one course in the opened semester. Keeping this calculation out of the component
 * guarantees that an empty semester produces one gap only, regardless of whether it has a predecessor, a successor,
 * both, or the study end as its boundary.
 */
export function phaseGapsForSemester({
  course,
  phases,
  semester,
  semesters,
  before,
  after,
}: {
  course: { id: string; studyStart: string; studyEnd: string };
  phases: PlanPhase[];
  semester: number;
  semesters: number;
  before?: PhaseNeighbour;
  after?: PhaseNeighbour;
}): PhaseGap[] {
  const gaps: PhaseGap[] = [];
  const ordered = phases
    .filter((phase) => phase.courseId === course.id && phase.semester === semester)
    .toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  let previous: PhaseGapBoundary | undefined = before;
  let expectedStart = before
    ? plusDays(before.endDate, 1)
    : semester === 1
      ? course.studyStart
      : null;

  for (const phase of ordered) {
    if (expectedStart) {
      const gap = boundedGap(expectedStart, plusDays(phase.startDate, -1), previous, phase);
      if (gap) gaps.push(gap);
    }
    if (!previous || phase.endDate > previous.endDate) {
      previous = phase;
      expectedStart = plusDays(phase.endDate, 1);
    }
  }

  if (!expectedStart) return gaps;
  if (after) {
    const gap = boundedGap(expectedStart, plusDays(after.startDate, -1), previous, after);
    if (gap) gaps.push(gap);
    return gaps;
  }
  if (semester === semesters) {
    const gap = boundedGap(expectedStart, course.studyEnd, previous);
    if (gap) gaps.push(gap);
    return gaps;
  }
  if (expectedStart <= course.studyEnd) gaps.push({ from: expectedStart, predecessor: previous });
  return gaps;
}
