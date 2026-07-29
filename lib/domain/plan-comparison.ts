import type { DraftCourse, DraftEvent, DraftPhase } from "@/lib/domain/publication";

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
  category: DraftEvent["category"];
  startDate: string;
  endDate: string | null;
  provisional: boolean;
  courses: ComparableEventCourse[];
}

function phaseSequenceKey(courseId: string, phases: DraftPhase[]): string {
  return JSON.stringify(phases
    .filter((phase) => phase.courseId === courseId)
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
export function groupComparableCourses(courses: DraftCourse[], phases: DraftPhase[]): ComparableCourseGroup[] {
  const groups = new Map<string, ComparableCourseGroup>();
  for (const course of courses) {
    const key = phaseSequenceKey(course.id, phases);
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
export function normalizeEventTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function eventKey(event: DraftEvent): string {
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
export function groupComparableEvents(events: DraftEvent[]): ComparableEvent[] {
  const groups = new Map<string, ComparableEvent>();
  for (const event of events) {
    const key = eventKey(event);
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
    for (const courseId of event.courseIds) {
      if (!group.courses.some((course) => course.courseId === courseId)) {
        group.courses.push({ courseId, description: event.description });
      }
    }
  }
  return [...groups.values()];
}
