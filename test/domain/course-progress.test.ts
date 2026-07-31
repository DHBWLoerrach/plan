import { describe, expect, it } from "vitest";

import { courseStanding, type StandingPhase } from "@/lib/domain/course-progress";

const course = { studyStart: "2026-10-01", studyEnd: "2029-09-30" };

/** Two semesters of the seeded course, deliberately handed over out of order. */
const phases: StandingPhase[] = [
  { semester: 2, type: "PRACTICE", startDate: "2027-04-01", endDate: "2027-09-30" },
  { semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
];

describe("courseStanding", () => {
  it("names the phase the day falls into and the one that follows it", () => {
    expect(courseStanding(course, phases, "2026-11-15"))
      .toEqual({ currentPhase: "Theorie im 1. Semester", nextPhase: "ab 01.04.2027 Praxis im 2. Semester" });
  });

  it("counts the first and the last day of a phase as inside it", () => {
    expect(courseStanding(course, phases, "2026-10-01").currentPhase).toBe("Theorie im 1. Semester");
    expect(courseStanding(course, phases, "2027-03-31").currentPhase).toBe("Theorie im 1. Semester");
    expect(courseStanding(course, phases, "2027-04-01").currentPhase).toBe("Praxis im 2. Semester");
  });

  it("announces the first phase before the study begins instead of reporting one", () => {
    expect(courseStanding(course, phases, "2026-09-30"))
      .toEqual({ currentPhase: "Noch nicht begonnen", nextPhase: "ab 01.10.2026 Theorie im 1. Semester" });
  });

  it("drops the announcement once no phase follows", () => {
    expect(courseStanding(course, phases, "2027-05-01"))
      .toEqual({ currentPhase: "Praxis im 2. Semester", nextPhase: null });
  });

  it("names a gap in an incomplete planning state rather than leaving the line blank", () => {
    const withGap = phases.filter((phase) => phase.semester !== 1);
    expect(courseStanding(course, withGap, "2026-11-15"))
      .toEqual({ currentPhase: "Zurzeit keine Kursphase", nextPhase: "ab 01.04.2027 Praxis im 2. Semester" });
    expect(courseStanding(course, [], "2026-11-15")).toEqual({ currentPhase: "Zurzeit keine Kursphase", nextPhase: null });
  });

  /* The study period decides this, not the phases: a planning state whose phases stop short of the study end would
     otherwise report a course as over while it still runs. */
  it("reads the end of the study period rather than the end of the last phase", () => {
    expect(courseStanding(course, phases, "2027-10-01").currentPhase).toBe("Zurzeit keine Kursphase");
    expect(courseStanding(course, phases, "2029-10-01").currentPhase).toBe("Studium beendet");
  });
});
