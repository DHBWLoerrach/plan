"use client";

import { useId, useState } from "react";

import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel } from "@/lib/domain/phase-type";
import { buildSemesterMatrix, deriveEventSemester, type DraftCourse, type DraftEvent, type DraftPhase } from "@/lib/domain/publication";

/**
 * The colour of a matrix cell follows the phase label the domain produced; the text alone already carries the meaning,
 * colour only supports it (BARRIEREFREIHEIT.md).
 */
function phaseAttribute(cell: string) {
  if (cell === phaseTypeLabel("THEORY")) return "theory";
  return cell === phaseTypeLabel("PRACTICE") ? "practice" : "none";
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
      <div className="matrix-wrap" role="region" aria-labelledby={captionId} tabIndex={0}>
        <table className="matrix">
          <caption id={captionId}>Studienverlauf je Semester</caption>
          <thead><tr>
            <th scope="col">Semester</th><th scope="col">Zeitraum</th>
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
                {row.cells.map((cell, cellIndex) => <td key={visibleCourses[cellIndex].id} data-phase={phaseAttribute(cell)}>{cell}</td>)}
              </tr>)
              : <tr>
                {semesterHeading(1)}
                <th scope="row">Kein Zeitraum</th>
                {visibleCourses.map((course) => <td key={course.id} data-phase="none">Nicht in diesem Semester</td>)}
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
