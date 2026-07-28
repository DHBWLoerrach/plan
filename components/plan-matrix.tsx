"use client";

import { useId, useState } from "react";

import { formatCalendarPeriod, formatPeriodDuration } from "@/lib/domain/calendar-format";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel } from "@/lib/domain/phase-type";
import { buildSemesterMatrix, deriveEventSemester, noPhaseLabel, type DraftCourse, type DraftEvent, type DraftPhase, type MatrixRow } from "@/lib/domain/publication";

/**
 * How a matrix cell shows the phase label the domain produced: the full label stays in the cell for assistive
 * technology, while sighted readers see the abbreviation the legend resolves. Fill and hatching only support that
 * text, they never carry the phase alone (BARRIEREFREIHEIT.md).
 */
function phaseCell(cell: string): { phase: string; abbreviation: string } {
  if (cell === phaseTypeLabel("THEORY")) return { phase: "theory", abbreviation: "T" };
  if (cell === phaseTypeLabel("PRACTICE")) return { phase: "practice", abbreviation: "P" };
  return { phase: "none", abbreviation: "" };
}

interface PhaseBlock {
  column: number;
  cell: string;
  rowSpan: number;
  duration: string;
}

/**
 * The phase blocks each row of a semester starts. The rows are cut at the phase boundaries of every course, so one
 * phase of one course can cover several rows; those rows become one cell that carries the phase and its length
 * exactly once, instead of repeating the phase and leaving the reader to add the rows up.
 */
function buildPhaseBlocks(rows: MatrixRow[]): PhaseBlock[][] {
  const blocks: PhaseBlock[][] = rows.map(() => []);
  for (let column = 0; column < (rows[0]?.cells.length ?? 0); column += 1) {
    for (let index = 0; index < rows.length;) {
      const cell = rows[index].cells[column];
      let last = index;
      while (rows[last + 1]?.cells[column] === cell) last += 1;
      // Pushed column by column, so the cells of a row stay in the order of their columns.
      blocks[index].push({ column, cell, rowSpan: last - index + 1, duration: formatPeriodDuration(rows[index].startDate, rows[last].endDate) });
      index = last + 1;
    }
  }
  return blocks;
}

function PhaseCell({ cell, rowSpan = 1, duration }: { cell: string; rowSpan?: number; duration?: string }) {
  const { phase, abbreviation } = phaseCell(cell);
  return <td data-phase={phase} rowSpan={rowSpan > 1 ? rowSpan : undefined}>
    <span className="sr-only">{cell}</span>
    {abbreviation ? <span aria-hidden="true">{abbreviation}</span> : null}
    {/* The merged cell states its own length, because the duration column beside it measures the row, not the phase. */}
    {/* The duration stays on one line, so a cell too narrow for the whole label breaks after the word before it
        instead of somewhere inside the duration. */}
    {abbreviation && rowSpan > 1 ? <span className="matrix-block-duration">Gesamt: <span>{duration}</span></span> : null}
  </td>;
}

