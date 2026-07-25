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
      {
        semester: 1,
        phaseCount: 3,
        codesWithoutPhase: [],
        codesWithOverlap: [],
        phasesPerCourse: [{ type: "THEORY", min: 1, max: 1 }, { type: "PRACTICE", min: 0, max: 1 }],
      },
      {
        semester: 2,
        phaseCount: 1,
        codesWithoutPhase: ["TIF26B"],
        codesWithOverlap: [],
        phasesPerCourse: [{ type: "THEORY", min: 0, max: 1 }],
      },
      { semester: 3, phaseCount: 0, codesWithoutPhase: ["TIF26A", "TIF26B"], codesWithOverlap: [], phasesPerCourse: [] },
    ]);
  });

  it("names a course whose phases overlap within the semester", () => {
    const overlapping: DraftPhase[] = [
      ...phases,
      { courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-04-30" },
    ];

    expect(semesterOverview(courses, overlapping, 1)).toEqual([
      {
        semester: 1,
        phaseCount: 4,
        codesWithoutPhase: [],
        codesWithOverlap: ["TIF26B"],
        phasesPerCourse: [{ type: "THEORY", min: 1, max: 1 }, { type: "PRACTICE", min: 1, max: 1 }],
      },
    ]);
  });

  it("spreads a phase type that every course has equally often into one number", () => {
    const even: DraftPhase[] = [
      { courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
      { courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
      { courseId: "course-a", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
      { courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
    ];

    expect(semesterOverview(courses, even, 1)[0].phasesPerCourse).toEqual([
      { type: "THEORY", min: 1, max: 1 },
      { type: "PRACTICE", min: 1, max: 1 },
    ]);
  });

  it("keeps the phase types in their canonical order and drops the ones nobody has", () => {
    const practiceOnly: DraftPhase[] = [
      { courseId: "course-a", semester: 1, type: "PRACTICE", startDate: "2026-10-01", endDate: "2026-12-31" },
      { courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2026-10-01", endDate: "2026-12-31" },
    ];

    expect(semesterOverview(courses, practiceOnly, 1)[0].phasesPerCourse).toEqual([
      { type: "PRACTICE", min: 1, max: 1 },
    ]);
  });

  it("reports no spread at all for a block plan without courses", () => {
    expect(semesterOverview([], [], 1)[0].phasesPerCourse).toEqual([]);
  });

  it("accepts phases of one course that follow one another directly", () => {
    expect(semesterOverview(courses, phases, 1)[0].codesWithOverlap).toEqual([]);
  });
});
