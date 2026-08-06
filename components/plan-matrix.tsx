"use client";

import { Fragment, useId, useState, type MouseEvent, type ReactNode } from "react";

import { PlanTimeline } from "@/components/plan-timeline";
import { formatCalendarPeriod, formatPeriodDuration } from "@/lib/domain/calendar-format";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import { groupComparableCourses, groupComparableEvents, type ComparableCourseGroup } from "@/lib/domain/plan-comparison";
import { phaseTypeLabel } from "@/lib/domain/phase-type";
import { buildSemesterMatrix, deriveEventSemester, noPhaseLabel, type CoursePlan, type CourseEvent, type CoursePhase, type MatrixRow } from "@/lib/domain/publication";

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
  group: ComparableCourseGroup;
  cell: string;
  rowSpan: number;
  duration: string;
  headers: string;
}

/**
 * The phase blocks each row of a semester starts. The rows are cut at the phase boundaries of every course, so one
 * phase of one course can cover several rows; those rows become one cell that carries the phase and its length
 * exactly once, instead of repeating the phase and leaving the reader to add the rows up.
 */
function buildPhaseBlocks(rows: MatrixRow[], groups: ComparableCourseGroup[], semester: number): PhaseBlock[][] {
  const blocks: PhaseBlock[][] = rows.map(() => []);
  for (let column = 0; column < (rows[0]?.cells.length ?? 0); column += 1) {
    for (let index = 0; index < rows.length;) {
      const cell = rows[index].cells[column];
      let last = index;
      while (rows[last + 1]?.cells[column] === cell) last += 1;
      // Pushed column by column, so the cells of a row stay in the order of their columns.
      blocks[index].push({
        group: groups[column],
        cell,
        rowSpan: last - index + 1,
        duration: formatPeriodDuration(rows[index].startDate, rows[last].endDate),
        headers: [
          `matrix-semester-${semester}`,
          ...rows.slice(index, last + 1).map((row) => `matrix-period-${semester}-${row.startDate}`),
          ...groups[column].courses.map((course) => `matrix-course-${course.id}`),
        ].join(" "),
      });
      index = last + 1;
    }
  }
  return blocks;
}

function PhaseCell({ cell, group, headers, rowSpan = 1, duration }: { cell: string; group: ComparableCourseGroup; headers: string; rowSpan?: number; duration?: string }) {
  const { phase, abbreviation } = phaseCell(cell);
  return <td data-phase={phase} headers={headers}
    colSpan={group.courses.length > 1 ? group.courses.length : undefined} rowSpan={rowSpan > 1 ? rowSpan : undefined}>
    <span className="sr-only">{cell}</span>
    {abbreviation ? <span aria-hidden="true">{abbreviation}</span> : null}
    {/* The merged cell states its own length, because the duration column beside it measures the row, not the phase. */}
    {/* The duration stays on one line, so a cell too narrow for the whole label breaks after the word before it
        instead of somewhere inside the duration. */}
    {abbreviation && rowSpan > 1 ? <span className="matrix-block-duration">Gesamt: <span>{duration}</span></span> : null}
  </td>;
}

/**
 * `primaryCourseId` names the one course a view is about while the others merely stand beside it for comparison. Its
 * column is marked and cannot be hidden — a comparison without its subject would compare nothing. A public cut names
 * no such course: there all columns rank equally.
 *
 * `unpublishedCourseIds` names the courses whose column is to be marked as not yet published, so their progression is
 * not read as settled (ADR 0011). Only the internal views pass it, and there for every such column including the one
 * being edited — a public cut shows published courses only and marks nothing.
 *
 * `children` are written into the same section below the matrix. The internal course page puts the editable phase
 * list of its course there, so everything about course progressions stands under one heading.
 */
