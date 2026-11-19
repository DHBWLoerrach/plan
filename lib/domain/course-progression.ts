import { inclusiveDays, plusDays } from "@/lib/domain/calendar-day";
import type { CourseEvent, CoursePhase } from "@/lib/domain/publication";

/**
 * How one phase meets the one that follows it in the course. Two phases that adjoin share one fact — the day the
 * course changes over — and that day is what gets moved when a plan is corrected, rather than the end of one phase
 * and the start of the next as two separate entries. Where they do not adjoin there is no such day, and the list says
 * what is there instead: days nobody planned, or days planned twice.
 */
export type PhaseJunction =
  | { kind: "change"; date: string }
  | { kind: "gap"; startDate: string; endDate: string; days: number }
  | { kind: "overlap"; startDate: string; endDate: string; days: number };

export interface ProgressionPhase<TPhase extends CoursePhase, TEvent extends CourseEvent> {
  phase: TPhase;
  /** The dates beginning within this phase, in chronological order. */
  events: TEvent[];
  /** How this phase meets the one that follows it in time, across semesters as well. The last phase has none. */
  junction: PhaseJunction | null;
  /** The phase that follows, which a change of the junction writes to together with this one. */
  next: TPhase | null;
}

export interface ProgressionSemester<TPhase extends CoursePhase, TEvent extends CourseEvent> {
  semester: number;
  phases: ProgressionPhase<TPhase, TEvent>[];
}

export interface CourseProgression<TPhase extends CoursePhase, TEvent extends CourseEvent> {
  /** Every semester of the study program, also one without a phase, followed by any semester only a stored phase names. */
  semesters: ProgressionSemester<TPhase, TEvent>[];
  /** Dates that begin in no phase of the course: before the first, after the last, or in days nobody planned. */
  unplacedEvents: TEvent[];
}

function junctionBetween(earlier: CoursePhase, later: CoursePhase): PhaseJunction {
  const expected = plusDays(earlier.endDate, 1);
  if (later.startDate === expected) return { kind: "change", date: later.startDate };
  if (later.startDate > expected) {
    const endDate = plusDays(later.startDate, -1);
    return { kind: "gap", startDate: expected, endDate, days: inclusiveDays(expected, endDate) };
  }
  const endDate = earlier.endDate < later.endDate ? earlier.endDate : later.endDate;
  return { kind: "overlap", startDate: later.startDate, endDate, days: inclusiveDays(later.startDate, endDate) };
}

/**
 * The plan of one course as it is read from start to end: its semesters, in each of them its phases, in each phase the
 * dates that begin there, and between two phases the day the course changes over. One order for everything a course
 * has planned, so a date is seen in the phase it falls into instead of being looked up in a second list.
 *
 * A date belongs to the first phase covering its start, the rule the semester of a date is derived by as well.
 */
export function buildCourseProgression<TPhase extends CoursePhase, TEvent extends CourseEvent>(
  course: { id: string; semesters: number }, phases: TPhase[], events: TEvent[],
): CourseProgression<TPhase, TEvent> {
  const own = phases.filter((phase) => phase.courseId === course.id)
    .toSorted((left, right) => left.semester - right.semester || left.startDate.localeCompare(right.startDate) || left.endDate.localeCompare(right.endDate));
  /* What follows a phase is decided by the calendar alone. The semester number only groups the list: an unpublished
     plan may number its semesters against their order in time, and asking the group order for the neighbour would
     then report two adjoining phases as lying months on top of each other. */
  const chronological = own.toSorted((left, right) => left.startDate.localeCompare(right.startDate) || left.endDate.localeCompare(right.endDate));
  const ownEvents = events.filter((event) => event.courseIds.includes(course.id))
    .toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  const placed = new Map<TPhase, TEvent[]>();
  const unplacedEvents: TEvent[] = [];
  for (const event of ownEvents) {
    const phase = own.find((candidate) => candidate.startDate <= event.startDate && candidate.endDate >= event.startDate);
    if (phase) placed.set(phase, [...(placed.get(phase) ?? []), event]); else unplacedEvents.push(event);
  }
  const semesterNumbers = [...new Set([...Array.from({ length: course.semesters }, (_, index) => index + 1), ...own.map((phase) => phase.semester)])]
    .toSorted((left, right) => left - right);
  return {
    semesters: semesterNumbers.map((semester) => ({
      semester,
      phases: own.filter((phase) => phase.semester === semester).map((phase) => {
        const next = chronological[chronological.indexOf(phase) + 1] ?? null;
        return { phase, events: placed.get(phase) ?? [], junction: next ? junctionBetween(phase, next) : null, next };
      }),
    })),
    unplacedEvents,
  };
}
