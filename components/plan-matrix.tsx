"use client";

import { useId, useState, type MouseEvent } from "react";

import { PlanTimeline } from "@/components/plan-timeline";
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
  const matrixHeadingId = useId();
  const filterLabelId = useId();
  const filterHintId = useId();
  const visibleCourses = courses.filter((course) => visibleCourseIds.has(course.id));
  const courseCodes = new Map(courses.map((course) => [course.id, course.code]));
  // Every course of a block plan carries the same number of semesters (FACHLICHE_REGELN.md); hiding columns therefore
  // never removes a semester table.
  const semesters = Math.max(...courses.map((course) => course.semesters), 0);
  const semesterRows = Array.from({ length: semesters }, (_, index) => buildSemesterMatrix(visibleCourses, phases, index + 1));
  // The legend explains what the section actually shows: a complete plan never says that a course misses a semester,
  // and a draft under review may. It is drawn from the whole year group rather than from the visible columns, because
  // it names overview and matrix alike and the overview keeps the lane of a course the matrix hides.
  const legendRows = Array.from({ length: semesters }, (_, index) => buildSemesterMatrix(courses, phases, index + 1));
  const shownCells = new Set(legendRows.flatMap((rows) => (rows.length ? rows.flatMap((row) => row.cells) : [noPhaseLabel])));
  const legend = [phaseTypeLabel("THEORY"), phaseTypeLabel("PRACTICE"), noPhaseLabel].filter((cell) => shownCells.has(cell));

  function toggleCourse(course: DraftCourse) {
    const next = new Set(visibleCourseIds);
    if (next.has(course.id)) next.delete(course.id); else next.add(course.id);
    setVisibleCourseIds(next);
    setStatus(`${course.code} ${next.has(course.id) ? "eingeblendet" : "ausgeblendet"}. ${next.size} von ${courses.length} Kursen sichtbar.`);
  }

  /**
   * Reducing the columns must not empty the matrix, so the last visible course carries the refusal itself instead of
   * accepting the click and undoing it: the checkbox is marked as disabled, keeps its focus and names the rule through
   * the hint of the filter. Preventing the default of the click covers the pointer and the space key alike, because a
   * checkbox is activated by a click event either way. React derives its change event from that same click and fires
   * it regardless, so the change handler has to stand down on its own as well.
   */
  function refuseHiding(event: MouseEvent<HTMLInputElement>, course: DraftCourse) {
    event.preventDefault();
    setStatus(`${course.code} bleibt sichtbar: Mindestens ein Kurs muss in der Planmatrix angezeigt werden.`);
  }

  return <>
    <section aria-labelledby="plan-heading">
      {/* Overview and matrix show the same course of study in two ways and rank equally; the section names the subject
          both of them are about. */}
      <div className="plan-section-head">
        <h2 id="plan-heading" className="eyebrow">Studienverlauf</h2>
        {/* Both views draw a phase type in the same language, so it is named once for the section and above the first
            of them — the overview would otherwise be read before anything has said what its fills mean. The legend
            explains, it does not act, so it carries no frame, no surface and no state of its own. It is hidden from
            assistive technology, which is given the full label in every cell of the matrix and would only hear the
            abbreviations explained that it never encounters. */}
        <ul className="phase-legend" aria-hidden="true">{legend.map((cell) => {
          const { phase, abbreviation } = phaseCell(cell);
          return <li key={cell}><span data-phase={phase}>{abbreviation}</span> {cell}</li>;
        })}</ul>
      </div>
      {/* The diagram carries its statement through area, length and position, so it stays hidden from assistive
          technology together with its heading and its note. The matrix below carries the same plan completely, named in
          words and with the dates the diagram only shows as lengths (BARRIEREFREIHEIT.md). */}
      <div className="plan-block plan-overview" aria-hidden="true">
        <h3>Überblick</h3>
        {/* The overview always draws the whole year group, so a course hidden in the matrix keeps its lane here. */}
        <p className="plan-block__note">Die Übersicht zeigt unabhängig von der Auswahl alle Kurse des Jahrgangs.</p>
        <PlanTimeline courses={courses} phases={phases} />
      </div>
      <div className="plan-block">
        <h3 id={matrixHeadingId}>Planmatrix</h3>
        <p className="plan-block__note">
          Je Zeilengruppe wird ein Semester und je Spalte ein Kurs dargestellt. Auf schmalen Bildschirmen kann die
          Tabelle horizontal gescrollt werden.
        </p>
        <div className="matrix-card">
          {/* The head of the card carries what the table needs but must not scroll away with it: the selection of the
              columns. It stays outside the scrolling region — a course hidden there could otherwise no longer be
              brought back once its column has scrolled off. */}
          <div className="matrix-header">
            <div className="course-filter" role="group" aria-labelledby={filterLabelId} aria-describedby={filterHintId}>
              <p id={filterLabelId} className="course-filter__label">Sichtbare Kurse:</p>
              <div className="course-filter__options">{courses.map((course) => {
                const checked = visibleCourseIds.has(course.id);
                const locked = checked && visibleCourseIds.size === 1;
                return <label key={course.id} data-locked={locked ? "" : undefined}>
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-disabled={locked || undefined}
                    aria-describedby={locked ? filterHintId : undefined}
                    onClick={locked ? (event) => refuseHiding(event, course) : undefined}
                    onChange={() => { if (!locked) toggleCourse(course); }}
                  /> {course.code}
                  {/* The code alone names the column; what ticking it does is said for assistive technology only. */}
                  <span className="sr-only"> in der Planmatrix anzeigen</span>
                </label>;
              })}</div>
              {/* The rule stands whether or not it currently bites, so the line is always there and the filter never
                  changes height under the pointer. */}
              <p id={filterHintId} className="course-filter__hint">Mindestens ein Kurs muss sichtbar bleiben.</p>
            </div>
          </div>
          <p className="sr-only" role="status">{status}</p>
          {/* Table and scrollable region are named by the heading of the block; a title of their own would say
              „Studienverlauf“ a third time, under a section and a heading that both say it already. */}
          <div className="matrix-wrap" role="region" aria-labelledby={matrixHeadingId} tabIndex={0}>
            <table className="matrix" aria-labelledby={matrixHeadingId}>
              <thead><tr>
                {/* The column measures the row, a merged phase cell states its own length: the heading says which of
                    the two a duration belongs to. */}
                <th scope="col">Semester</th><th scope="col">Zeitraum</th><th scope="col">Dauer des Abschnitts</th>
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
        </div>
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
