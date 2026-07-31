import { describe, expect, it } from "vitest";

import { inclusiveDays, plusDays, weekdayIndex } from "@/lib/domain/calendar-day";
import { courseCodeYear, generateCoursePlan, plannedPhaseCount, proposedStudyEnd, proposedStudyStart } from "@/lib/domain/generated-course-plan";

const today = "2026-07-31";

describe("courseCodeYear", () => {
  it("reads a four-digit and a two-digit year out of a course code", () => {
    expect(courseCodeYear("TIF2025A", today)).toBe(2025);
    expect(courseCodeYear("TIF26A", today)).toBe(2026);
    expect(courseCodeYear("WWI25", today)).toBe(2025);
  });

  it("ignores a number that cannot be the year of a plannable course", () => {
    expect(courseCodeYear("Gruppe 99", today)).toBeUndefined();
    expect(courseCodeYear("TIF", today)).toBeUndefined();
  });
});

describe("proposedStudyStart", () => {
  it("takes the first of October of the year the course code names", () => {
    expect(proposedStudyStart("TIF26A", today)).toBe("2026-10-01");
    expect(proposedStudyStart("TIF2029B", today)).toBe("2029-10-01");
  });

  it("falls back to the next first of October when the code names no year", () => {
    expect(proposedStudyStart("TIF-A", "2026-07-31")).toBe("2026-10-01");
    expect(proposedStudyStart("TIF-A", "2026-10-01")).toBe("2026-10-01");
    expect(proposedStudyStart("TIF-A", "2026-10-02")).toBe("2027-10-01");
  });
});

describe("proposedStudyEnd", () => {
  it("ends six semesters on 30 September and seven on 31 March", () => {
    expect(proposedStudyEnd("2025-10-01", 6)).toBe("2028-09-30");
    expect(proposedStudyEnd("2025-10-01", 7)).toBe("2029-03-31");
  });
});

const period = { studyStart: "2025-10-01", studyEnd: "2028-09-30", semesters: 6 } as const;

describe("generateCoursePlan", () => {
  it("covers the study period completely, without gap and without overlap", () => {
    const phases = generateCoursePlan({ ...period, startType: "THEORY" });
    expect(phases).toHaveLength(plannedPhaseCount(6));
    expect(phases[0].startDate).toBe(period.studyStart);
    expect(phases[phases.length - 1].endDate).toBe(period.studyEnd);
    for (let index = 1; index < phases.length; index++) {
      expect(phases[index].startDate).toBe(plusDays(phases[index - 1].endDate, 1));
    }
  });

  it("alternates the phase types from the chosen starting phase and assigns two phases per semester", () => {
    const phases = generateCoursePlan({ ...period, startType: "PRACTICE" });
    expect(phases.map((phase) => phase.type).slice(0, 4)).toEqual(["PRACTICE", "THEORY", "PRACTICE", "THEORY"]);
    expect(phases.map((phase) => phase.semester)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it("ends every phase on a Sunday and starts the next on a Monday, except at study start and study end", () => {
    const phases = generateCoursePlan({ ...period, startType: "THEORY" });
    for (const phase of phases.slice(0, -1)) expect(weekdayIndex(phase.endDate)).toBe(0);
    for (const phase of phases.slice(1)) expect(weekdayIndex(phase.startDate)).toBe(1);
  });

  it("ends a theory phase before Christmas and lets a practice phase run past Epiphany", () => {
    const theoryFirst = generateCoursePlan({ ...period, startType: "THEORY" });
    // The theory phase at the turn of 2025/26 ends on the Sunday before 24 December.
    expect(theoryFirst[0]).toMatchObject({ type: "THEORY", endDate: "2025-12-21" });
    const practiceFirst = generateCoursePlan({ ...period, startType: "PRACTICE" });
    // The practice phase in its place runs on to the Sunday on or after 6 January.
    expect(practiceFirst[0]).toMatchObject({ type: "PRACTICE", endDate: "2026-01-11" });
  });

  it("divides a study period that no longer fits the quarters into equal parts", () => {
    const phases = generateCoursePlan({ studyStart: "2025-10-06", studyEnd: "2028-08-31", semesters: 6, startType: "THEORY" });
    expect(phases[0].startDate).toBe("2025-10-06");
    expect(phases[phases.length - 1].endDate).toBe("2028-08-31");
    const lengths = phases.map((phase) => inclusiveDays(phase.startDate, phase.endDate));
    expect(Math.min(...lengths)).toBeGreaterThan(60);
  });

  it("yields no progression for a study period too short for two phases per semester", () => {
    expect(generateCoursePlan({ studyStart: "2025-10-01", studyEnd: "2025-10-05", semesters: 6, startType: "THEORY" })).toEqual([]);
  });
});
