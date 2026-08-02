import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CourseListFilter } from "@/components/course-list-filter";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { coursePlanPath } from "@/lib/domain/course-comparison";
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
  return <>{headers.map((header) => <SortHeader key={header.sort} header={header} currentSort={sort} direction={direction} filters={filters} />)}<th scope="col">Aktionen</th></>;
}

/**
 * A course row leads to the two things one does with a course: its master data and publication on the course page,
 * its progression and events on its plan page. Both are the course itself — the list never bundles several of them.
 */
function CourseCells({ course }: { course: CourseListRow }) {
  return <>
    <td>{course.code}</td>
    <td>{course.program}</td>
    <td>{course.areaName}</td>
    <td>{course.studyStart} – {course.studyEnd}</td>
    <td>{publicationStateLabels[course.state]}{course.workInProgress ? ` · ${workInProgressLabel}` : ""}</td>
    <td>{areaAccessLabel(course.editable)}</td>
    <td className="course-actions">
      <Link className="text-link" href={`/intern/kurse/${course.id}`}>{course.editable ? "Verwalten" : "Ansehen"}</Link>
      <Link className="text-link" href={coursePlanPath(course.id)}>Planungsstand<span className="sr-only"> von {course.code}</span></Link>
    </td>
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
    {courses.length ? <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><CourseHeaders sort={sort} direction={direction} filters={filters} /></tr></thead>
      <tbody>{courses.map((course) => <tr key={course.id}><CourseCells course={course} /></tr>)}</tbody>
    </table></div> : <p className="empty-note">Für diese Filter gibt es keine Kurse.</p>}
  </section></SiteShell>;
}
