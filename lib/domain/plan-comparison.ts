import type { CoursePlan, CourseEvent, CoursePhase } from "@/lib/domain/publication";

/** Courses that share every phase can use one visual column or one overview lane without sharing any stored data. */
export interface ComparableCourseGroup {
  courses: Array<{ id: string; code: string }>;
}

/** The course-specific description remains attached to its course when otherwise equal events share one row. */
export interface ComparableEventCourse {
  courseId: string;
  description: string | null;
}

/** One row of the public event comparison. Its key is display-only and deliberately carries no identity. */
export interface ComparableEvent {
  title: string;
  category: CourseEvent["category"];
  startDate: string;
  endDate: string | null;
  provisional: boolean;
  courses: ComparableEventCourse[];
}

export function phaseSequenceKey(phases: CoursePhase[]): string {
  return JSON.stringify(phases
    .toSorted((left, right) => (
      left.semester - right.semester
      || left.startDate.localeCompare(right.startDate)
      || left.endDate.localeCompare(right.endDate)
      || left.type.localeCompare(right.type)
    ))
    .map(({ semester, type, startDate, endDate }) => ({ semester, type, startDate, endDate })));
}

/**
 * Groups courses only where their whole phase sequences agree. A single changed phase produces a different key and
 * therefore its own column or lane; the source phases remain independent records.
 */
export function groupComparableCourses(courses: CoursePlan[], phases: CoursePhase[]): ComparableCourseGroup[] {
  const groups = new Map<string, ComparableCourseGroup>();
  for (const course of courses) {
    const key = phaseSequenceKey(phases.filter((phase) => phase.courseId === course.id));
    const group = groups.get(key);
    if (group) {
      group.courses.push({ id: course.id, code: course.code });
    } else {
      groups.set(key, { courses: [{ id: course.id, code: course.code }] });
    }
  }
  return [...groups.values()];
}

/** The text rule that compares event titles in the normalized form used when they are saved. */
function normalizeEventTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

/**
 * What makes two events one row of a comparison. A row carries the same fields as the events it joins, so the row an
 * event went into is found again by asking for the key of either.
 */
export function comparableEventKey(event: Pick<CourseEvent, "category" | "title" | "startDate" | "endDate" | "provisional">): string {
  return JSON.stringify({
    category: event.category,
    title: normalizeEventTitle(event.title),
    startDate: event.startDate,
    endDate: event.endDate,
    provisional: event.provisional,
  });
}

/**
 * Joins only events whose category, normalized title and complete time indication agree. Descriptions intentionally
 * do not enter the key: they remain listed at the course that supplies them.
 */
export function groupComparableEvents(events: CourseEvent[]): ComparableEvent[] {
  const groups = new Map<string, ComparableEvent>();
  for (const event of events) {
    const key = comparableEventKey(event);
    let group = groups.get(key);
    if (!group) {
      group = {
        title: normalizeEventTitle(event.title),
        category: event.category,
        startDate: event.startDate,
        endDate: event.endDate,
        provisional: event.provisional,
        courses: [],
      };
      groups.set(key, group);
    }
    if (!group.courses.some((course) => course.courseId === event.courseId)) {
      group.courses.push({ courseId: event.courseId, description: event.description });
    }
  }
  return [...groups.values()];
}

/** The semesters in which a course beside the edited one runs differently, each with the phases that course has there. */
export interface CourseDeviation {
  courseId: string;
  code: string;
  semesters: Array<{ semester: number; phases: CoursePhase[] }>;
  /** Dates the edited course has and this one lacks, and the other way round. Descriptions do not count, as in a row. */
  eventsOnlyHere: number;
  eventsOnlyThere: number;
}

function semesterKey(courseId: string, phases: CoursePhase[], semester: number): string {
  return phaseSequenceKey(phases.filter((phase) => phase.courseId === courseId && phase.semester === semester));
}

function eventKeys(courseId: string, events: CourseEvent[]): string[] {
  return events.filter((event) => event.courseId === courseId).map(comparableEventKey);
}

/** How many entries of `keys` find no partner in `others`, counting equal entries as often as they occur. */
function unmatched(keys: string[], others: string[]): number {
  const remaining = [...others];
  let count = 0;
  for (const key of keys) {
    const index = remaining.indexOf(key);
    if (index < 0) count += 1; else remaining.splice(index, 1);
  }
  return count;
}

/**
 * What the page of one course says about the courses beside it: not their whole plan again, only where it differs.
 * A course is listed even when nothing differs, with no semesters and zero counts — that it agrees is a statement
 * too, and its absence could not be told from a course that was never compared.
 */
export function describeDeviations(course: CoursePlan, others: CoursePlan[], phases: CoursePhase[], events: CourseEvent[]): CourseDeviation[] {
  const ownEvents = eventKeys(course.id, events);
  return others.map((other) => {
    const semesters = Math.max(course.semesters, other.semesters);
    const theirEvents = eventKeys(other.id, events);
    return {
      courseId: other.id,
      code: other.code,
      semesters: Array.from({ length: semesters }, (_, index) => index + 1)
        .filter((semester) => semesterKey(course.id, phases, semester) !== semesterKey(other.id, phases, semester))
        .map((semester) => ({
          semester,
          phases: phases.filter((phase) => phase.courseId === other.id && phase.semester === semester)
            .toSorted((left, right) => left.startDate.localeCompare(right.startDate)),
        })),
      eventsOnlyHere: unmatched(ownEvents, theirEvents),
      eventsOnlyThere: unmatched(theirEvents, ownEvents),
    };
  });
}
