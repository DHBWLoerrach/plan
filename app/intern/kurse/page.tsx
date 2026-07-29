import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { searchParam } from "../search-params";
import { courseListData, courseSortLabels, isCourseSort } from "./data";

export default async function CoursesPage({ searchParams }: PageProps<"/intern/kurse">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const raw = await searchParams;
  const area = searchParam(raw, "area");
  const program = searchParam(raw, "program");
  const year = searchParam(raw, "year");
  const requestedSort = searchParam(raw, "sort");
  const sort = isCourseSort(requestedSort) ? requestedSort : "code";
  const { areas, programs, years, courses } = courseListData(sqlite, account, { area, program, year }, sort);

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel" aria-labelledby="courses-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="courses-heading">Kurse</h1>
    <p><Link className="button" href="/intern/kurse/neu">Kurs anlegen</Link></p>
    <form className="filter-grid" role="search" aria-label="Kurse filtern">
      <label>Bereich<select name="area" defaultValue={area ?? ""}><option value="">Alle Bereiche</option>{areas.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Studiengang<select name="program" defaultValue={program ?? ""}><option value="">Alle Studiengänge</option>{programs.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Jahrgang<select name="year" defaultValue={year ?? ""}><option value="">Alle Jahrgänge</option>{years.map((option) => <option key={option.year} value={option.year}>{option.year}</option>)}</select></label>
      <label>Sortierung<select name="sort" defaultValue={sort}>{Object.entries(courseSortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="filter-actions"><button className="button" type="submit">Filtern</button><Link href="/intern/kurse">Filter zurücksetzen</Link></div>
    </form>
    {courses.length ? year ? <form action="/intern/kurse/zuschnitt" className="course-cut-form">
      <input type="hidden" name="year" value={year} />
      <p id="cut-selection-hint">Wählen Sie die Kurse, die Sie im Zuschnitt nebeneinander bearbeiten möchten. Der Zuschnitt wird nicht gespeichert und umfasst ausschließlich Jahrgang {year}.</p>
      <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><th scope="col">Auswahl</th><th scope="col">Kurskennung</th><th scope="col">Studiengang</th><th scope="col">Bereich</th><th scope="col">Studienzeitraum</th><th scope="col">Veröffentlichung</th><th scope="col">Verwalten</th></tr></thead>
      <tbody>{courses.map((course) => <tr key={course.id}>
        <td><label><input type="checkbox" name="courseId" value={course.id} aria-describedby="cut-selection-hint" /> <span className="sr-only">{course.code} auswählen</span></label></td>
        <td>{course.code}</td><td>{course.program}</td><td>{course.areaName}</td><td>{course.studyStart} – {course.studyEnd}</td>
        <td>{course.publishedIn ? "Veröffentlicht" : course.hasEverBeenPublished ? "Zurückgenommen" : "Noch nie veröffentlicht"}</td>
        <td><Link className="text-link" href={`/intern/kurse/${course.id}`}>Verwalten</Link></td>
      </tr>)}</tbody></table></div>
      <p><button className="button" type="submit">Ausgewählte Kurse bearbeiten</button></p>
    </form> : <>
      <p className="notice">Wählen Sie zuerst einen Jahrgang, um einen Zuschnitt für die gemeinsame Bearbeitung zu bilden.</p>
      <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><th scope="col">Kurskennung</th><th scope="col">Studiengang</th><th scope="col">Bereich</th><th scope="col">Studienzeitraum</th><th scope="col">Veröffentlichung</th><th scope="col">Verwalten</th></tr></thead>
        <tbody>{courses.map((course) => <tr key={course.id}><td>{course.code}</td><td>{course.program}</td><td>{course.areaName}</td><td>{course.studyStart} – {course.studyEnd}</td><td>{course.publishedIn ? "Veröffentlicht" : course.hasEverBeenPublished ? "Zurückgenommen" : "Noch nie veröffentlicht"}</td><td><Link className="text-link" href={`/intern/kurse/${course.id}`}>Verwalten</Link></td></tr>)}</tbody>
      </table></div>
    </> : <p className="empty-note">Für diese Filter gibt es keine Kurse.</p>}
  </section></SiteShell>;
}
