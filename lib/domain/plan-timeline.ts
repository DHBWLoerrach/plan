import { inclusiveDays } from "@/lib/domain/calendar-day";
import { groupComparableCourses } from "@/lib/domain/plan-comparison";
import type { PhaseType } from "@/lib/domain/phase-type";
import type { CoursePlan, CoursePhase } from "@/lib/domain/publication";

/** A period placed on the shared axis of the diagram, as a percentage of the axis length. */
export interface TimelineSpan {
  startDate: string;
  endDate: string;
  offset: number;
  width: number;
}

export interface TimelineBar extends TimelineSpan {
  type: PhaseType;
}

export interface TimelineSemester extends TimelineSpan {
  semester: number;
}

export interface TimelineYear extends TimelineSpan {
  year: number;
}

/** One row of the diagram: one course or the courses whose complete phase sequences agree. */
export interface TimelineLane {
  codes: string[];
  bars: TimelineBar[];
  semesters: TimelineSemester[];
}

export interface PlanTimeline {
  startDate: string;
  endDate: string;
  years: TimelineYear[];
  lanes: TimelineLane[];
  /**
   * The semester bounds of every lane where they agree, so the diagram draws one band instead of repeating it. The
   * bounds of the same semester may differ between the courses of a block plan (ADR 0006), and where they
   * do this stays `null` and every lane keeps its own band.
   */
  sharedSemesters: TimelineSemester[] | null;
}

/** A phase too short to hold its length, with the label placed below the bars instead. */
export interface TimelineFlag {
  bar: TimelineBar;
  /** The middle of the bar, where the label is anchored and the line leading up to it starts. */
  center: number;
  /** Which row below the bars the label sits in; a further row keeps two close labels apart. */
  row: number;
}

/**
 * The share of the axis a label is assumed to need until the browser has measured one. It only holds for the first
 * paint: how wide a label is depends on the font and on how wide the diagram currently is, and neither is known here.
 */
export const assumedLabelWidth = 4;

/**
 * The labels of every bar too narrow to carry its own, from left to right. `labelWidth` states the share of the axis
 * the label of a bar needs; a bar narrower than that would show a fragment of it, so the label moves under the bar. A
 * label goes into the topmost row that has ended before it begins, so labels of phases following closely on one
 * another never touch.
 *
 * A row therefore keeps where its last label ends, not where it is anchored: the labels are centred on their bars and
 * two of them meet with half of each. Measuring the gap between the anchors against the width of the later label alone
 * would let a wide label reach into a narrow one that follows.
 */
export function flagNarrowBars(bars: TimelineBar[], labelWidth: (bar: TimelineBar) => number): TimelineFlag[] {
  const rowEnds: number[] = [];
  const flags: TimelineFlag[] = [];
  for (const bar of bars) {
    const needed = labelWidth(bar);
    if (bar.width >= needed) continue;
    const center = round(bar.offset + bar.width / 2);
    const row = rowEnds.findIndex((end) => center - needed / 2 >= end);
    if (row === -1) {
      flags.push({ bar, center, row: rowEnds.length });
      rowEnds.push(center + needed / 2);
      continue;
    }
    flags.push({ bar, center, row });
    rowEnds[row] = center + needed / 2;
  }
  return flags;
}

/** Percentages carry more decimals than a screen can place; three keep the rounding well below one pixel. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * The block plan as one diagram over a single time axis, as the overview above the matrix. Courses with equal complete
 * phase sequences share a lane; a changed semester, type or boundary produces its own lane again.
 *
 * The diagram is an addition, never the record. Its bars carry the phase type through fill alone and a short one has
 * no room for a label at all, so the matrix below remains the full and the accessible reading (BARRIEREFREIHEIT.md).
 */
export function buildPlanTimeline(courses: CoursePlan[], phases: CoursePhase[]): PlanTimeline | null {
  if (!courses.length) return null;
  const courseIds = new Set(courses.map((course) => course.id));
  const shownPhases = phases.filter((phase) => courseIds.has(phase.courseId));
  // An incomplete unpublished course may hold a phase reaching past its study period, and the axis has to contain
  // whatever it draws, or that bar would land outside the diagram.
  const days = [
    ...courses.flatMap((course) => [course.studyStart, course.studyEnd]),
    ...shownPhases.flatMap((phase) => [phase.startDate, phase.endDate]),
  ].toSorted();
  const startDate = days[0];
  const endDate = days[days.length - 1];
  const axisDays = inclusiveDays(startDate, endDate);

  function span(from: string, to: string): TimelineSpan {
    return {
      startDate: from,
      endDate: to,
      offset: round(((inclusiveDays(startDate, from) - 1) / axisDays) * 100),
      width: round((inclusiveDays(from, to) / axisDays) * 100),
    };
  }

  const firstYear = Number(startDate.slice(0, 4));
  const lastYear = Number(endDate.slice(0, 4));
  const years: TimelineYear[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    years.push({
      year,
      ...span(year === firstYear ? startDate : `${year}-01-01`, year === lastYear ? endDate : `${year}-12-31`),
    });
  }

  const lanes = groupComparableCourses(courses, shownPhases).map((group) => {
    const ownPhases = shownPhases
      .filter((phase) => phase.courseId === group.courses[0].id)
      .toSorted((left, right) => left.startDate.localeCompare(right.startDate));
    return {
      codes: group.courses.map((course) => course.code),
      bars: ownPhases.map((phase) => ({ type: phase.type, ...span(phase.startDate, phase.endDate) })),
      semesters: laneSemesters(ownPhases, span),
    };
  });

  return { startDate, endDate, years, lanes, sharedSemesters: sharedSemesters(lanes) };
}

function sharedSemesters(lanes: TimelineLane[]): TimelineSemester[] | null {
  const key = (lane: TimelineLane) => lane.semesters.map((entry) => `${entry.semester} ${entry.startDate} ${entry.endDate}`).join("|");
  const first = key(lanes[0]);
  return lanes.every((lane) => key(lane) === first) ? lanes[0].semesters : null;
}

/**
 * Where each semester of one lane begins and ends. The bounds belong to the lane rather than to the diagram, because
 * the same semester may cover different periods in different courses (ADR 0006); one band across all lanes
 * would claim a shared schedule that the block plan does not guarantee.
 */
function laneSemesters(phases: CoursePhase[], span: (from: string, to: string) => TimelineSpan): TimelineSemester[] {
  const bounds = new Map<number, { startDate: string; endDate: string }>();
  for (const phase of phases) {
    const known = bounds.get(phase.semester);
    if (!known) {
      bounds.set(phase.semester, { startDate: phase.startDate, endDate: phase.endDate });
      continue;
    }
    if (phase.startDate < known.startDate) known.startDate = phase.startDate;
    if (phase.endDate > known.endDate) known.endDate = phase.endDate;
  }
  return [...bounds.entries()]
    .toSorted(([left], [right]) => left - right)
    .map(([semester, bound]) => ({ semester, ...span(bound.startDate, bound.endDate) }));
}