export function PlanMatrix({ courses, phases, primaryCourseId, unpublishedCourseIds, children }: { courses: CoursePlan[]; phases: CoursePhase[]; primaryCourseId?: string; unpublishedCourseIds?: string[]; children?: ReactNode }) {
  const unpublished = new Set(unpublishedCourseIds);
  /**
   * The shown columns, kept together with the courses that selection was made over. Switching the comparison replaces
   * the courses without remounting the matrix, so a selection made over the previous set would leave every newly
   * arriving course hidden and unticked — the switch would appear to have done nothing. The selection is therefore
   * renewed whenever the courses themselves change, which is the one moment the reader asked for other columns.
   */
  const courseKey = JSON.stringify(courses.map((course) => course.id));
  const [shown, setShown] = useState(() => ({ courseKey, ids: new Set(courses.map((course) => course.id)) }));
  if (shown.courseKey !== courseKey) setShown({ courseKey, ids: new Set(courses.map((course) => course.id)) });
  const visibleCourseIds = shown.ids;
  const [status, setStatus] = useState({ message: "", announcement: 0 });
  const matrixHeadingId = useId();
  const filterLabelId = useId();
  const filterHintId = useId();
  const visibleCourses = courses.filter((course) => visibleCourseIds.has(course.id));
  const visibleCourseGroups = groupComparableCourses(visibleCourses, phases);
  // Derive the semester tables from the full cut, so hiding course columns never removes a semester table.
  const semesters = Math.max(...courses.map((course) => course.semesters), 0);
  const semesterRows = Array.from({ length: semesters }, (_, index) => {
    const rows = buildSemesterMatrix(visibleCourses, phases, index + 1);
    const indexByCourseId = new Map(visibleCourses.map((course, courseIndex) => [course.id, courseIndex]));
    return rows.map((row) => ({
      ...row,
      cells: visibleCourseGroups.map((group) => row.cells[indexByCourseId.get(group.courses[0].id)!]),
    }));
  });
  // The legend explains what the section actually shows: a complete plan never says that a course misses a semester,
  // and an incomplete unpublished course may. It is drawn from the whole year group rather than from the visible columns, because
  // it names overview and matrix alike and the overview keeps the lane of a course the matrix hides.
  const legendRows = Array.from({ length: semesters }, (_, index) => buildSemesterMatrix(courses, phases, index + 1));
  const shownCells = new Set(legendRows.flatMap((rows) => (rows.length ? rows.flatMap((row) => row.cells) : [noPhaseLabel])));
  const legend = [phaseTypeLabel("THEORY"), phaseTypeLabel("PRACTICE"), noPhaseLabel].filter((cell) => shownCells.has(cell));

  /**
   * Every announcement is counted, because the same sentence twice in a row would leave the text of the live region
   * unchanged and would therefore be read out only the first time. Refusing to hide the last course is exactly that
   * case: it says the same thing however often it happens, and has to be heard every time.
   */
  function announce(message: string) {
    setStatus((previous) => ({ message, announcement: previous.announcement + 1 }));
  }

  function toggleCourse(course: CoursePlan) {
    const next = new Set(visibleCourseIds);
    if (next.has(course.id)) next.delete(course.id); else next.add(course.id);
    setShown({ courseKey, ids: next });
    announce(`${course.code} ${next.has(course.id) ? "eingeblendet" : "ausgeblendet"}. ${next.size} von ${courses.length} Kursen sichtbar.`);
  }

  /**
   * Reducing the columns must not empty the matrix nor remove the course a view is about, so the affected course
   * carries the refusal itself instead of accepting the click and undoing it: the checkbox is marked as disabled,
   * keeps its focus and names the rule through the hint of the filter. Preventing the default of the click covers the
   * pointer and the space key alike, because a checkbox is activated by a click event either way. React derives its
   * change event from that same click and fires it regardless, so the change handler has to stand down on its own as well.
   */
  function refuseHiding(event: MouseEvent<HTMLInputElement>, course: CoursePlan) {
    event.preventDefault();
    announce(course.id === primaryCourseId
      ? `${course.code} bleibt sichtbar: Der bearbeitete Kurs wird in der Planmatrix immer angezeigt.`
      : `${course.code} bleibt sichtbar: Mindestens ein Kurs muss in der Planmatrix angezeigt werden.`);
  }

  return <section aria-labelledby="plan-heading">
      {/* Overview and matrix show the same course of study in two ways and rank equally; the section names the subject
          both of them are about. */}
      <div className="plan-section-head">
        {/* „Kursverlauf“ is what CONTEXT.md calls the entirety of a course's phases; „Studienverlauf“ is reserved for
            a later subject of the application and would name two different things across the same product. */}
        <h2 id="plan-heading" className="eyebrow">Kursverlauf</h2>
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
        <p className="plan-block__note">Die Übersicht zeigt unabhängig von der Auswahl alle Kurse dieser Darstellung.</p>
        <PlanTimeline courses={courses} phases={phases} />
      </div>
      <div className="plan-block">
        <h3 id={matrixHeadingId}>Planmatrix</h3>
        <p className="plan-block__note">
          Je Zeilengruppe wird ein Semester dargestellt. Kurse mit gleichem Verlauf teilen sich eine Spalte; auf
          schmalen Bildschirmen kann die Tabelle horizontal gescrollt werden.
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
                const locked = checked && (visibleCourseIds.size === 1 || course.id === primaryCourseId);
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
              <p id={filterHintId} className="course-filter__hint">{primaryCourseId
                ? "Der bearbeitete Kurs bleibt sichtbar; mindestens ein Kurs muss angezeigt werden."
                : "Mindestens ein Kurs muss sichtbar bleiben."}</p>
            </div>
          </div>
          {/* A zero width space alternates with every announcement, so a repeated message still changes the text of
              the region. It is the smallest change that carries no meaning of its own: screen readers pass over it,
              while a counter or a suffix would be read out along with the sentence. */}
          <p className="sr-only" role="status">{status.message}{status.announcement % 2 ? "\u200b" : ""}</p>
          {/* Table and scrollable region are named by the heading of the block; a title of their own would say
              „Studienverlauf“ a third time, under a section and a heading that both say it already. */}
          <div className="matrix-wrap" role="region" aria-labelledby={matrixHeadingId} tabIndex={0}>
            <table className="matrix" aria-labelledby={matrixHeadingId}>
              <thead><tr>
                {/* The column measures the row, a merged phase cell states its own length: the heading says which of
                    the two a duration belongs to. */}
                <th scope="col" rowSpan={2}>Semester</th><th scope="col" rowSpan={2}>Zeitraum</th><th scope="col" rowSpan={2}>Dauer des Abschnitts</th>
                {/* The edited course is set in bold within its column heading, which may hold several codes once a
                    compared course shares its whole progression. The mark is repeated in words for assistive
                    technology, which never sees the weight (BARRIEREFREIHEIT.md). The publication state belongs to one
                    course, so its mark stands directly behind the designation it speaks about — and in words for
                    assistive technology, which reads this heading once for the whole column. */}
                {visibleCourseGroups.map((group) => <th key={group.courses.map((course) => course.id).join("-")} className="matrix-course" scope="colgroup"
                  data-primary={group.courses.some((course) => course.id === primaryCourseId) ? "" : undefined}
                  colSpan={group.courses.length > 1 ? group.courses.length : undefined}>
                  {group.courses.map((course, index) => <Fragment key={course.id}>
                    {index ? " · " : ""}{course.id === primaryCourseId ? <strong>{course.code}</strong> : course.code}
                    {unpublished.has(course.id) ? <>
                      <span className="matrix-course__mark" aria-hidden="true">*</span>
                      <span className="sr-only"> (nicht veröffentlicht)</span>
                    </> : null}
                  </Fragment>)}
                </th>)}
              </tr>{/* The per-course heading is what every cell of the column refers to, so it carries the designation
                and nothing that would be heard again in each of its cells. */}
              <tr>{visibleCourseGroups.flatMap((group) => group.courses.map((course) => <th key={course.id} className="sr-only"
                id={`matrix-course-${course.id}`} scope="col">{course.code}{course.id === primaryCourseId ? " (bearbeiteter Kurs)" : ""}</th>))}</tr></thead>
              {semesterRows.map((rows, semesterIndex) => {
                const semester = semesterIndex + 1;
                const blocks = buildPhaseBlocks(rows, visibleCourseGroups, semester);
                // One row group per semester: the semester cell spans the group's rows and stays its programmatic heading.
                const semesterHeading = (rowSpan: number) => <th id={`matrix-semester-${semester}`} className="matrix-semester" scope="rowgroup" rowSpan={rowSpan}>Semester {semester}</th>;
                return <tbody key={semester}>{rows.length
                  ? rows.map((row, index) => <tr key={row.startDate}>
                    {index === 0 ? semesterHeading(rows.length) : null}
                    <th id={`matrix-period-${semester}-${row.startDate}`} scope="row">{formatCalendarPeriod(row.startDate, row.endDate)}</th>
                    <td className="matrix-duration">{formatPeriodDuration(row.startDate, row.endDate)}</td>
                    {blocks[index].map((block) => <PhaseCell key={block.group.courses.map((course) => course.id).join("-")} {...block} />)}
                  </tr>)
                  : <tr>
                    {semesterHeading(1)}
                    <th id={`matrix-period-${semester}-none`} scope="row">Kein Zeitraum</th>
                    <td className="matrix-duration">Keine</td>
                    {visibleCourseGroups.map((group) => <PhaseCell key={group.courses.map((course) => course.id).join("-")} cell={noPhaseLabel} group={group}
                      headers={[`matrix-semester-${semester}`, `matrix-period-${semester}-none`, ...group.courses.map((course) => `matrix-course-${course.id}`)].join(" ")} />)}
                  </tr>}</tbody>;
              })}
            </table>
          </div>
          {/* What the mark in the column heading means, resolved below the table it appears in. Like the phase legend
              it stays hidden from assistive technology, which is given the state in words in that heading and would
              otherwise hear a mark explained that it never encounters. It is derived from the whole cut rather than
              from the visible columns, so hiding a column does not move the text under the table. */}
          {courses.some((course) => unpublished.has(course.id))
            ? <p className="matrix-footnote" aria-hidden="true">* Nicht veröffentlicht: noch nicht öffentlich sichtbar, der Verlauf kann sich noch ändern.</p>
            : null}
        </div>
      </div>
      {children}
    </section>;
}

