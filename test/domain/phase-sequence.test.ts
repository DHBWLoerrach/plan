import { describe, expect, it } from "vitest";

import {
  nextPhaseDefaults,
  phaseGapsForSemester,
  semesterContext,
  suggestedPhaseTypeForGap,
} from "@/lib/domain/phase-sequence";
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

const spanning: PlanPhase[] = [
  { id: "s1", code: "TIF26A", courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
  { id: "s2", code: "TIF26B", courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
  { id: "s3", code: "TIF26A", courseId: "course-a", semester: 2, type: "PRACTICE", startDate: "2027-04-01", endDate: "2027-06-19" },
  { id: "s4", code: "TIF26B", courseId: "course-b", semester: 2, type: "PRACTICE", startDate: "2027-04-01", endDate: "2027-06-19" },
  { id: "s5", code: "TIF26A", courseId: "course-a", semester: 3, type: "THEORY", startDate: "2027-09-14", endDate: "2027-12-31" },
  { id: "s6", code: "TIF26B", courseId: "course-b", semester: 3, type: "THEORY", startDate: "2027-09-14", endDate: "2027-12-31" },
];

describe("semesterContext", () => {
  it("names the last phase before and the first phase after the opened semester", () => {
    const context = semesterContext({ courses, phases: spanning, semester: 2 });

    expect(context.before).toEqual([
      { code: "TIF26A", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
      { code: "TIF26B", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
    ]);
    expect(context.after).toEqual([
      { code: "TIF26A", semester: 3, type: "THEORY", startDate: "2027-09-14", endDate: "2027-12-31" },
      { code: "TIF26B", semester: 3, type: "THEORY", startDate: "2027-09-14", endDate: "2027-12-31" },
    ]);
  });

  it("has no predecessor in the first semester", () => {
    const context = semesterContext({ courses, phases: spanning, semester: 1 });

    expect(context.before).toEqual([]);
    expect(context.after).toHaveLength(2);
  });

  it("has no successor in the last planned semester", () => {
    const context = semesterContext({ courses, phases: spanning, semester: 3 });

    expect(context.after).toEqual([]);
    expect(context.before).toHaveLength(2);
  });

  it("keeps courses apart whose phases run on different days", () => {
    const diverging: PlanPhase[] = [
      spanning[0],
      { id: "s8", code: "TIF26B", courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-02-28" },
      spanning[4],
    ];

    expect(semesterContext({ courses, phases: diverging, semester: 2 }).before).toEqual([
      { code: "TIF26A", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
      { code: "TIF26B", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-02-28" },
    ]);
  });

  it("returns empty context for a draft without any phase", () => {
    expect(semesterContext({ courses, phases: [], semester: 1 })).toEqual({ before: [], after: [] });
  });
});

describe("phaseGapsForSemester", () => {
  const course = { ...courses[0], studyStart: "2026-10-01", studyEnd: "2029-09-30" };
  const before = { code: "TIF26A", semester: 1, type: "THEORY" as const, startDate: "2026-10-01", endDate: "2027-03-31" };
  const after = { code: "TIF26A", semester: 3, type: "THEORY" as const, startDate: "2027-09-14", endDate: "2027-12-31" };

  it("returns one bounded gap for an empty semester between two phases", () => {
    expect(phaseGapsForSemester({ course, phases: [spanning[0], spanning[4]], semester: 2, semesters: 6, before, after })).toEqual([
      {
        from: "2027-04-01",
        to: "2027-09-13",
        days: 166,
        predecessor: before,
        successor: after,
      },
    ]);
  });

  it("returns one open gap for an empty semester without a known successor", () => {
    expect(phaseGapsForSemester({ course, phases: [spanning[0]], semester: 2, semesters: 6, before })).toEqual([
      {
        from: "2027-04-01",
        predecessor: before,
      },
    ]);
  });

  it("uses the study end as the single boundary in an empty final semester", () => {
    expect(phaseGapsForSemester({ course, phases: [spanning[0]], semester: 6, semesters: 6, before })).toEqual([
      {
        from: "2027-04-01",
        to: "2029-09-30",
        days: 914,
        predecessor: before,
      },
    ]);
  });

  it("finds gaps before, between, and after phases without duplicating them", () => {
    const current: PlanPhase[] = [
      { id: "g1", code: "TIF26A", courseId: "course-a", semester: 2, type: "PRACTICE", startDate: "2027-04-03", endDate: "2027-04-30" },
      { id: "g2", code: "TIF26A", courseId: "course-a", semester: 2, type: "THEORY", startDate: "2027-05-03", endDate: "2027-06-30" },
    ];

    expect(phaseGapsForSemester({ course, phases: current, semester: 2, semesters: 6, before, after })).toMatchObject([
      { from: "2027-04-01", to: "2027-04-02", days: 2 },
      { from: "2027-05-01", to: "2027-05-02", days: 2 },
      { from: "2027-07-01", to: "2027-09-13", days: 75 },
    ]);
  });

  it("returns no gap when predecessor and successor are directly adjacent", () => {
    const adjacentAfter = { ...after, startDate: "2027-04-01" };

    expect(phaseGapsForSemester({
      course,
      phases: [spanning[0]],
      semester: 2,
      semesters: 6,
      before,
      after: adjacentAfter,
    })).toEqual([]);
  });

  it("considers the successor when suggesting the phase type for a bounded gap", () => {
    expect(suggestedPhaseTypeForGap({
      predecessor: { type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
      successor: { type: "PRACTICE", startDate: "2027-09-14", endDate: "2027-12-31" },
    })).toBe("THEORY");
  });
});
