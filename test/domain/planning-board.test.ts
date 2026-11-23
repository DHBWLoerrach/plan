import { describe, expect, it } from "vitest";

import {
  affectedEvents, axisYears, boardAxis, dayAt, dayIndex, describeChanges, junctionBlocks, junctionFits, junctionRange, moveJunction, moveJunctions, nearestMonday, newOpenPoints, periodPlacement, reachableDay,
  parallelDeviations, phaseDiffers, phaseJunctions, type BoardPlan,
} from "@/lib/domain/planning-board";
import type { CoursePlan, PlanEvent, PlanPhase } from "@/lib/domain/publication";

const course: CoursePlan = { id: "course-a", code: "TIF25A", studyStart: "2025-10-01", studyEnd: "2026-09-27", semesters: 2 };

const phases: PlanPhase[] = [
  { id: "s1-t", courseId: "course-a", code: "TIF25A", semester: 1, type: "THEORY", startDate: "2025-10-01", endDate: "2025-12-21" },
  { id: "s1-p", courseId: "course-a", code: "TIF25A", semester: 1, type: "PRACTICE", startDate: "2025-12-22", endDate: "2026-03-29" },
  { id: "s2-t", courseId: "course-a", code: "TIF25A", semester: 2, type: "THEORY", startDate: "2026-03-30", endDate: "2026-06-21" },
  { id: "s2-p", courseId: "course-a", code: "TIF25A", semester: 2, type: "PRACTICE", startDate: "2026-06-22", endDate: "2026-09-27" },
];

const exam: PlanEvent = { id: "exam", code: "TIF25A", title: "Klausuren", description: null, category: "EXAM", startDate: "2025-12-15", endDate: "2025-12-19", provisional: false, courseId: "course-a" };
const saved: BoardPlan = { phases, events: [exam] };

describe("planning board axis", () => {
  it("runs from the earliest study start to the latest study end, both days included", () => {
    const axis = boardAxis([course, { ...course, studyStart: "2025-09-01", studyEnd: "2026-10-04" }]);
    expect(axis).toEqual({ origin: "2025-09-01", days: 399 });
    expect(dayIndex(axis, "2025-09-01")).toBe(0);
    expect(dayAt(axis, dayIndex(axis, "2026-02-28"))).toBe("2026-02-28");
  });

  it("widens to dates that lie outside every study period", () => {
    expect(boardAxis([course], [{ startDate: "2025-09-01", endDate: null }, { startDate: "2026-09-28", endDate: "2026-10-02" }])).toEqual({ origin: "2025-09-01", days: 397 });
  });

  it("places a period by its first day and its inclusive length", () => {
    const axis = { origin: "2025-10-01", days: 100 };
    expect(periodPlacement(axis, "2025-10-01", "2025-10-10")).toEqual({ left: 0, width: 10 });
    expect(axisYears({ origin: "2025-12-30", days: 4 })).toEqual([{ year: 2025, left: 0, width: 50 }, { year: 2026, left: 50, width: 50 }]);
  });
});

