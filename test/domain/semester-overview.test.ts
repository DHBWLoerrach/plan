import { describe, expect, it } from "vitest";

import type { DraftPhase } from "@/lib/domain/publication";
import { semesterOverview } from "@/lib/domain/semester-overview";

const courses = [
  { id: "course-a", code: "TIF26A" },
  { id: "course-b", code: "TIF26B" },
];

const phases: DraftPhase[] = [
  { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
  { courseId: "course-a", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
  { courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
  { courseId: "course-a", semester: 2, type: "THEORY", startDate: "2027-04-01", endDate: "2027-09-30" },
];

describe("semesterOverview", () => {
  it("counts the phases of every semester and names the courses still without one", () => {
    expect(semesterOverview(courses, phases, 3)).toEqual([
      { semester: 1, phaseCount: 3, codesWithoutPhase: [], codesWithOverlap: [] },
      { semester: 2, phaseCount: 1, codesWithoutPhase: ["TIF26B"], codesWithOverlap: [] },
      { semester: 3, phaseCount: 0, codesWithoutPhase: ["TIF26A", "TIF26B"], codesWithOverlap: [] },
    ]);
  });

  it("names a course whose phases overlap within the semester", () => {
    const overlapping: DraftPhase[] = [
      ...phases,
      { courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-04-30" },
    ];

    expect(semesterOverview(courses, overlapping, 1)).toEqual([
      { semester: 1, phaseCount: 4, codesWithoutPhase: [], codesWithOverlap: ["TIF26B"] },
    ]);
  });

  it("accepts phases of one course that follow one another directly", () => {
    expect(semesterOverview(courses, phases, 1)[0].codesWithOverlap).toEqual([]);
  });
});
