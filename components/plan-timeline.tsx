import type { CSSProperties } from "react";

import { formatCompactDuration } from "@/lib/domain/calendar-format";
import { phaseTypeLabel } from "@/lib/domain/phase-type";
import { buildPlanTimeline, flagNarrowBars, type TimelineBar, type TimelineSemester } from "@/lib/domain/plan-timeline";
import type { DraftCourse, DraftPhase } from "@/lib/domain/publication";

/** The percentage of the axis a span covers, as the inline geometry of the diagram. */
function place({ offset, width }: { offset: number; width: number }) {
  return { left: `${offset}%`, width: `${width}%` };
}

function phaseName(type: TimelineBar["type"]): string {
  return type === "THEORY" ? "theory" : "practice";
}

function SemesterBand({ semesters }: { semesters: TimelineSemester[] }) {
  return <div className="timeline-track">
    {semesters.map((semester) => <span key={semester.semester} className="timeline-semester" style={place(semester)}>
      Sem {semester.semester}
    </span>)}
  </div>;
}

/**
 * The overview above the matrix: the whole block plan on one time axis, with courses that run identically drawn as a
 * single lane. It is hidden from assistive technology and from narrow screens, because the matrix below carries the
 * same plan completely, with the dates the diagram only shows as lengths (BARRIEREFREIHEIT.md).
 */
export function PlanTimeline({ courses, phases }: { courses: DraftCourse[]; phases: DraftPhase[] }) {
  const timeline = buildPlanTimeline(courses, phases);
  if (!timeline) return null;

  return <div className="timeline" aria-hidden="true">
    {/* Paired with the caption of the matrix below, which reads „Studienverlauf je Semester“. */}
    <p className="timeline-title">Studienverlauf im Überblick</p>
    {/* The years are a band of their own above the semester band, so each number stands in its own section and the
        boundaries are the edges of those sections — the diagram itself stays free of vertical lines. */}
    <div className="timeline-years">
      {timeline.years.map((year) => <span key={year.year} style={place(year)}>{year.year}</span>)}
    </div>
    {timeline.sharedSemesters ? <SemesterBand semesters={timeline.sharedSemesters} /> : null}
    {timeline.lanes.map((lane) => {
      const flags = flagNarrowBars(lane.bars);
      const rows = flags.length ? Math.max(...flags.map((flag) => flag.row)) + 1 : 0;
      return <div key={lane.codes.join(" ")} className="timeline-lane">
        <p className="timeline-codes">{lane.codes.join(" · ")}</p>
        {timeline.sharedSemesters ? null : <SemesterBand semesters={lane.semesters} />}
        <div className="timeline-track timeline-bars">
          {lane.bars.map((bar) => <span key={bar.startDate} data-phase={phaseName(bar.type)} style={place(bar)}>
            {flags.some((flag) => flag.bar === bar) ? null : formatCompactDuration(bar.startDate, bar.endDate)}
          </span>)}
        </div>
        {/* A phase too short for its own label states the length below the bars, on a line leading up to it. */}
        {rows ? <div className="timeline-flags" style={{ "--flag-rows": rows } as CSSProperties}>
          {flags.map((flag) => <span
            key={flag.bar.startDate}
            style={{ left: `${flag.center}%`, "--flag-row": flag.row } as CSSProperties}
          >{formatCompactDuration(flag.bar.startDate, flag.bar.endDate)}</span>)}
        </div> : null}
      </div>;
    })}
    <ul className="timeline-legend">
      <li><span data-phase="theory" /> {phaseTypeLabel("THEORY")}</li>
      <li><span data-phase="practice" /> {phaseTypeLabel("PRACTICE")}</li>
      <li>Dauer der Phase (im oder unter dem Balken; Wo. = Wochen, T. = Tage)</li>
    </ul>
  </div>;
}
