import { describe, expect, it } from "vitest";

import { groupComparableCourses, groupComparableEvents } from "@/lib/domain/plan-comparison";
import type { CoursePlan, CourseEvent, CoursePhase } from "@/lib/domain/publication";

const courses: CoursePlan[] = [
  { id: "course-a", code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 2 },
  { id: "course-b", code: "TIF26B", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 2 },
  { id: "course-c", code: "WWI26A", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 2 },
];

function phases(courseId: string): CoursePhase[] {
  return [
    { courseId, semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-02-28" },
    { courseId, semester: 2, type: "PRACTICE", startDate: "2027-03-01", endDate: "2027-09-30" },
  ];
}

describe("groupComparableCourses", () => {
  it("puts courses with an equal complete phase sequence into one group", () => {
    expect(groupComparableCourses(courses, [...phases("course-a"), ...phases("course-b"), ...phases("course-c").map((phase) => ({ ...phase, type: "THEORY" as const }))]))
      .toEqual([
        { courses: [{ id: "course-a", code: "TIF26A" }, { id: "course-b", code: "TIF26B" }] },
        { courses: [{ id: "course-c", code: "WWI26A" }] },
      ]);
  });

  it("separates courses when a phase differs in semester, type or period", () => {
    const altered = phases("course-b").map((phase) => phase.semester === 2 ? { ...phase, startDate: "2027-03-02" } : phase);

    expect(groupComparableCourses(courses.slice(0, 2), [...phases("course-a"), ...altered]))
      .toEqual([
        { courses: [{ id: "course-a", code: "TIF26A" }] },
        { courses: [{ id: "course-b", code: "TIF26B" }] },
      ]);
  });
});

function event(id: string, courseId: string, overrides: Partial<CourseEvent> = {}): CourseEvent {
  return {
    id,
    title: "  Klausur   Algorithmen ",
    description: null,
    category: "EXAM",
    startDate: "2027-03-15",
    endDate: null,
    provisional: false,
    courseIds: [courseId],
    ...overrides,
  };
}

describe("groupComparableEvents", () => {
  it("groups equal event details by normalized title while keeping descriptions per course", () => {
    expect(groupComparableEvents([
      event("event-a", "course-a", { description: "Raum A" }),
      event("event-b", "course-b", { title: "Klausur Algorithmen", description: "Raum B" }),
    ])).toEqual([{
      title: "Klausur Algorithmen",
      category: "EXAM",
      startDate: "2027-03-15",
      endDate: null,
      provisional: false,
      courses: [
        { courseId: "course-a", description: "Raum A" },
        { courseId: "course-b", description: "Raum B" },
      ],
    }]);
  });

  it("separates events whose category, title, period or provisional state differs, even on the same day", () => {
    expect(groupComparableEvents([
      event("event-a", "course-a"),
      event("event-b", "course-b", { category: "PRESENTATION" }),
      event("event-c", "course-c", { provisional: true }),
      event("event-d", "course-d", { endDate: "2027-03-16" }),
      event("event-e", "course-e", { title: "Mündliche Prüfung" }),
    ])).toHaveLength(5);
  });
});
