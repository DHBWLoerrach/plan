import { describe, expect, it } from "vitest";

import { buildPlanTimeline, flagNarrowBars, type TimelineBar } from "@/lib/domain/plan-timeline";
import type { DraftCourse, DraftPhase } from "@/lib/domain/publication";

/** An axis of exactly 100 days, so every percentage of the diagram is readable as a number of days. */
function course(id: string, code: string): DraftCourse {
  return { id, code, studyStart: "2026-01-01", studyEnd: "2026-04-10", semesters: 2 };
}

function run(courseId: string): DraftPhase[] {
  return [
    { courseId, semester: 1, type: "THEORY", startDate: "2026-01-01", endDate: "2026-02-09" },
    { courseId, semester: 1, type: "PRACTICE", startDate: "2026-02-10", endDate: "2026-03-01" },
    { courseId, semester: 2, type: "THEORY", startDate: "2026-03-02", endDate: "2026-04-10" },
  ];
}

describe("buildPlanTimeline", () => {
  it("has no diagram to draw without a course", () => {
    expect(buildPlanTimeline([], run("course-a"))).toBeNull();
  });

  it("places every phase on the shared axis", () => {
    const timeline = buildPlanTimeline([course("course-a", "TIF26A")], run("course-a"));

    expect(timeline?.startDate).toBe("2026-01-01");
    expect(timeline?.endDate).toBe("2026-04-10");
    expect(timeline?.lanes[0].bars).toEqual([
      { type: "THEORY", startDate: "2026-01-01", endDate: "2026-02-09", offset: 0, width: 40 },
      { type: "PRACTICE", startDate: "2026-02-10", endDate: "2026-03-01", offset: 40, width: 20 },
      { type: "THEORY", startDate: "2026-03-02", endDate: "2026-04-10", offset: 60, width: 40 },
    ]);
  });

  it("draws courses running identically as one lane", () => {
    const timeline = buildPlanTimeline(
      [course("course-a", "TIF26A"), course("course-b", "WWI26A")],
      [...run("course-a"), ...run("course-b")],
    );

    expect(timeline?.lanes).toHaveLength(1);
    expect(timeline?.lanes[0].codes).toEqual(["TIF26A", "WWI26A"]);
  });

  it("keeps courses apart as soon as one phase differs", () => {
    const diverging = run("course-b").map((phase) =>
      phase.type === "PRACTICE" ? { ...phase, endDate: "2026-03-02" } : phase);
    const timeline = buildPlanTimeline(
      [course("course-a", "TIF26A"), course("course-b", "TIF26B")],
      [...run("course-a"), ...diverging],
    );

    expect(timeline?.lanes.map((lane) => lane.codes)).toEqual([["TIF26A"], ["TIF26B"]]);
  });

  it("keeps courses apart when the same periods belong to different semesters", () => {
    const shifted = run("course-b").map((phase) => ({ ...phase, semester: 2 }));
    const timeline = buildPlanTimeline(
      [course("course-a", "TIF26A"), course("course-b", "TIF26B")],
      [...run("course-a"), ...shifted],
    );

    expect(timeline?.lanes).toHaveLength(2);
  });

  it("bounds every semester within its own lane", () => {
    const timeline = buildPlanTimeline([course("course-a", "TIF26A")], run("course-a"));

    expect(timeline?.lanes[0].semesters).toEqual([
      { semester: 1, startDate: "2026-01-01", endDate: "2026-03-01", offset: 0, width: 60 },
      { semester: 2, startDate: "2026-03-02", endDate: "2026-04-10", offset: 60, width: 40 },
    ]);
  });

  it("bounds a semester of one lane independently of the other", () => {
    const later = run("course-b").map((phase) =>
      phase.semester === 1 && phase.type === "PRACTICE" ? { ...phase, semester: 2 } : phase);
    const timeline = buildPlanTimeline(
      [course("course-a", "TIF26A"), course("course-b", "TIF26B")],
      [...run("course-a"), ...later],
    );

    expect(timeline?.lanes[0].semesters[0].endDate).toBe("2026-03-01");
    expect(timeline?.lanes[1].semesters[0].endDate).toBe("2026-02-09");
  });

  it("gives a course still without a phase a lane without bars", () => {
    const timeline = buildPlanTimeline([course("course-a", "TIF26A")], []);

    expect(timeline?.lanes).toEqual([{ codes: ["TIF26A"], bars: [], semesters: [] }]);
  });

  it("ignores the phases of a course the matrix does not show", () => {
    const hidden: DraftPhase[] = [
      { courseId: "course-b", semester: 1, type: "THEORY", startDate: "2025-01-01", endDate: "2025-06-30" },
    ];
    const timeline = buildPlanTimeline([course("course-a", "TIF26A")], [...run("course-a"), ...hidden]);

    expect(timeline?.startDate).toBe("2026-01-01");
    expect(timeline?.lanes).toHaveLength(1);
  });

  it("stretches the axis over a phase a draft placed outside the study period", () => {
    const overshooting = [...run("course-a"), {
      courseId: "course-a",
      semester: 2,
      type: "PRACTICE" as const,
      startDate: "2026-04-11",
      endDate: "2026-04-20",
    }];
    const timeline = buildPlanTimeline([course("course-a", "TIF26A")], overshooting);

    expect(timeline?.endDate).toBe("2026-04-20");
    expect(timeline?.lanes[0].bars.at(-1)?.width).toBeCloseTo((10 / 110) * 100, 2);
  });

  it("leaves the gap of an incomplete draft between the bars", () => {
    const withGap = run("course-a").filter((phase) => phase.type !== "PRACTICE");
    const timeline = buildPlanTimeline([course("course-a", "TIF26A")], withGap);
    const [first, second] = timeline?.lanes[0].bars ?? [];

    expect(first.offset + first.width).toBe(40);
    expect(second.offset).toBe(60);
  });

  it("shares one semester band where the lanes agree on the bounds", () => {
    const timeline = buildPlanTimeline(
      [course("course-a", "TIF26A"), course("course-b", "TIF26B")],
      [...run("course-a"), ...run("course-b").map((phase) =>
        phase.type === "PRACTICE" ? { ...phase, type: "THEORY" as const } : phase)],
    );

    expect(timeline?.lanes).toHaveLength(2);
    expect(timeline?.sharedSemesters).toEqual(timeline?.lanes[0].semesters);
  });

  it("keeps a band per lane as soon as one semester differs in its bounds", () => {
    const later = run("course-b").map((phase) =>
      phase.semester === 1 && phase.type === "PRACTICE" ? { ...phase, semester: 2 } : phase);
    const timeline = buildPlanTimeline(
      [course("course-a", "TIF26A"), course("course-b", "TIF26B")],
      [...run("course-a"), ...later],
    );

    expect(timeline?.sharedSemesters).toBeNull();
  });

  it("clips the first and the last year to the axis", () => {
    const spanning: DraftCourse = { id: "course-a", code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2028-03-31", semesters: 3 };
    const timeline = buildPlanTimeline([spanning], []);

    expect(timeline?.years.map((year) => [year.year, year.startDate, year.endDate])).toEqual([
      [2026, "2026-10-01", "2026-12-31"],
      [2027, "2027-01-01", "2027-12-31"],
      [2028, "2028-01-01", "2028-03-31"],
    ]);
    // 92 of 548 days, and the leap day of 2028 counted with the last year.
    expect(timeline?.years[0].width).toBeCloseTo((92 / 548) * 100, 2);
    expect(timeline?.years[2].width).toBeCloseTo((91 / 548) * 100, 2);
  });
});

function bar(offset: number, width: number): TimelineBar {
  return { type: "PRACTICE", startDate: "2026-01-01", endDate: "2026-01-02", offset, width };
}

/** A label of a tenth of the axis, the width every bar of these cases is measured against. */
const tenth = () => 10;

describe("flagNarrowBars", () => {
  it("leaves a bar wide enough for its own label alone", () => {
    expect(flagNarrowBars([bar(0, 40), bar(40, 20)], tenth)).toEqual([]);
  });

  it("anchors the label of a narrow bar at its middle", () => {
    expect(flagNarrowBars([bar(0, 40), bar(40, 2), bar(42, 58)], tenth)).toEqual([
      { bar: bar(40, 2), center: 41, row: 0 },
    ]);
  });

  it("keeps distant labels in one row", () => {
    expect(flagNarrowBars([bar(0, 2), bar(50, 2)], tenth).map((flag) => flag.row)).toEqual([0, 0]);
  });

  it("moves a label down where the one before it is too close", () => {
    expect(flagNarrowBars([bar(0, 2), bar(3, 2), bar(6, 2)], tenth).map((flag) => flag.row)).toEqual([0, 1, 2]);
  });

  it("returns to the first row as soon as it is free again", () => {
    expect(flagNarrowBars([bar(0, 2), bar(3, 2), bar(40, 2)], tenth).map((flag) => flag.row)).toEqual([0, 1, 0]);
  });

  it("measures every bar against the width of its own label", () => {
    // The first bar holds a label of its own width, the second one does not.
    const width = (candidate: TimelineBar) => (candidate.offset === 0 ? 8 : 30);
    expect(flagNarrowBars([bar(0, 10), bar(20, 10)], width).map((flag) => flag.bar.offset)).toEqual([20]);
  });

  it("keeps a narrow label clear of the wide one before it", () => {
    // Twelve apart, which holds the second label on its own — but the two meet with half of each, and the first one
    // is three times as wide.
    const width = (candidate: TimelineBar) => (candidate.offset === 0 ? 30 : 10);
    expect(flagNarrowBars([bar(0, 2), bar(12, 2)], width).map((flag) => flag.row)).toEqual([0, 1]);
  });

  it("flags a bar the axis has grown too narrow for", () => {
    // The same bar, once on an axis where its label fits and once where it no longer does.
    expect(flagNarrowBars([bar(0, 12)], () => 10)).toEqual([]);
    expect(flagNarrowBars([bar(0, 12)], () => 14).map((flag) => flag.row)).toEqual([0]);
  });
});
