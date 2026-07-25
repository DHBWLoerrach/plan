import { describe, expect, it } from "vitest";

import { nextPhaseDefaults } from "@/lib/domain/phase-sequence";
import type { PlanPhase } from "@/lib/domain/publication";

const courses = [
  { id: "course-a", code: "TIF26A" },
  { id: "course-b", code: "TIF26B" },
];

const phases: PlanPhase[] = [
  { id: "p1", code: "TIF26A", courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
  { id: "p2", code: "TIF26A", courseId: "course-a", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
  { id: "p3", code: "TIF26B", courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
  { id: "p4", code: "TIF26B", courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
];

describe("nextPhaseDefaults", () => {
  it("continues the day after the latest phase and flips the phase type", () => {
    expect(nextPhaseDefaults({ phases, courses, semester: 1 })).toEqual({
      courseIds: ["course-a", "course-b"],
      semester: "1",
      type: "THEORY",
      startDate: "2027-04-01",
      endDate: "",
      ambiguousPredecessors: [],
    });
  });

  it("flips practice back to theory", () => {
    const theoryLast: PlanPhase[] = [phases[0], phases[2]];

    expect(nextPhaseDefaults({ phases: theoryLast, courses, semester: 1 })).toMatchObject({
      type: "PRACTICE",
      startDate: "2027-01-01",
    });
  });

  it("takes the predecessor from an earlier semester when the opened one is still empty", () => {
    expect(nextPhaseDefaults({ phases, courses, semester: 2 })).toMatchObject({
      semester: "2",
      type: "THEORY",
      startDate: "2027-04-01",
    });
  });

  it("prefers a predecessor inside the opened semester over one before it", () => {
    const withSecondSemester: PlanPhase[] = [
      ...phases,
      { id: "p5", code: "TIF26A", courseId: "course-a", semester: 2, type: "THEORY", startDate: "2027-04-01", endDate: "2027-06-30" },
      { id: "p6", code: "TIF26B", courseId: "course-b", semester: 2, type: "THEORY", startDate: "2027-04-01", endDate: "2027-06-30" },
    ];

    expect(nextPhaseDefaults({ phases: withSecondSemester, courses, semester: 2 })).toMatchObject({
      type: "PRACTICE",
      startDate: "2027-07-01",
    });
  });

  it("ignores phases of a later semester", () => {
    const withThirdSemester: PlanPhase[] = [
      ...phases,
      { id: "p7", code: "TIF26A", courseId: "course-a", semester: 3, type: "THEORY", startDate: "2028-04-01", endDate: "2028-06-30" },
      { id: "p8", code: "TIF26B", courseId: "course-b", semester: 3, type: "THEORY", startDate: "2028-04-01", endDate: "2028-06-30" },
    ];

    expect(nextPhaseDefaults({ phases: withThirdSemester, courses, semester: 1 })).toMatchObject({
      startDate: "2027-04-01",
    });
  });

  it("leaves the defaults empty when the selected courses end on different days", () => {
    const diverging: PlanPhase[] = [
      phases[0],
      { id: "p9", code: "TIF26B", courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-01-31" },
    ];

    expect(nextPhaseDefaults({ phases: diverging, courses, semester: 1 })).toEqual({
      courseIds: ["course-a", "course-b"],
      semester: "1",
      type: "",
      startDate: "",
      endDate: "",
      ambiguousPredecessors: [
        { code: "TIF26A", endDate: "2026-12-31" },
        { code: "TIF26B", endDate: "2027-01-31" },
      ],
    });
  });

  it("leaves the defaults empty when the selected courses end on different phase types", () => {
    const diverging: PlanPhase[] = [
      phases[0],
      { id: "p10", code: "TIF26B", courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2026-10-01", endDate: "2026-12-31" },
    ];

    expect(nextPhaseDefaults({ phases: diverging, courses, semester: 1 })).toMatchObject({
      type: "",
      startDate: "",
      ambiguousPredecessors: [
        { code: "TIF26A", endDate: "2026-12-31" },
        { code: "TIF26B", endDate: "2026-12-31" },
      ],
    });
  });

  it("reports an empty end date for a selected course without any phase yet", () => {
    expect(nextPhaseDefaults({ phases: [phases[0]], courses, semester: 1 })).toMatchObject({
      startDate: "",
      ambiguousPredecessors: [
        { code: "TIF26A", endDate: "2026-12-31" },
        { code: "TIF26B", endDate: "" },
      ],
    });
  });

  it("returns empty defaults without a hint when no course has a phase yet", () => {
    expect(nextPhaseDefaults({ phases: [], courses, semester: 1 })).toEqual({
      courseIds: ["course-a", "course-b"],
      semester: "1",
      type: "",
      startDate: "",
      endDate: "",
      ambiguousPredecessors: [],
    });
  });

  it("works for a single selected course", () => {
    expect(nextPhaseDefaults({ phases, courses: [courses[0]], semester: 1 })).toMatchObject({
      courseIds: ["course-a"],
      type: "THEORY",
      startDate: "2027-04-01",
    });
  });
});
