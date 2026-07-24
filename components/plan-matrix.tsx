"use client";

import { useState } from "react";

import { eventCategoryLabel } from "@/lib/domain/event-category";
import { buildSemesterMatrix, deriveEventSemester, type DraftCourse, type DraftEvent, type DraftPhase } from "@/lib/domain/publication";

function formatPeriod(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const start = formatter.format(new Date(`${startDate}T00:00:00Z`));
  const end = formatter.format(new Date(`${endDate}T00:00:00Z`));
  return start === end ? start : `${start} – ${end}`;
}

export function PlanMatrix({ courses, phases, events }: { courses: DraftCourse[]; phases: DraftPhase[]; events: DraftEvent[] }) {
  const [visibleCourseIds, setVisibleCourseIds] = useState(() => new Set(courses.map((course) => course.id)));
  const visibleCourses = courses.filter((course) => visibleCourseIds.has(course.id));
  const semesters = Math.max(...visibleCourses.map((course) => course.semesters), 0);
  const courseCodes = new Map(courses.map((course) => [course.id, course.code]));
  return <>
    <section aria-labelledby="matrix-heading"><div className="section-heading"><p className="eyebrow">Studienverlauf</p><h2 id="matrix-heading">Planmatrix</h2><p>Alle Angaben sind kalendergenau und vergleichbar dargestellt.</p></div>
      <fieldset className="course-selector"><legend>Sichtbare Kurse in der Planmatrix</legend><p>Sie können Spalten ausblenden. Die Auswahl verändert keine Planinhalte.</p>{courses.map((course) => <label key={course.id}><input type="checkbox" checked={visibleCourseIds.has(course.id)} onChange={() => setVisibleCourseIds((current) => {
        const next = new Set(current);
        if (next.has(course.id)) {
          if (next.size > 1) next.delete(course.id);
        } else next.add(course.id);
        return next;
      })} /> {course.code}</label>)}</fieldset>
      <p className="sr-only" aria-live="polite">{visibleCourses.length} von {courses.length} Kursen sind in der Planmatrix sichtbar.</p>
      {Array.from({ length: semesters }, (_, index) => index + 1).map((semester) => {
        const rows = buildSemesterMatrix(visibleCourses, phases, semester);
        return <div className="matrix-wrap" key={semester} tabIndex={0}>
          <table className="matrix"><caption>Semester {semester}</caption><thead><tr><th scope="col">Zeitraum</th>{visibleCourses.map((course) => <th key={course.id} scope="col">{course.code}</th>)}</tr></thead>
            <tbody>{rows.length ? rows.map((row) => <tr key={row.startDate}><th scope="row">{formatPeriod(row.startDate, row.endDate)}</th>{row.cells.map((cell, index) => <td key={visibleCourses[index].id} data-phase={cell === "Theorie" ? "theory" : cell === "Praxis" ? "practice" : "none"}>{cell}</td>)}</tr>) : <tr><th scope="row">–</th>{visibleCourses.map((course) => <td key={course.id}>Nicht in diesem Semester</td>)}</tr>}</tbody>
          </table>
        </div>;
      })}
    </section>
    <section aria-labelledby="events-heading"><div className="section-heading"><p className="eyebrow">Prüfungsrelevante Termine</p><h2 id="events-heading">Termine</h2></div>
      {events.length ? <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><th scope="col">Zeitangabe</th><th scope="col">Kategorie</th><th scope="col">Titel</th><th scope="col">Betroffene Kurse und Semester</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{formatPeriod(event.startDate, event.endDate ?? event.startDate)}{event.provisional ? <span className="provisional">Vorläufig</span> : null}</td><td>{eventCategoryLabel(event.category)}</td><td><strong>{event.title}</strong></td><td>{event.courseIds.map((id) => { const semester = deriveEventSemester(phases, id, event.startDate); return `${courseCodes.get(id)}${semester ? ` (Semester ${semester})` : " (Semester nicht ableitbar)"}`; }).join(", ")}</td></tr>)}</tbody></table></div> : <p className="empty-note">Für diesen Plan sind keine prüfungsrelevanten Termine veröffentlicht.</p>}
    </section>
  </>;
}
