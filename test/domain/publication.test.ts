import { describe, expect, it } from "vitest";

import {
  buildSemesterMatrix,
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

  it("rejects gaps in a course history", () => {
    const phases = completePhases.map((phase) =>
      phase.courseId === "course-a" && phase.semester === 2
        ? { ...phase, startDate: "2027-01-02" }
        : phase,
    );

    expect(validatePublication({ courses, phases, events: [] })).toContainEqual(
      expect.objectContaining({ courseId: "course-a", code: "coverage-gap" }),
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
            category: "EXAM",
            startDate: "2027-04-01",
            endDate: null,
            provisional: false,
            courseIds: ["course-a"],
          },
        ],
      }),
    ).toContainEqual(expect.objectContaining({ eventId: "event-1", code: "event-outside-study-period" }));
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
        events: [{ id: "event-1", title: "Prüfung", category: "EXAM", startDate: "2027-03-30", endDate: null, provisional: false, courseIds: [] }],
      }),
    ).toContainEqual(expect.objectContaining({ eventId: "event-1", code: "event-without-course" }));
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

describe("getPublicationState", () => {
  it("distinguishes never published, published and withdrawn plans", () => {
    expect(getPublicationState(false, false)).toBe("never-published");
    expect(getPublicationState(true, true)).toBe("published");
    expect(getPublicationState(true, false)).toBe("withdrawn");
  });
});