/**
 * The examination-relevant dates of every course a view shows, in one chronological order. It is a presentation and
 * never an editor: where a course is edited, its own dates are listed below this under the same heading, passed in as
 * `children`.
 */
export function PlanEventTable({ courses, phases, events, chronology = true, children }: { courses: CoursePlan[]; phases: CoursePhase[]; events: CourseEvent[]; chronology?: boolean; children?: ReactNode }) {
  const courseCodes = new Map(courses.map((course) => [course.id, course.code]));

  return <section aria-labelledby="events-heading">
      <div className="section-heading">
        <p className="eyebrow">Prüfungsrelevante Termine</p>
        <h2 id="events-heading">Termine</h2>
        {/* The chronology is dropped where it would repeat, entry for entry, the editable list of one course's own
            dates below it: with nothing standing beside that course, both orders hold exactly the same dates. */}
        {chronology ? <p>Chronologisch über alle Semester, mit dem je betroffenem Kurs abgeleiteten Semester.</p> : null}
      </div>
      {!chronology ? null : events.length ? <div className="matrix-wrap" role="region" aria-labelledby="events-table-caption" tabIndex={0}>
        <table className="event-table">
          <caption id="events-table-caption">Prüfungsrelevante Termine in chronologischer Reihenfolge</caption>
          <thead><tr>
            <th scope="col">Zeitangabe</th><th scope="col">Kategorie</th><th scope="col">Titel</th><th scope="col">Betroffene Kurse und Semester</th>
          </tr></thead>
          <tbody>{groupComparableEvents(events).map((event) => <tr key={`${event.category}-${event.title}-${event.startDate}-${event.endDate}-${event.provisional}`}>
            <td>
              {formatCalendarPeriod(event.startDate, event.endDate ?? event.startDate)}
              {event.provisional ? <span className="provisional">Vorläufig</span> : null}
            </td>
            <td>{eventCategoryLabel(event.category)}</td>
            <td>
              <strong>{event.title}</strong>
              {event.courses.some((course) => course.description) ? <ul className="event-description">{event.courses.map((course) => <li key={course.courseId}>
                {courseCodes.get(course.courseId)}: {course.description ?? "Keine Beschreibung"}
              </li>)}</ul> : null}
            </td>
            <td><ul className="event-courses">{event.courses.map(({ courseId }) => {
              const semester = deriveEventSemester(phases, courseId, event.startDate);
              return <li key={courseId}>{courseCodes.get(courseId)}: {semester ? `Semester ${semester}` : "Semester nicht ableitbar"}</li>;
            })}</ul></td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="empty-note">Für diesen Plan sind keine prüfungsrelevanten Termine veröffentlicht.</p>}
      {children}
    </section>;
}
