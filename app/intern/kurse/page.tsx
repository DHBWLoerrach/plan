import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { areaAccessLabel, isPublicationState, publicationStateLabels, workInProgressLabel } from "@/lib/domain/course-status";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { searchParam } from "../search-params";
import { courseListData, courseSortLabels, isCourseSort, type CourseListRow } from "./data";

/** The cells every course row shows, whether or not the list currently builds a cut. */
function CourseCells({ course }: { course: CourseListRow }) {
  return <>
    <td>{course.code}</td>
    <td>{course.program}</td>
    <td>{course.areaName}</td>
    <td>{course.studyStart} – {course.studyEnd}</td>
    <td>{publicationStateLabels[course.state]}{course.workInProgress ? ` · ${workInProgressLabel}` : ""}</td>
    <td>{areaAccessLabel(course.editable)}</td>
    <td><Link className="text-link" href={`/intern/kurse/${course.id}`}>{course.editable ? "Verwalten" : "Ansehen"}</Link></td>
  </>;
}

export default async function CoursesPage({ searchParams }: PageProps<"/intern/kurse">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const raw = await searchParams;
  const area = searchParam(raw, "area");
  const program = searchParam(raw, "program");
  const year = searchParam(raw, "year");
  const code = searchParam(raw, "code");
  const requestedState = searchParam(raw, "state");
  const state = isPublicationState(requestedState) ? requestedState : null;
  const requestedSort = searchParam(raw, "sort");
  const sort = isCourseSort(requestedSort) ? requestedSort : "code";
  const { areas, programs, years, courses } = courseListData(sqlite, account, { area, program, year, code, state }, sort);
  const headers = ["Kurskennung", "Studiengang", "Bereich", "Studienzeitraum", "Veröffentlichung", "Bearbeitung", "Aktion"];

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel" aria-labelledby="courses-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="courses-heading">Kurse</h1>
    <p>Sie sehen die Kurse aller Bereiche. Bearbeiten können Sie ausschließlich die Kurse Ihrer eigenen Bereiche; die Spalte „Bearbeitung“ nennt es je Kurs. Ein nicht veröffentlichter Kurs ist als „{workInProgressLabel}“ gekennzeichnet. Bestätigte Änderungen an veröffentlichten Kursen wirken unmittelbar öffentlich.</p>
    <p><Link className="button" href="/intern/kurse/neu">Kurs anlegen</Link></p>
    <form className="filter-grid" role="search" aria-label="Kurse filtern">
      <label>Bereich<select name="area" defaultValue={area ?? ""}><option value="">Alle Bereiche</option>{areas.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Studiengang<select name="program" defaultValue={program ?? ""}><option value="">Alle Studiengänge</option>{programs.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>Jahrgang<select name="year" defaultValue={year ?? ""}><option value="">Alle Jahrgänge</option>{years.map((option) => <option key={option.year} value={option.year}>{option.year}</option>)}</select></label>
      <label>Kurskennung<input name="code" type="search" defaultValue={code ?? ""} autoComplete="off" placeholder="z. B. TIF26" /></label>
      <label>Veröffentlichung<select name="state" defaultValue={state ?? ""}><option value="">Alle Zustände</option>{Object.entries(publicationStateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Sortierung<select name="sort" defaultValue={sort}>{Object.entries(courseSortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="filter-actions"><button className="button" type="submit">Filtern</button><Link href="/intern/kurse">Filter zurücksetzen</Link></div>
    </form>
    {courses.length ? year ? <form action="/intern/kurse/zuschnitt" className="course-cut-form">
      <input type="hidden" name="year" value={year} />
      <p id="cut-selection-hint">Wählen Sie die Kurse, die Sie im Zuschnitt nebeneinander sehen möchten. Kurse fremder Bereiche stehen dort nur lesend daneben. Der Zuschnitt wird nicht gespeichert und umfasst ausschließlich Jahrgang {year}.</p>
      <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><th scope="col">Auswahl</th>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
      <tbody>{courses.map((course) => <tr key={course.id}>
        <td><label><input type="checkbox" name="courseId" value={course.id} aria-describedby="cut-selection-hint" /> <span className="sr-only">{course.code} auswählen</span></label></td>
        <CourseCells course={course} />
      </tr>)}</tbody></table></div>
      <p><button className="button" type="submit">Ausgewählte Kurse öffnen</button></p>
    </form> : <>
      <p className="notice">Wählen Sie zuerst einen Jahrgang, um einen Zuschnitt für die gemeinsame Bearbeitung zu bilden.</p>
      <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{courses.map((course) => <tr key={course.id}><CourseCells course={course} /></tr>)}</tbody>
      </table></div>
    </> : <p className="empty-note">Für diese Filter gibt es keine Kurse.</p>}
  </section></SiteShell>;
}
