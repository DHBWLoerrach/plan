import { describe, expect, it } from "vitest";

import {
  buildSemesterMatrix,
  deriveEventSemester,
  getPublicationState,
  validatePublication,
  type DraftCourse,
  type DraftPhase,
} from "@/lib/domain/publication";

const courses: DraftCourse[] = [
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

const completePhases: DraftPhase[] = [
  { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
  { courseId: "course-a", semester: 2, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
  { courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2026-10-01", endDate: "2026-11-30" },
  { courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-12-01", endDate: "2026-12-31" },
  { courseId: "course-b", semester: 2, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
];

describe("validatePublication", () => {
  it("accepts a continuous, complete course history", () => {
    expect(validatePublication({ courses, phases: completePhases, events: [] })).toEqual([]);
  });

  it("rejects gaps in a course history and names the semester and field to correct", () => {
    const phases = completePhases.map((phase) =>
      phase.courseId === "course-a" && phase.semester === 2
        ? { ...phase, startDate: "2027-01-02" }
        : phase,
    );

    expect(validatePublication({ courses, phases, events: [] })).toContainEqual(
      expect.objectContaining({ courseId: "course-a", code: "coverage-gap", semester: 2, field: "startDate" }),
    );
  });

  it("names the semester of a course phase that is missing entirely", () => {
    const phases = completePhases.filter((phase) => !(phase.courseId === "course-a" && phase.semester === 2));

    expect(validatePublication({ courses, phases, events: [] })).toContainEqual(
      expect.objectContaining({ courseId: "course-a", code: "semester-missing", semester: 2, field: null }),
    );
  });

  it("rejects an event that falls outside the affected course", () => {
    expect(
      validatePublication({
        courses,
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
            courseIds: ["course-a"],
          },
        ],
      }),
    ).toContainEqual(expect.objectContaining({ eventId: "event-1", courseId: "course-a", code: "event-outside-study-period", semester: null, field: "startDate" }));
  });

  it("names every affected course separately, because study period and semester are decided per course", () => {
    const issues = validatePublication({
      courses,
      phases: completePhases,
      events: [{ id: "event-1", title: "Prüfung", description: null, category: "EXAM", startDate: "2027-04-01", endDate: null, provisional: false, courseIds: ["course-a", "course-b"] }],
    });

    expect(issues.map((issue) => issue.courseId)).toEqual(["course-a", "course-b"]);
    expect(new Set(issues.map((issue) => issue.message)).size).toBe(2);
  });

  it("names the end date of an event that reaches beyond the study period", () => {
    expect(
      validatePublication({
        courses,
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
            courseIds: ["course-a"],
          },
        ],
      }),
    ).toContainEqual(expect.objectContaining({ eventId: "event-1", code: "event-outside-study-period", field: "endDate" }));
  });

  it("rejects a semester that is split by a later semester", () => {
    const phases: DraftPhase[] = [
      { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-10-31" },
      { courseId: "course-a", semester: 2, type: "PRACTICE", startDate: "2026-11-01", endDate: "2026-11-30" },
      { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-12-01", endDate: "2027-03-31" },
    ];

    expect(validatePublication({ courses: [courses[0]], phases, events: [] })).toContainEqual(
      expect.objectContaining({ courseId: "course-a", code: "semester-not-monotonic" }),
    );
  });

  it("rejects an event without an affected course", () => {
    expect(
      validatePublication({
        courses,
        phases: completePhases,
        events: [{ id: "event-1", title: "Prüfung", description: null, category: "EXAM", startDate: "2027-03-30", endDate: null, provisional: false, courseIds: [] }],
      }),
    ).toContainEqual(expect.objectContaining({ eventId: "event-1", code: "event-without-course", field: "courseIds" }));
  });

  it("points at the start date of an event whose semester no course phase covers", () => {
    const phases = completePhases.filter((phase) => !(phase.courseId === "course-a" && phase.semester === 2));

    expect(
      validatePublication({
        courses: [courses[0]],
        phases,
        events: [{ id: "event-1", title: "Prüfung", description: null, category: "EXAM", startDate: "2027-02-10", endDate: null, provisional: false, courseIds: ["course-a"] }],
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

  it("reports no semester while the draft has no phase covering the start day", () => {
    expect(deriveEventSemester(completePhases, "course-a", "2027-12-01")).toBeNull();
    expect(deriveEventSemester([], "course-a", "2026-10-05")).toBeNull();
  });
});

describe("getPublicationState", () => {
  it("distinguishes never published, published and withdrawn plans", () => {
    expect(getPublicationState(false, false)).toBe("never-published");
    expect(getPublicationState(true, true)).toBe("published");
    expect(getPublicationState(true, false)).toBe("withdrawn");
  });
});
