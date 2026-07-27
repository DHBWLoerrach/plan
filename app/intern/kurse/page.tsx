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
  const rawAssignment = searchParam(raw, "assignment");
  const assignment = rawAssignment === "assigned" || rawAssignment === "unassigned" ? rawAssignment : null;
  const requestedSort = searchParam(raw, "sort");
  const sort = isCourseSort(requestedSort) ? requestedSort : "code";
  const { areas, programs, years, courses } = courseListData(sqlite, account, { area, program, year, assignment }, sort);

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel" aria-labelledby="courses-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="courses-heading">Kurse</h1>
    <p><Link className="button" href="/intern/kurse/neu">Kurs anlegen</Link></p>
    <form className="filter-grid" role="search" aria-label="Kurse filtern">
      <label>Bereich<select name="area" defaultValue={area ?? ""}><option value="">Alle Bereiche</option>{areas.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Studiengang<select name="program" defaultValue={program ?? ""}><option value="">Alle Studiengänge</option>{programs.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Jahrgang<select name="year" defaultValue={year ?? ""}><option value="">Alle Jahrgänge</option>{years.map((option) => <option key={option.year} value={option.year}>{option.year}</option>)}</select></label>
      <label>Zuordnung<select name="assignment" defaultValue={assignment ?? ""}><option value="">Alle</option><option value="assigned">Blockplan zugeordnet</option><option value="unassigned">Blockplanlos</option></select></label>
      <label>Sortierung<select name="sort" defaultValue={sort}>{Object.entries(courseSortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="filter-actions"><button className="button" type="submit">Filtern</button><Link href="/intern/kurse">Filter zurücksetzen</Link></div>
    </form>
    {courses.length ? <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><th scope="col">Kurskennung</th><th scope="col">Studiengang</th><th scope="col">Bereich</th><th scope="col">Studienzeitraum</th><th scope="col">Zuordnung</th><th scope="col">Verwalten</th></tr></thead>
      <tbody>{courses.map((course) => <tr key={course.id}>
        <td>{course.code}</td><td>{course.program}</td><td>{course.areaName}</td><td>{course.studyStart} – {course.studyEnd}</td>
        <td>{course.publishedIn ? `Öffentlich sichtbar (${course.publishedIn})` : course.blockPlanId ? "Blockplan zugeordnet" : "Blockplanlos"}</td>
        <td><Link className="text-link" href={`/intern/kurse/${course.id}`}>Verwalten</Link></td>
      </tr>)}</tbody></table></div> : <p className="empty-note">Für diese Filter gibt es keine Kurse.</p>}
  </section></SiteShell>;
}
