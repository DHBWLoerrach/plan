import { describe, expect, it } from "vitest";

import { adoptionShiftDays, planAdoption, proposedStudyEnd, type AdoptionTemplate, nextYearProposal } from "@/lib/domain/course-adoption";

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

  /* A study year begins on 1 October, whatever weekday that is. Shifted by 364 days the first phase would start on
     2026-09-30 and the last would end on 2027-09-29 — each one day beside the study period they began and ended with
     in the template. Both are put back on its borders, so the adopted progression covers it without a correction. */
  it("keeps the first and the last day on the borders of the study period they were anchored to", () => {
    const adoption = planAdoption(template, target);
    expect(adoption.phases[0]).toEqual({ semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-30", truncated: false });
    expect(adoption.phases[1]).toEqual({ semester: 2, type: "PRACTICE", startDate: "2026-12-31", endDate: "2027-09-30", truncated: false });
    expect(adoption).toMatchObject({ movedToStudyStart: true, movedToStudyEnd: true });
  });

  it("moves nothing where the shift lands on the borders by itself", () => {
    const adoption = planAdoption(template, { ...target, studyStart: "2026-09-30", studyEnd: "2027-09-29" });
    expect(adoption.phases.map((phase) => [phase.startDate, phase.endDate])).toEqual([["2026-09-30", "2026-12-30"], ["2026-12-31", "2027-09-29"]]);
    expect(adoption).toMatchObject({ movedToStudyStart: false, movedToStudyEnd: false });
  });

  // A template that left its first days unplanned did so on purpose; the adoption does not plan them for it.
  it("leaves an edge alone that was not on the border of the study period in the template", () => {
    const later = { ...template, phases: [{ ...template.phases[0], startDate: "2025-10-06" }, template.phases[1]] };
    const adoption = planAdoption(later, target);
    expect(adoption.phases[0].startDate).toBe("2026-10-05");
    expect(adoption.movedToStudyStart).toBe(false);
  });

  // Only the remainder of the rounding is closed. A study end set weeks later is a decision, and its gap stays to be seen.
  it("does not stretch the last phase to a study end a week or more away", () => {
    const adoption = planAdoption(template, { ...target, studyEnd: "2027-10-06" });
    expect(adoption.phases.at(-1)!.endDate).toBe("2027-09-29");
    expect(adoption.movedToStudyEnd).toBe(false);
    expect(planAdoption(template, { ...target, studyEnd: "2027-10-05" }).phases.at(-1)!.endDate).toBe("2027-10-05");
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

describe("nextYearProposal", () => {
  it("counts the year of the code up and moves the study period by twelve months", () => {
    expect(nextYearProposal({ code: "TIF25A", studyStart: "2025-10-01", studyEnd: "2028-09-30" }, "2026-11-16"))
      .toEqual({ code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
    expect(nextYearProposal({ code: "WIN2025A-B", studyStart: "2025-09-29", studyEnd: "2029-03-29" }, "2026-11-16"))
      .toEqual({ code: "WIN2026A-B", studyStart: "2026-09-29", studyEnd: "2030-03-29" });
  });

  // The period is anchored to dates, so it stays on them across a leap year instead of drifting by a day.
  it("keeps the dates of the study period across a leap year", () => {
    expect(nextYearProposal({ code: "TIF27A", studyStart: "2027-10-01", studyEnd: "2030-09-30" }, "2026-11-16"))
      .toMatchObject({ studyStart: "2028-10-01", studyEnd: "2031-09-30" });
  });

  // A code repeated unchanged would only be refused when saved; none at all asks to be typed.
  it("proposes no code where the template names no year to count up", () => {
    expect(nextYearProposal({ code: "SONDERKURS", studyStart: "2025-10-01", studyEnd: "2028-09-30" }, "2026-11-16").code).toBe("");
    expect(nextYearProposal({ code: "RAUM07", studyStart: "2025-10-01", studyEnd: "2028-09-30" }, "2026-11-16").code).toBe("");
  });

  it("carries the century over within a two-digit year", () => {
    expect(nextYearProposal({ code: "TIF99A", studyStart: "2099-10-01", studyEnd: "2102-09-30" }, "2099-01-01").code).toBe("TIF00A");
  });
});
