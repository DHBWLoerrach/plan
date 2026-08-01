import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CourseListFilter } from "@/components/course-list-filter";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { areaAccessLabel, publicationStateLabels, workInProgressLabel } from "@/lib/domain/course-status";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { searchParam } from "../search-params";
import { courseListData, isCourseSort, isCourseSortDirection, type CourseListRow, type CourseSort, type CourseSortDirection } from "./data";

type CourseFilters = { program: string | null; year: string | null; code: string | null };
type SortableHeader = { label: string; sort: CourseSort };

const headers: SortableHeader[] = [
  { label: "Kurskennung", sort: "code" },
  { label: "Studiengang", sort: "program" },
  { label: "Bereich", sort: "area" },
  { label: "Studienzeitraum", sort: "studyPeriod" },
  { label: "Veröffentlichung", sort: "publication" },
  { label: "Bearbeitung", sort: "access" },
];

function SortHeader({ header, currentSort, direction, filters }: { header: SortableHeader; currentSort: CourseSort; direction: CourseSortDirection; filters: CourseFilters }) {
  const active = currentSort === header.sort;
  const nextDirection = active && direction === "asc" ? "desc" : "asc";
  const query = Object.fromEntries(Object.entries({ ...filters, sort: header.sort, direction: nextDirection }).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const directionLabel = nextDirection === "asc" ? "aufsteigend" : "absteigend";
  return <th scope="col" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
    <Link className="sort-link" href={{ pathname: "/intern/kurse", query }} scroll={false} aria-label={`Nach ${header.label} ${directionLabel} sortieren`}>
      {header.label}<span aria-hidden="true">{active ? (direction === "asc" ? " ↑" : " ↓") : " ↕"}</span>
    </Link>
  </th>;
}

function CourseHeaders({ sort, direction, filters }: { sort: CourseSort; direction: CourseSortDirection; filters: CourseFilters }) {
  return <>{headers.map((header) => <SortHeader key={header.sort} header={header} currentSort={sort} direction={direction} filters={filters} />)}<th scope="col">Aktion</th></>;
}

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
  const program = searchParam(raw, "program");
  const year = searchParam(raw, "year");
  const code = searchParam(raw, "code");
  const requestedSort = searchParam(raw, "sort");
  const sort = isCourseSort(requestedSort) ? requestedSort : "code";
  const requestedDirection = searchParam(raw, "direction");
  const direction = isCourseSortDirection(requestedDirection) ? requestedDirection : "asc";
  const filters = { program, year, code };
  const { programs, years, courses } = courseListData(sqlite, account, filters, sort, direction);

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="course-overview" aria-labelledby="courses-heading">
    <header className="course-overview__header"><h1 id="courses-heading">Kurse</h1><Link className="button button--compact" href="/intern/kurse/neu">Kurs anlegen</Link></header>
    <CourseListFilter programs={programs} years={years} values={filters} />
    {courses.length ? year ? <form action="/intern/kurse/zuschnitt" className="course-cut-form">
      <input type="hidden" name="year" value={year} />
      <p id="cut-selection-hint">Wählen Sie die Kurse, die Sie im Zuschnitt nebeneinander sehen möchten. Kurse fremder Bereiche stehen dort nur lesend daneben. Der Zuschnitt wird nicht gespeichert und umfasst ausschließlich Jahrgang {year}.</p>
      <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><th scope="col">Auswahl</th><CourseHeaders sort={sort} direction={direction} filters={filters} /></tr></thead>
      <tbody>{courses.map((course) => <tr key={course.id}>
        <td><label><input type="checkbox" name="courseId" value={course.id} aria-describedby="cut-selection-hint" /> <span className="sr-only">{course.code} auswählen</span></label></td>
        <CourseCells course={course} />
      </tr>)}</tbody></table></div>
      <p><button className="button" type="submit">Ausgewählte Kurse öffnen</button></p>
    </form> : <>
      <p className="notice">Wählen Sie zuerst einen Jahrgang, um einen Zuschnitt für die gemeinsame Bearbeitung zu bilden.</p>
      <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><CourseHeaders sort={sort} direction={direction} filters={filters} /></tr></thead>
        <tbody>{courses.map((course) => <tr key={course.id}><CourseCells course={course} /></tr>)}</tbody>
      </table></div>
    </> : <p className="empty-note">Für diese Filter gibt es keine Kurse.</p>}
  </section></SiteShell>;
}
