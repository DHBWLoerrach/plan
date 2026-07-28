"use client";

import { useId, useState } from "react";

import { formatCalendarPeriod, formatPeriodDuration } from "@/lib/domain/calendar-format";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel } from "@/lib/domain/phase-type";
import { buildSemesterMatrix, deriveEventSemester, type DraftCourse, type DraftEvent, type DraftPhase, type MatrixRow } from "@/lib/domain/publication";

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

/**
 * How a cell relates to the equal phases above and below it in its column. The rows of a semester are cut at the phase
 * boundaries of every course, so one phase of one course can span several rows: the run lets the coloured edge close
 * over those cuts, and the block duration names the length the duration column cannot name, because that column
 * measures the row. It is stated once at the top of a block and only where the block outlasts its row, so that the
 * plan never leaves the reader to add the rows up.
 */
function phaseBlock(rows: MatrixRow[], index: number, column: number): { run?: string; blockDuration?: string } {
  const cell = rows[index].cells[column];
  const above = rows[index - 1]?.cells[column] === cell;
  const below = rows[index + 1]?.cells[column] === cell;
  if (!above && !below) return {};
  if (above) return { run: below ? "middle" : "end" };
  let last = index;
  while (rows[last + 1]?.cells[column] === cell) last += 1;
  return { run: "start", blockDuration: formatPeriodDuration(rows[index].startDate, rows[last].endDate) };
}

function PhaseCell({ cell, run, blockDuration }: { cell: string; run?: string; blockDuration?: string }) {
  const { phase, abbreviation } = phaseCell(cell);
  return <td data-phase={phase} data-run={run}>
    <span className="sr-only">{cell}</span>
    {abbreviation ? <span aria-hidden="true">{abbreviation}</span> : null}
    {abbreviation && blockDuration ? <span className="matrix-block-duration">{blockDuration}</span> : null}
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
      <ul className="matrix-legend">
        <li><span data-phase="theory" aria-hidden="true">T</span> {phaseTypeLabel("THEORY")}</li>
        <li><span data-phase="practice" aria-hidden="true">P</span> {phaseTypeLabel("PRACTICE")}</li>
        <li><span data-phase="none" aria-hidden="true" /> Nicht in diesem Semester</li>
      </ul>
      <div className="matrix-wrap" role="region" aria-labelledby={captionId} tabIndex={0}>
        <table className="matrix">
          <caption id={captionId}>Studienverlauf je Semester</caption>
          <thead><tr>
            <th scope="col">Semester</th><th scope="col">Zeitraum</th><th scope="col">Dauer</th>
            {visibleCourses.map((course) => <th key={course.id} scope="col">{course.code}</th>)}
          </tr></thead>
          {Array.from({ length: semesters }, (_, index) => index + 1).map((semester) => {
            const rows = buildSemesterMatrix(visibleCourses, phases, semester);
            // One row group per semester: the semester cell spans the group's rows and stays its programmatic heading.
            const semesterHeading = (rowSpan: number) => <th className="matrix-semester" scope="rowgroup" rowSpan={rowSpan}>Semester {semester}</th>;
            return <tbody key={semester}>{rows.length
              ? rows.map((row, index) => <tr key={row.startDate}>
                {index === 0 ? semesterHeading(rows.length) : null}
                <th scope="row">{formatCalendarPeriod(row.startDate, row.endDate)}</th>
                <td className="matrix-duration">{formatPeriodDuration(row.startDate, row.endDate)}</td>
                {row.cells.map((cell, cellIndex) => <PhaseCell key={visibleCourses[cellIndex].id} cell={cell} {...phaseBlock(rows, index, cellIndex)} />)}
              </tr>)
              : <tr>
                {semesterHeading(1)}
                <th scope="row">Kein Zeitraum</th>
                <td className="matrix-duration">Keine</td>
                {visibleCourses.map((course) => <PhaseCell key={course.id} cell="Nicht in diesem Semester" />)}
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
