import { describe, expect, it } from "vitest";

import type { DraftPhase, PublicationIssue } from "@/lib/domain/publication";
import { semesterOverview, semesterWorkState } from "@/lib/domain/semester-overview";

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
        phasesPerCourse: [{ type: "THEORY", min: 1, max: 1 }, { type: "PRACTICE", min: 0, max: 1 }],
      },
      {
        semester: 2,
        phaseCount: 1,
        codesWithoutPhase: ["TIF26B"],
        phasesPerCourse: [{ type: "THEORY", min: 0, max: 1 }],
      },
      { semester: 3, phaseCount: 0, codesWithoutPhase: ["TIF26A", "TIF26B"], phasesPerCourse: [] },
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
});

describe("semesterWorkState", () => {
  const overview = semesterOverview(courses, phases, 3);

  it("marks an empty semester as not started when no more specific issue is supplied", () => {
    expect(semesterWorkState(overview[2], [])).toEqual({
      kind: "not-started",
      label: "Nicht begonnen",
      issueCount: 0,
    });
  });

  it("keeps an empty semester understandable as not started while retaining its issue count", () => {
    expect(semesterWorkState(overview[2], [{
      code: "semester-missing",
      courseId: "course-a",
      semester: 3,
      field: null,
      message: "Semester 3 fehlt.",
    }])).toEqual({
      kind: "not-started",
      label: "Nicht begonnen",
      issueCount: 1,
    });
  });

  it("uses publication issues as the actionable semester status", () => {
    const issues: PublicationIssue[] = [
      {
        code: "coverage-gap",
        courseId: "course-a",
        semester: 1,
        field: "startDate",
        message: "Der Verlauf enthält eine Lücke.",
      },
      {
        code: "coverage-gap",
        courseId: "course-b",
        semester: 1,
        field: "endDate",
        message: "Der Verlauf endet zu früh.",
      },
      {
        code: "event-semester-not-derivable",
        eventId: "event-1",
        semester: null,
        field: "startDate",
        message: "Für den Termin ist kein Semester ableitbar.",
      },
    ];

    expect(semesterWorkState(overview[0], issues)).toEqual({
      kind: "issues",
      label: "2 offene Punkte",
      issueCount: 2,
    });
  });

  it("marks a populated semester without publication issues as ready", () => {
    expect(semesterWorkState(overview[0], [])).toEqual({
      kind: "ready",
      label: "Bereit",
      issueCount: 0,
    });
  });
});
