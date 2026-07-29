import { describe, expect, it } from "vitest";

import { adoptionShiftDays, planAdoption, proposedStudyEnd, type AdoptionTemplate } from "@/lib/domain/course-adoption";

/** A study year of the template: one theory phase, one practice phase and two events. */
const template: AdoptionTemplate = {
  studyStart: "2025-10-01",
  studyEnd: "2026-09-30",
  phases: [
    { semester: 1, type: "THEORY", startDate: "2025-10-01", endDate: "2025-12-31" },
    { semester: 2, type: "PRACTICE", startDate: "2026-01-01", endDate: "2026-09-30" },
  ],
  events: [
    { title: "Klausur", description: null, category: "EXAM", startDate: "2026-03-15", endDate: null, provisional: false },
    { title: "Projektarbeit", description: "Abgabe", category: "SUBMISSION", startDate: "2026-06-01", endDate: "2026-06-05", provisional: true },
  ],
};

const target = { studyStart: "2026-10-01", studyEnd: "2027-09-30", withPhases: true, withEvents: true };

function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

describe("adoptionShiftDays", () => {
  it("rounds the difference of the two study starts to the nearest multiple of seven days", () => {
    // 365 days apart: a whole year misses 52 weeks by one day, and the week wins.
    expect(adoptionShiftDays("2025-10-01", "2026-10-01")).toBe(364);
    expect(adoptionShiftDays("2026-10-01", "2025-10-01")).toBe(-364);
  });

  it("is zero for the same study start", () => {
    expect(adoptionShiftDays("2026-10-01", "2026-10-01")).toBe(0);
  });

  it("rounds to the nearer week in both directions", () => {
    expect(adoptionShiftDays("2026-10-01", "2026-10-04")).toBe(0);
    expect(adoptionShiftDays("2026-10-01", "2026-10-05")).toBe(7);
    expect(adoptionShiftDays("2026-10-04", "2026-10-01")).toBe(0);
    expect(adoptionShiftDays("2026-10-05", "2026-10-01")).toBe(-7);
  });
});

describe("proposedStudyEnd", () => {
  it("keeps the length of the study period of the template", () => {
    expect(proposedStudyEnd(template, "2026-10-01")).toBe("2027-09-30");
  });
});

describe("planAdoption", () => {
  it("names the shift in days and in whole weeks", () => {
    const adoption = planAdoption(template, target);
    expect(adoption.shiftDays).toBe(364);
    expect(adoption.shiftWeeks).toBe(52);
  });

  it("keeps the weekday of every adopted day, which is why the shift is rounded at all", () => {
    const adoption = planAdoption(template, target);
    expect(weekday(adoption.phases[1].startDate)).toBe(weekday(template.phases[1].startDate));
    expect(weekday(adoption.events[0].startDate)).toBe(weekday(template.events[0].startDate));
  });

  it("cuts a phase that reaches beyond the study period to its boundary and marks it", () => {
    const adoption = planAdoption(template, target);
    // Shifted by 364 days the first phase would start on 2026-09-30, one day before the new study period.
    expect(adoption.phases[0]).toEqual({ semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-30", truncated: true });
    expect(adoption.phases[1]).toEqual({ semester: 2, type: "PRACTICE", startDate: "2026-12-31", endDate: "2027-09-29", truncated: false });
  });

  it("leaves the gap the rounding opens at the end instead of closing it", () => {
    const adoption = planAdoption(template, target);
    expect(adoption.phases.at(-1)!.endDate).toBe("2027-09-29");
    expect(target.studyEnd).toBe("2027-09-30");
  });

  it("drops a phase the shorter study period leaves no day for and names it", () => {
    const adoption = planAdoption(template, { ...target, studyEnd: "2026-12-15" });
    expect(adoption.phases).toEqual([{ semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-15", truncated: true }]);
    expect(adoption.droppedPhases).toEqual([{ semester: 2, type: "PRACTICE", startDate: "2026-12-31", endDate: "2027-09-29" }]);
  });

  it("shifts events without cutting them, even when one falls outside the study period", () => {
    const adoption = planAdoption(template, { ...target, studyEnd: "2027-01-31" });
    expect(adoption.events[0]).toEqual({ title: "Klausur", description: null, category: "EXAM", startDate: "2027-03-14", endDate: null, provisional: false });
    expect(adoption.events[1]).toEqual({ title: "Projektarbeit", description: "Abgabe", category: "SUBMISSION", startDate: "2027-05-31", endDate: "2027-06-04", provisional: true });
  });

  it("adopts course progression and events separately", () => {
    expect(planAdoption(template, { ...target, withEvents: false }).events).toEqual([]);
    expect(planAdoption(template, { ...target, withPhases: false }).phases).toEqual([]);
    // The shift is a property of the two study starts and stays named whatever is adopted.
    expect(planAdoption(template, { ...target, withPhases: false, withEvents: false }).shiftWeeks).toBe(52);
  });
});
