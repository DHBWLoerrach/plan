import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CourseListFilter } from "@/components/course-list-filter";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { publicationStateLabels } from "@/lib/domain/course-status";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { searchParam } from "../search-params";
import { courseListData, isCourseSort, isCourseSortDirection, type CourseListFilters, type CourseListRow, type CourseSort, type CourseSortDirection } from "./data";

type SortableHeader = { label: string; sort: CourseSort };

/* No column for write permission: the responsibility filter above the table decides it for every row at once, so a
   column would repeat its value as often as there are rows (ADR 0011). */
const headers: SortableHeader[] = [
  { label: "Kurskennung", sort: "code" },
  { label: "Studiengang", sort: "program" },
  { label: "Bereich", sort: "area" },
  { label: "Studienzeitraum", sort: "studyPeriod" },
  { label: "Veröffentlichung", sort: "publication" },
];

/** The filter values an address carries. The responsibility is written out only where it is not the one opened on. */
function filterQuery(filters: CourseListFilters): Record<string, string> {
  return Object.fromEntries(Object.entries({
    program: filters.program, year: filters.year, code: filters.code,
    zustaendigkeit: filters.responsibility === "all" ? "alle" : null,
  }).filter((entry): entry is [string, string] => Boolean(entry[1])));
}

function SortHeader({ header, currentSort, direction, filters }: { header: SortableHeader; currentSort: CourseSort; direction: CourseSortDirection; filters: CourseListFilters }) {
  const active = currentSort === header.sort;
  const nextDirection = active && direction === "asc" ? "desc" : "asc";
  const query = { ...filterQuery(filters), sort: header.sort, direction: nextDirection };
  const directionLabel = nextDirection === "asc" ? "aufsteigend" : "absteigend";
  return <th scope="col" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
    <Link className="sort-link" href={{ pathname: "/intern/kurse", query }} scroll={false} aria-label={`Nach ${header.label} ${directionLabel} sortieren`}>
      {header.label}<span aria-hidden="true">{active ? (direction === "asc" ? " ↑" : " ↓") : " ↕"}</span>
    </Link>
  </th>;
}

function CourseHeaders({ sort, direction, filters }: { sort: CourseSort; direction: CourseSortDirection; filters: CourseListFilters }) {
  return <>{headers.map((header) => <SortHeader key={header.sort} header={header} currentSort={sort} direction={direction} filters={filters} />)}</>;
}

/**
 * A course row leads into the course under its own designation, the way the overview lists it too. A course has one
 * address, and the page behind it is the whole course: it shows what may be done to it and leaves out what may not,
 * so the row leads to the same place for an own and for a foreign course.
 */
function CourseCells({ course }: { course: CourseListRow }) {
  return <>
    <td><Link className="text-link" href={`/intern/kurse/${course.id}`}>{course.code}</Link></td>
    <td>{course.program}</td>
    <td>{course.areaName}</td>
    <td>{course.studyStart} – {course.studyEnd}</td>
    <td>{publicationStateLabels[course.state]}</td>
  </>;
}

export default async function CoursesPage({ searchParams }: PageProps<"/intern/kurse">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const raw = await searchParams;
  const requestedSort = searchParam(raw, "sort");
  const sort = isCourseSort(requestedSort) ? requestedSort : "code";
  const requestedDirection = searchParam(raw, "direction");
  const direction = isCourseSortDirection(requestedDirection) ? requestedDirection : "asc";
  const filters: CourseListFilters = {
    program: searchParam(raw, "program"),
    year: searchParam(raw, "year"),
    code: searchParam(raw, "code"),
    responsibility: searchParam(raw, "zustaendigkeit") === "alle" ? "all" : "own",
  };
  const { programs, years, courses } = courseListData(sqlite, account, filters, sort, direction);

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="course-overview" aria-labelledby="courses-heading">
    <header className="course-overview__header"><h1 id="courses-heading">Kurse</h1><Link className="button button--compact" href="/intern/kurse/neu">Kurs anlegen</Link></header>
    <CourseListFilter programs={programs} years={years} values={{ ...filters, responsibility: filters.responsibility === "all" ? "alle" : null }} />
    {courses.length ? <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><CourseHeaders sort={sort} direction={direction} filters={filters} /></tr></thead>
      <tbody>{courses.map((course) => <tr key={course.id}><CourseCells course={course} /></tr>)}</tbody>
    </table></div>
      : <p className="empty-note">{filters.responsibility === "own"
        ? "In Ihren Bereichen gibt es für diese Filter keine Kurse. Über die Zuständigkeit sehen Sie auch die Kurse anderer Bereiche."
        : "Für diese Filter gibt es keine Kurse."}</p>}
  </section></SiteShell>;
}
