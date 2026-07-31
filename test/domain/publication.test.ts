import { describe, expect, it } from "vitest";

import {
  buildSemesterMatrix,
  deriveEventSemester,
  validatePublication,
  type CoursePlan,
  type CoursePhase,
} from "@/lib/domain/publication";

const courses: CoursePlan[] = [
  {
    id: "course-a",
    code: "TIF26A",
    studyStart: "2026-10-01",
    studyEnd: "2027-03-31",
    semesters: 2,
  },
  {
    id: "course-b",
    code: "TIF26B",
    studyStart: "2026-10-01",
    studyEnd: "2027-03-31",
    semesters: 2,
  },
];

const completePhases: CoursePhase[] = [
  { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
  { courseId: "course-a", semester: 2, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
  { courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2026-10-01", endDate: "2026-11-30" },
  { courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-12-01", endDate: "2026-12-31" },
  { courseId: "course-b", semester: 2, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
];

describe("validatePublication", () => {
  it("accepts a continuous, complete course history", () => {
    expect(validatePublication({ course: courses[0], phases: completePhases, events: [] })).toEqual([]);
  });

  it("rejects gaps in a course history and names the semester and field to correct", () => {
    const phases = completePhases.map((phase) =>
      phase.courseId === "course-a" && phase.semester === 2
        ? { ...phase, startDate: "2027-01-02" }
        : phase,
    );

    expect(validatePublication({ course: courses[0], phases, events: [] })).toContainEqual(
      expect.objectContaining({ courseId: "course-a", code: "coverage-gap", semester: 2, field: "startDate" }),
    );
  });

  it("names the semester of a course phase that is missing entirely", () => {
    const phases = completePhases.filter((phase) => !(phase.courseId === "course-a" && phase.semester === 2));

    expect(validatePublication({ course: courses[0], phases, events: [] })).toContainEqual(
      expect.objectContaining({ courseId: "course-a", code: "semester-missing", semester: 2, field: null }),
    );
  });

  it("rejects an event that falls outside the affected course", () => {
    expect(
      validatePublication({
        course: courses[0],
        phases: completePhases,
        events: [
          {
            id: "event-1",
            title: "Prüfung",
            description: null,
            category: "EXAM",
            startDate: "2027-04-01",
            endDate: null,
            provisional: false,
          },
        ],
      }),
    ).toContainEqual(expect.objectContaining({ eventId: "event-1", courseId: "course-a", code: "event-outside-study-period", semester: null, field: "startDate" }));
  });

  it("names the end date of an event that reaches beyond the study period", () => {
    expect(
      validatePublication({
        course: courses[0],
        phases: completePhases,
        events: [
          {
            id: "event-1",
            title: "Projektarbeit",
            description: null,
            category: "SUBMISSION",
            startDate: "2027-03-30",
            endDate: "2027-04-02",
            provisional: false,
          },
        ],
      }),
    ).toContainEqual(expect.objectContaining({ eventId: "event-1", code: "event-outside-study-period", field: "endDate" }));
  });

  it("rejects a semester that is split by a later semester", () => {
    const phases: CoursePhase[] = [
      { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-10-31" },
      { courseId: "course-a", semester: 2, type: "PRACTICE", startDate: "2026-11-01", endDate: "2026-11-30" },
      { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-12-01", endDate: "2027-03-31" },
    ];

    expect(validatePublication({ course: courses[0], phases, events: [] })).toContainEqual(
      expect.objectContaining({ courseId: "course-a", code: "semester-not-monotonic" }),
    );
  });

  it("points at the start date of an event whose semester no course phase covers", () => {
    const phases = completePhases.filter((phase) => !(phase.courseId === "course-a" && phase.semester === 2));

    expect(
      validatePublication({
        course: courses[0],
        phases,
        events: [{ id: "event-1", title: "Prüfung", description: null, category: "EXAM", startDate: "2027-02-10", endDate: null, provisional: false }],
      }),
    ).toContainEqual(expect.objectContaining({ eventId: "event-1", courseId: "course-a", code: "event-semester-not-derivable", semester: null, field: "startDate" }));
  });
});

describe("buildSemesterMatrix", () => {
  it("keeps differing course boundaries visible and uses textual cell values", () => {
    expect(buildSemesterMatrix(courses, completePhases, 1)).toEqual([
      {
        startDate: "2026-10-01",
        endDate: "2026-11-30",
        cells: ["Theorie", "Praxis"],
      },
      {
        startDate: "2026-12-01",
        endDate: "2026-12-31",
        cells: ["Theorie", "Theorie"],
      },
    ]);
  });

  it("merges adjacent intervals into the maximal period in which no cell changes", () => {
    const split: CoursePhase[] = [
      { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-11-30" },
      { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-12-01", endDate: "2026-12-31" },
      { courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
    ];

    expect(buildSemesterMatrix(courses, split, 1)).toEqual([
      { startDate: "2026-10-01", endDate: "2026-12-31", cells: ["Theorie", "Theorie"] },
    ]);
  });

  it("names a period lying outside the semester of a course textually", () => {
    const staggered: CoursePhase[] = [
      { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
      { courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2026-10-01", endDate: "2026-11-30" },
      { courseId: "course-b", semester: 2, type: "THEORY", startDate: "2026-12-01", endDate: "2027-03-31" },
    ];

    expect(buildSemesterMatrix(courses, staggered, 1)).toEqual([
      { startDate: "2026-10-01", endDate: "2026-11-30", cells: ["Theorie", "Praxis"] },
      { startDate: "2026-12-01", endDate: "2026-12-31", cells: ["Theorie", "Nicht in diesem Semester"] },
    ]);
  });

  it("keeps the maximal periods of the courses that a reduced course selection still shows", () => {
    // The public detail view may hide course columns; the rows then follow the visible courses alone
    // (MVP-SPEZIFIKATION.md).
    expect(buildSemesterMatrix([courses[0]], completePhases, 1)).toEqual([
      { startDate: "2026-10-01", endDate: "2026-12-31", cells: ["Theorie"] },
    ]);
  });
});

describe("deriveEventSemester", () => {
  it("derives the semester per course from the phase covering the start day", () => {
    // Course B has two phases in semester 1, so the covering phase decides — not the first phase of the course.
    expect(deriveEventSemester(completePhases, "course-a", "2027-01-05")).toBe(2);
    expect(deriveEventSemester(completePhases, "course-b", "2026-12-15")).toBe(1);
  });

  it("derives the semester of the start day for an event spanning a semester change", () => {
    expect(deriveEventSemester(completePhases, "course-a", "2026-12-28")).toBe(1);
  });

  it("reports no semester while an incomplete course has no phase covering the start day", () => {
    expect(deriveEventSemester(completePhases, "course-a", "2027-12-01")).toBeNull();
    expect(deriveEventSemester([], "course-a", "2026-10-05")).toBeNull();
  });
});
