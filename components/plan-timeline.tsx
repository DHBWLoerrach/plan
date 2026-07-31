import { useEffect, useRef, useState, type CSSProperties } from "react";

import { formatCompactDuration } from "@/lib/domain/calendar-format";
import { assumedLabelWidth, buildPlanTimeline, flagNarrowBars, type TimelineBar, type TimelineSemester } from "@/lib/domain/plan-timeline";
import type { CoursePlan, CoursePhase } from "@/lib/domain/publication";

/** The air a label keeps to the edges of the bar it sits in and to the label beside it, in pixels. */
const labelAir = 8;

/** The percentage of the axis a span covers, as the inline geometry of the diagram. */
function place({ offset, width }: { offset: number; width: number }) {
  return { left: `${offset}%`, width: `${width}%` };
}

function phaseName(type: TimelineBar["type"]): string {
  return type === "THEORY" ? "theory" : "practice";
}

function barLabel(bar: TimelineBar): string {
  return formatCompactDuration(bar.startDate, bar.endDate);
}

function SemesterBand({ semesters }: { semesters: TimelineSemester[] }) {
  return <div className="timeline-track">
    {semesters.map((semester) => <span key={semester.semester} className="timeline-semester" style={place(semester)}>
      Sem {semester.semester}
    </span>)}
  </div>;
}

/** What the browser has measured of the drawn diagram: the width of the axis and of every label on it, in pixels. */
interface Measurement {
  axis: number;
  labels: Record<string, number>;
}

/**
 * How much room each label needs, measured where it is decided: in the browser. Whether a bar can hold its label is a
 * question of pixels — the label keeps its size while the axis grows and shrinks with the window and with the text
 * size — so a share of the axis fixed here would fit one window width and clip the labels at every smaller one.
 */
function useLabelWidths(labels: string[]) {
  const [measured, setMeasured] = useState<Measurement | null>(null);
  const axis = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const drawn = labels.join("|");

  useEffect(() => {
    const axisNode = axis.current;
    const probeNode = probe.current;
    if (!axisNode || !probeNode) return;
    const measure = () => {
      const width = axisNode.clientWidth;
      if (!width) return;
      const widths: Record<string, number> = {};
      for (const node of probeNode.children) widths[node.textContent ?? ""] = node.getBoundingClientRect().width;
      setMeasured({ axis: width, labels: widths });
    };
    // The axis reports every change of the window, the probe every change of the text size.
    const observer = new ResizeObserver(measure);
    observer.observe(axisNode);
    observer.observe(probeNode);
    return () => observer.disconnect();
  }, [drawn]);

  function labelWidth(bar: TimelineBar): number {
    if (!measured) return assumedLabelWidth;
    return ((measured.labels[barLabel(bar)] ?? 0) + labelAir) / measured.axis * 100;
  }

  return { labelWidth, axis, probe };
}

/**
 * The overview above the matrix: the whole block plan on one time axis, with one lane per course. The card carries
 * the diagram alone; heading, note and the rule that it stays hidden from assistive technology and from narrow screens
 * belong to the block around it (BARRIEREFREIHEIT.md).
 */
export function PlanTimeline({ courses, phases }: { courses: CoursePlan[]; phases: CoursePhase[] }) {
  const timeline = buildPlanTimeline(courses, phases);
  const drawnLabels = [...new Set(timeline?.lanes.flatMap((lane) => lane.bars.map(barLabel)) ?? [])];
  const { labelWidth, axis, probe } = useLabelWidths(drawnLabels);
  if (!timeline) return null;

  return <div className="timeline">
    {/* Every label the diagram draws, out of flow and out of sight, so each of them can be measured. */}
    <div className="timeline-probe" ref={probe}>
      {drawnLabels.map((label) => <span key={label}>{label}</span>)}
    </div>
    {/* The years are a band of their own above the semester band, so each number stands in its own section and the
        boundaries are the edges of those sections — the diagram itself stays free of vertical lines. The band spans
        the axis, which makes it the one to measure the axis on. */}
    <div className="timeline-years" ref={axis}>
      {timeline.years.map((year) => <span key={year.year} style={place(year)}>{year.year}</span>)}
    </div>
    {timeline.sharedSemesters ? <SemesterBand semesters={timeline.sharedSemesters} /> : null}
    {timeline.lanes.map((lane) => {
      const flags = flagNarrowBars(lane.bars, labelWidth);
      const rows = flags.length ? Math.max(...flags.map((flag) => flag.row)) + 1 : 0;
      return <div key={lane.codes.join(" ")} className="timeline-lane">
        <p className="timeline-codes">{lane.codes.join(" · ")}</p>
        {timeline.sharedSemesters ? null : <SemesterBand semesters={lane.semesters} />}
        <div className="timeline-track timeline-bars">
          {lane.bars.map((bar) => <span key={bar.startDate} data-phase={phaseName(bar.type)} style={place(bar)}>
            {flags.some((flag) => flag.bar === bar) ? null : barLabel(bar)}
          </span>)}
        </div>
        {/* A phase too short for its own label states the length below the bars, on a line leading up to it. */}
        {rows ? <div className="timeline-flags" style={{ "--flag-rows": rows } as CSSProperties}>
          {flags.map((flag) => <span
            key={flag.bar.startDate}
            style={{ left: `${flag.center}%`, "--flag-row": flag.row } as CSSProperties}
          >{barLabel(flag.bar)}</span>)}
        </div> : null}
      </div>;
    })}
    {/* The phase types are named by the legend above the section, which resolves the abbreviations of the matrix in
        the same fills; only the lengths are read here and are explained here. */}
    <p className="timeline-legend">Dauer der Phase (im oder unter dem Balken; Wo. = Wochen, T. = Tage)</p>
  </div>;
}