describe("phase junctions", () => {
  it("finds only changes between adjoining phases", () => {
    const withGap = phases.map((phase) => (phase.id === "s2-t" ? { ...phase, startDate: "2026-04-06" } : phase));
    expect(phaseJunctions(phases).map((junction) => junction.day)).toEqual(["2025-12-22", "2026-03-30", "2026-06-22"]);
    expect(phaseJunctions(withGap).map((junction) => junction.laterId)).toEqual(["s1-p", "s2-p"]);
  });

  it("splits the changes where a gap interrupts the progression", () => {
    const withGap = phases.map((phase) => (phase.id === "s2-t" ? { ...phase, startDate: "2026-04-06" } : phase));
    expect(junctionBlocks(phases).map((block) => block.map((junction) => junction.laterId))).toEqual([["s1-p", "s2-t", "s2-p"]]);
    expect(junctionBlocks(withGap).map((block) => block.map((junction) => junction.laterId))).toEqual([["s1-p"], ["s2-p"]]);
  });

  it("moves a change as one day, so the two phases keep adjoining", () => {
    const moved = moveJunction(phases, { earlierId: "s1-t", laterId: "s1-p" }, "2026-01-05");
    expect(moved.find((phase) => phase.id === "s1-t")?.endDate).toBe("2026-01-04");
    expect(moved.find((phase) => phase.id === "s1-p")?.startDate).toBe("2026-01-05");
    expect(phaseJunctions(moved)).toHaveLength(3);
  });

  it("keeps at least a day of both phases, as saving a change does", () => {
    expect(junctionFits(phases, { earlierId: "s1-t", laterId: "s1-p" }, "2026-03-29")).toBe(true);
    expect(junctionFits(phases, { earlierId: "s1-t", laterId: "s1-p" }, "2026-03-30")).toBe(false);
    expect(junctionFits(phases, { earlierId: "s1-t", laterId: "s1-p" }, "2025-10-02")).toBe(true);
    expect(junctionFits(phases, { earlierId: "s1-t", laterId: "s1-p" }, "2025-10-01")).toBe(false);
    expect(junctionRange(phases, { earlierId: "s1-t", laterId: "s1-p" })).toEqual({ earliest: "2025-10-02", latest: "2026-03-29" });
  });

  it("moves several changes together and judges only the result", () => {
    const [first, second] = phaseJunctions(phases);
    const moved = moveJunctions(phases, [{ junction: first, day: "2026-04-06" }, { junction: second, day: "2026-04-13" }]);
    expect(moved?.find((phase) => phase.id === "s1-p")).toMatchObject({ startDate: "2026-04-06", endDate: "2026-04-12" });
    expect(moveJunctions(phases, [{ junction: first, day: "2026-04-13" }, { junction: second, day: "2026-04-06" }])).toBeNull();
  });

  it("stops a change before it would reorder overlapping phases", () => {
    const overlapping = [...phases, { ...phases[2], id: "extra", semester: 2, startDate: "2026-02-02", endDate: "2026-02-08" }];
    const junction = phaseJunctions(overlapping).find((candidate) => candidate.laterId === "s1-p")!;
    expect(junctionFits(overlapping, junction, "2026-02-02")).toBe(true);
    expect(junctionFits(overlapping, junction, "2026-02-03")).toBe(false);
    expect(reachableDay(overlapping, junction, "2026-03-29")).toBe("2026-02-02");
    expect(reachableDay(phases, phaseJunctions(phases)[0], "2026-03-29")).toBe("2026-03-29");
  });

  it("snaps a dragged day to the nearest Monday", () => {
    expect(nearestMonday("2026-01-08")).toBe("2026-01-05");
    expect(nearestMonday("2026-01-09")).toBe("2026-01-12");
    expect(nearestMonday("2026-01-12")).toBe("2026-01-12");
  });
});