export function PlanMatrix({ courses, phases, events }: { courses: DraftCourse[]; phases: DraftPhase[]; events: DraftEvent[] }) {
  const [visibleCourseIds, setVisibleCourseIds] = useState(() => new Set(courses.map((course) => course.id)));
  const [status, setStatus] = useState("");
  const captionId = useId();
  const visibleCourses = courses.filter((course) => visibleCourseIds.has(course.id));
  const courseCodes = new Map(courses.map((course) => [course.id, course.code]));
  // Every course of a block plan carries the same number of semesters (FACHLICHE_REGELN.md); hiding columns therefore
  // never removes a semester table.
  const semesters = Math.max(...courses.map((course) => course.semesters), 0);
  const semesterRows = Array.from({ length: semesters }, (_, index) => buildSemesterMatrix(visibleCourses, phases, index + 1));
  // The legend explains what the matrix actually shows: a complete plan never says that a course misses a semester,
  // and a draft under review may.
  const shownCells = new Set(semesterRows.flatMap((rows) => (rows.length ? rows.flatMap((row) => row.cells) : [noPhaseLabel])));
  const legend = [phaseTypeLabel("THEORY"), phaseTypeLabel("PRACTICE"), noPhaseLabel].filter((cell) => shownCells.has(cell));

  function toggleCourse(course: DraftCourse) {
    const next = new Set(visibleCourseIds);
    if (!next.has(course.id)) {
      next.add(course.id);
    } else if (next.size === 1) {
      // Reducing the columns must not empty the matrix; the course stays selectable and the refusal is announced.
      setStatus(`${course.code} bleibt sichtbar: Mindestens ein Kurs muss in der Planmatrix angezeigt werden.`);
      return;
    } else {
      next.delete(course.id);
    }
    setVisibleCourseIds(next);
    setStatus(`${course.code} ${next.has(course.id) ? "eingeblendet" : "ausgeblendet"}. ${next.size} von ${courses.length} Kursen sichtbar.`);
  }

  return <>
    <section aria-labelledby="matrix-heading">
      <div className="section-heading">
        <p className="eyebrow">Studienverlauf</p>
        <h2 id="matrix-heading">Planmatrix</h2>
        <p>Je Zeilengruppe ein Semester, je Spalte ein Kurs; auf schmalen Anzeigen ist die Tabelle waagerecht scrollbar.</p>
      </div>
      <fieldset className="course-selector">
        <legend>Sichtbare Kurse in der Planmatrix</legend>
        {/* Which courses are shown is readable from the checkboxes themselves; only the change is announced. */}
        <p>Mindestens ein Kurs bleibt sichtbar; Planinhalte verändert die Auswahl nicht.</p>
        {courses.map((course) => <label key={course.id}>
          <input type="checkbox" checked={visibleCourseIds.has(course.id)} onChange={() => toggleCourse(course)} /> {course.code}
        </label>)}
      </fieldset>
      <p className="sr-only" role="status">{status}</p>
      <div className="matrix-wrap" role="region" aria-labelledby={captionId} tabIndex={0}>
        <table className="matrix">
          {/* The legend sits under the table title, where the abbreviations it resolves are about to be read. It is
              hidden from assistive technology, which is given the full label in every cell and would only hear the
              abbreviations explained that it never encounters. The region is named by the title alone. */}
          <caption>
            <span id={captionId}>Studienverlauf je Semester</span>
            <ul className="matrix-legend" aria-hidden="true">{legend.map((cell) => {
              const { phase, abbreviation } = phaseCell(cell);
              return <li key={cell}><span data-phase={phase}>{abbreviation}</span> {cell}</li>;
            })}</ul>
          </caption>
          <thead><tr>
            <th scope="col">Semester</th><th scope="col">Zeitraum</th><th scope="col">Dauer</th>
            {visibleCourses.map((course) => <th key={course.id} className="matrix-course" scope="col">{course.code}</th>)}
          </tr></thead>
          {semesterRows.map((rows, semesterIndex) => {
            const semester = semesterIndex + 1;
            const blocks = buildPhaseBlocks(rows);
            // One row group per semester: the semester cell spans the group's rows and stays its programmatic heading.
            const semesterHeading = (rowSpan: number) => <th className="matrix-semester" scope="rowgroup" rowSpan={rowSpan}>Semester {semester}</th>;
            return <tbody key={semester}>{rows.length
              ? rows.map((row, index) => <tr key={row.startDate}>
                {index === 0 ? semesterHeading(rows.length) : null}
                <th scope="row">{formatCalendarPeriod(row.startDate, row.endDate)}</th>
                <td className="matrix-duration">{formatPeriodDuration(row.startDate, row.endDate)}</td>
                {blocks[index].map((block) => <PhaseCell key={visibleCourses[block.column].id} {...block} />)}
              </tr>)
              : <tr>
                {semesterHeading(1)}
                <th scope="row">Kein Zeitraum</th>
                <td className="matrix-duration">Keine</td>
                {visibleCourses.map((course) => <PhaseCell key={course.id} cell={noPhaseLabel} />)}
              </tr>}</tbody>;
          })}
        </table>
      </div>
    </section>
    <section aria-labelledby="events-heading">
      <div className="section-heading">
        <p className="eyebrow">Prüfungsrelevante Termine</p>
        <h2 id="events-heading">Termine</h2>
        <p>Chronologisch über alle Semester, mit dem je betroffenem Kurs abgeleiteten Semester.</p>
      </div>
      {events.length ? <div className="matrix-wrap" role="region" aria-labelledby="events-table-caption" tabIndex={0}>
        <table className="event-table">
          <caption id="events-table-caption">Prüfungsrelevante Termine in chronologischer Reihenfolge</caption>
          <thead><tr>
            <th scope="col">Zeitangabe</th><th scope="col">Kategorie</th><th scope="col">Titel</th><th scope="col">Betroffene Kurse und Semester</th>
          </tr></thead>
          <tbody>{events.map((event) => <tr key={event.id}>
            <td>
              {formatCalendarPeriod(event.startDate, event.endDate ?? event.startDate)}
              {event.provisional ? <span className="provisional">Vorläufig</span> : null}
            </td>
            <td>{eventCategoryLabel(event.category)}</td>
            <td>
              <strong>{event.title}</strong>
              {event.description ? <span className="event-description">{event.description}</span> : null}
            </td>
            <td><ul className="event-courses">{event.courseIds.map((courseId) => {
              const semester = deriveEventSemester(phases, courseId, event.startDate);
              return <li key={courseId}>{courseCodes.get(courseId)}: {semester ? `Semester ${semester}` : "Semester nicht ableitbar"}</li>;
            })}</ul></td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="empty-note">Für diesen Plan sind keine prüfungsrelevanten Termine veröffentlicht.</p>}
    </section>
  </>;
}
