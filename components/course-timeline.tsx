"use client";

import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle";
import { useState, type CSSProperties, type ReactNode } from "react";

import type { CourseTimeline, TimelineRow } from "@/lib/domain/course-detail";

import styles from "./course-detail.module.css";

const at = (left: number): CSSProperties => ({ left: `${left}%` });

function Track({ row, selected }: { row: TimelineRow; selected: string | undefined }) {
  return <div className={styles.track} data-marks={row.marks.length ? "" : undefined} data-today={row.today === null ? undefined : ""} style={{ "--levels": row.levels } as CSSProperties}>
    <div className={styles.trackGround} aria-hidden="true" />
    {row.marks.length ? <div className={styles.lane} aria-hidden="true" /> : null}
    {row.segments.map((segment) => <div key={segment.key} className={styles.segment} data-phase={segment.phase} title={segment.title} aria-hidden="true"
      style={{ ...at(segment.left), width: `${segment.width}%` }}>{segment.label}</div>)}
    {row.semesterStarts.map((start) => <span key={start.semester} aria-hidden="true">
      <span className={styles.semesterStart} style={at(start.left)} />
      <span className={styles.semesterLabel} style={at(start.left)}>{start.semester}. Sem.</span>
    </span>)}
    {row.today === null ? null : <span aria-hidden="true">
      <span className={styles.today} style={at(row.today)} />
      <span className={styles.todayBadge} style={at(row.today)}>heute</span>
    </span>}
    {row.marks.map((mark) => {
      const place = { "--level": mark.level, "--center": `${mark.left + mark.width / 2}%`, "--span": `${mark.width}%` } as CSSProperties;
      return <span key={mark.key}>
        {mark.target ? <Toggle value={mark.id} aria-label={mark.text} title={mark.text} className={styles.markButton} style={place} /> : null}
        <span className={styles.mark} aria-hidden="true" style={place} data-span={mark.span ? "" : undefined}
          data-provisional={mark.provisional ? "" : undefined} data-selected={mark.id === selected ? "" : undefined} />
      </span>;
    })}
  </div>;
}

// The bars repeat the table of phases and stay hidden from assistive technology. The dates are toggles in one group,
// so a tap names a mark too small to be labelled and a single tab stop leads through all of them.
export function CourseTimelineView({ timeline }: { timeline: CourseTimeline }) {
  const [selected, setSelected] = useState<string[]>([]);
  const marks = timeline.rows.flatMap((row) => row.marks.filter((mark) => mark.target));
  const chosen = marks.find((mark) => mark.id === selected[0]);

  const rows: ReactNode = <>
    <div aria-hidden="true" />
    <div className={styles.months} aria-hidden="true">
      {timeline.months.map((month) => <span key={month.left} style={at(month.left)}>{month.label}</span>)}
    </div>
    {timeline.rows.map((row) => <div key={row.label} className={styles.rowContents}>
      <p className={styles.rowLabel} data-today={row.today === null ? undefined : ""}><span>{row.label}</span> <span>{row.detail}</span></p>
      <Track row={row} selected={selected[0]} />
    </div>)}
  </>;

  return <div className={styles.timeline}>
    <div className={styles.timelineScroll} role="region" aria-label="Zeitleiste, seitlich scrollbar" tabIndex={0}>
      {marks.length
        ? <ToggleGroup className={styles.timelineGrid} aria-label="Termine in der Zeitleiste" value={selected} onValueChange={setSelected}>{rows}</ToggleGroup>
        : <div className={styles.timelineGrid}>{rows}</div>}
    </div>
    {marks.length ? <p className={styles.selection} role="status">
      {chosen ? chosen.text : "Wählen Sie einen Termin in der Zeitleiste, um Datum und Titel zu sehen."}
    </p> : null}
  </div>;
}