describe("changes in words", () => {
  it("names a moved change with the new lengths of both phases", () => {
    const current = { ...saved, phases: moveJunction(phases, { earlierId: "s1-t", laterId: "s1-p" }, "2025-12-08") };
    expect(describeChanges(saved, current)).toEqual([{
      key: "junction:s1-p",
      text: "Wechsel Theorie → Praxis von Mo 22.12.2025 auf Mo 08.12.2025 verschoben",
      consequences: ["Theorie (Semester 1): 11 Wochen, 5 Tage → 9 Wochen, 5 Tage", "Praxis (Semester 1): 14 Wochen → 16 Wochen"],
    }]);
  });

  it("names an event that two moved changes leave in another phase once, apart from the changes", () => {
    const first = moveJunction(phases, { earlierId: "s1-t", laterId: "s1-p" }, "2025-12-08");
    const current = { ...saved, phases: moveJunction(first, { earlierId: "s2-t", laterId: "s2-p" }, "2026-06-29") };
    const changes = describeChanges(saved, current);
    expect(changes.map((change) => change.key)).toEqual(["junction:s1-p", "junction:s2-p"]);
    expect(changes.flatMap((change) => change.consequences).some((text) => text.includes("Klausuren"))).toBe(false);
    expect(affectedEvents(saved, current)).toEqual(["„Klausuren“ liegt jetzt in der Praxisphase von Semester 1 statt in der Theoriephase von Semester 1."]);
  });

  it("leaves a moved event out of the affected ones, since its own entry says where it lies", () => {
    const current = { phases: moveJunction(phases, { earlierId: "s1-t", laterId: "s1-p" }, "2025-12-08"), events: [{ ...exam, startDate: "2025-12-16" }] };
    expect(affectedEvents(saved, current)).toEqual([]);
    expect(describeChanges(saved, current).at(-1)?.consequences).toEqual(["„Klausuren“ liegt jetzt in der Praxisphase von Semester 1 statt in der Theoriephase von Semester 1."]);
  });

  it("names a moved event, and a lengthened one as such", () => {
    const moved = { ...saved, events: [{ ...exam, startDate: "2026-06-08", endDate: "2026-06-12" }] };
    const lengthened = { ...saved, events: [{ ...exam, endDate: "2025-12-20" }] };
    expect(describeChanges(saved, moved)[0]).toMatchObject({
      text: "„Klausuren“ von Mo 15.12.2025 – Fr 19.12.2025 auf Mo 08.06.2026 – Fr 12.06.2026 verschoben",
      consequences: ["„Klausuren“ liegt jetzt in der Theoriephase von Semester 2 statt in der Theoriephase von Semester 1."],
    });
    expect(describeChanges(saved, lengthened)[0].text).toBe("„Klausuren“ dauert jetzt Mo 15.12.2025 – Sa 20.12.2025 statt Mo 15.12.2025 – Fr 19.12.2025");
    expect(describeChanges(saved, saved)).toEqual([]);
  });

  it("lists only the open points the changes add", () => {
    const outside = { ...saved, events: [{ ...exam, startDate: "2026-10-05", endDate: null }] };
    expect(newOpenPoints(course, saved, saved)).toEqual([]);
    expect(newOpenPoints(course, saved, outside).map((point) => point.message)).toEqual(["Der Termin „Klausuren“ liegt außerhalb des Studienzeitraums von TIF25A."]);
  });

  it("tells a new open point apart from an old one with the same text", () => {
    const second = { ...exam, id: "exam-2", startDate: "2026-01-12", endDate: null };
    const before = { ...saved, events: [{ ...exam, startDate: "2026-10-05", endDate: null }, second] };
    const after = { ...before, events: [before.events[0], { ...second, startDate: "2026-10-12" }] };
    expect(newOpenPoints(course, before, after)).toEqual([{
      key: "event-outside-study-period|course-a|exam-2||startDate",
      message: "Der Termin „Klausuren“ liegt außerhalb des Studienzeitraums von TIF25A.",
    }]);
  });

  it("marks a parallel phase that the edited plan has with another period", () => {
    const parallel = { ...phases[0], id: "b-s1-t", courseId: "course-b", endDate: "2025-12-28" };
    expect(phaseDiffers(parallel, phases)).toBe(true);
    expect(phaseDiffers({ ...phases[0], id: "b", courseId: "course-b" }, phases)).toBe(false);
    expect(phaseDiffers({ ...phases[1], id: "c", courseId: "course-c", semester: 2 }, phases)).toBe(true);
  });

  it("tells how a parallel course departs from the edited one, phase by phase", () => {
    const parallel = phases.slice(0, 3).map((phase) => ({ ...phase, id: `b-${phase.id}`, courseId: "course-b", code: "TIF25B" }));
    parallel[0] = { ...parallel[0], endDate: "2025-12-28" };
    parallel[1] = { ...parallel[1], startDate: "2025-12-29" };
    expect(parallelDeviations("TIF25A", phases, parallel)).toEqual({
      summary: null,
      phases: [
        "Theorie, Semester 1: Mi 01.10.2025 – So 28.12.2025, 12 Wochen, 5 Tage (TIF25A: Mi 01.10.2025 – So 21.12.2025, 11 Wochen, 5 Tage)",
        "Praxis, Semester 1: Mo 29.12.2025 – So 29.03.2026, 13 Wochen (TIF25A: Mo 22.12.2025 – So 29.03.2026, 14 Wochen)",
        "Praxis, Semester 2: nicht vorhanden (TIF25A: Mo 22.06.2026 – So 27.09.2026, 14 Wochen)",
      ],
    });
    expect(parallelDeviations("TIF25A", phases, phases.map((phase) => ({ ...phase, id: `c-${phase.id}`, courseId: "course-c" })))).toEqual({ summary: null, phases: [] });
  });

  it("counts each phase as a counterpart once, so a second block of the same kind is not taken as matched", () => {
    const edited = [phases[0], { ...phases[0], id: "s1-t2", startDate: "2025-12-22", endDate: "2026-01-04" }];
    const parallel = [{ ...phases[0], id: "b-s1-t", courseId: "course-b" }];
    expect(parallelDeviations("TIF25A", edited, parallel)).toEqual({
      summary: null,
      phases: ["Theorie, Semester 1: nicht vorhanden (TIF25A: Mo 22.12.2025 – So 04.01.2026, 2 Wochen)"],
    });
  });

  it("calls it another order, not another model, when both courses start each semester the same way", () => {
    const edited = [
      { ...phases[0], id: "a1", startDate: "2025-10-01", endDate: "2025-10-31" },
      { ...phases[1], id: "a2", semester: 1, startDate: "2025-11-01", endDate: "2025-11-30" },
      { ...phases[0], id: "a3", startDate: "2025-12-01", endDate: "2025-12-31" },
    ];
    const parallel = [
      { ...phases[0], id: "b1", courseId: "course-b", startDate: "2025-10-01", endDate: "2025-10-31" },
      { ...phases[0], id: "b2", courseId: "course-b", startDate: "2025-11-01", endDate: "2025-11-30" },
      { ...phases[1], id: "b3", courseId: "course-b", semester: 1, startDate: "2025-12-01", endDate: "2025-12-31" },
    ];
    expect(parallelDeviations("TIF25A", edited, parallel).summary).toBe("andere Reihenfolge von Theorie und Praxis in Semester 1");
  });

  it("sums up a course that orders theory and practice the other way round instead of listing every phase", () => {
    const swapped = (semester: number) => phases.filter((phase) => phase.semester === semester).map((phase) => ({ ...phase, id: `d-${phase.id}`, courseId: "course-d", type: phase.type === "THEORY" ? "PRACTICE" as const : "THEORY" as const }));
    expect(parallelDeviations("TIF25A", phases, [...swapped(1), ...swapped(2)])).toEqual({
      summary: "anderes Studienmodell, jedes Semester beginnt mit Praxis statt mit Theorie",
      phases: [],
    });
    const second = phases.filter((phase) => phase.semester === 2).map((phase) => ({ ...phase, id: `e-${phase.id}`, courseId: "course-e", endDate: phase.endDate === "2026-09-27" ? "2026-10-04" : phase.endDate }));
    expect(parallelDeviations("TIF25A", phases, [...swapped(1), ...second])).toEqual({
      summary: "andere Reihenfolge von Theorie und Praxis in Semester 1",
      phases: ["Praxis, Semester 2: Mo 22.06.2026 – So 04.10.2026, 15 Wochen (TIF25A: Mo 22.06.2026 – So 27.09.2026, 14 Wochen)"],
    });
  });
});
