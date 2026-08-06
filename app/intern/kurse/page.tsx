import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CourseListFilter } from "@/components/course-list-filter";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { formatCalendarDay, formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { publicationStateLabels } from "@/lib/domain/course-status";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { searchParam } from "../search-params";
import { courseListData, isCourseSort, isCourseSortDirection, type CourseListFilters, type CourseListRow, type CourseSort, type CourseSortDirection } from "./data";

type SortableHeader = { label: string; sort: CourseSort };

/* No column for write permission: the responsibility filter above the table decides it for every row at once, so a
   column would repeat its value as often as there are rows (ADR 0011). No column for the area either: a study program
   belongs to exactly one of them, so the area is a property of the value the study program column already shows and is
   named beside it — and only where the list stands on every area, because within the own ones it distinguishes
   nothing. */
const headers: SortableHeader[] = [
  { label: "Kurskennung", sort: "code" },
  { label: "Studiengang", sort: "program" },
  { label: "Studienzeitraum", sort: "studyPeriod" },
  /* The column of the publication names a day, not a state: „Nicht veröffentlicht“ stood in nearly every row and said
     the same thing every time, while the day differs from row to row and says the state along with it. What is left
     unwritten is resolved once below the table, the way the matrix resolves its mark (BARRIEREFREIHEIT.md). */
  { label: "Veröffentlicht am", sort: "publication" },
];

/**
 * The list opens on the study period, newest first. Sorted by course code the oldest years would stand at the top,
 * and the year actually being worked on would sink one place further down with every new one.
 */
const defaultSort: CourseSort = "studyPeriod";
/**
 * Which direction a column sorts in when it is asked for without one — on its first click, and on an address that
 * names no direction. Periods run from the newest, text from A: both are the end of the column one starts reading at,
 * so the first click never has to be taken back.
 */
const firstDirection: Record<CourseSort, CourseSortDirection> = { code: "asc", program: "asc", studyPeriod: "desc", publication: "desc" };

/** The filter values an address carries. The responsibility is written out only where it is not the one opened on. */
function filterQuery(filters: CourseListFilters): Record<string, string> {
  return Object.fromEntries(Object.entries({
    program: filters.program, year: filters.year, code: filters.code,
    zustaendigkeit: filters.responsibility === "all" ? "alle" : null,
  }).filter((entry): entry is [string, string] => Boolean(entry[1])));
}

/**
 * What the list stands on, said in numbers. Where nothing narrows, the count is the whole and says so plainly; where
 * a filter narrows, the whole is named beside the part, because the number alone would leave open how much of the
 * responsibility it covers. The responsibility itself is not counted as narrowing — it decides what the whole is.
 */
function courseCountLabel(shown: number, totalInScope: number, narrowed: boolean): string {
  if (!narrowed) return `${totalInScope} ${totalInScope === 1 ? "Ergebnis" : "Ergebnisse"}`;
  return `${shown} von ${totalInScope} Ergebnissen`;
}

function SortHeader({ header, currentSort, direction, filters }: { header: SortableHeader; currentSort: CourseSort; direction: CourseSortDirection; filters: CourseListFilters }) {
  const active = currentSort === header.sort;
  const nextDirection = active ? (direction === "asc" ? "desc" : "asc") : firstDirection[header.sort];
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
 *
 * That one address is written once, on the course code. The whole row is what can be clicked, but only as a surface
 * the stylesheet draws over it from this very link — a second link per row would offer the same address twice to
 * everything that reads links rather than looks at rows.
 */
function CourseCells({ course, namesArea }: { course: CourseListRow; namesArea: boolean }) {
  return <>
    <td className="course-table__code"><Link className="text-link course-table__link" href={`/intern/kurse/${course.id}`}>{course.code}</Link></td>
    {/* The study program by its name alone: its abbreviation is what the course code beside it already begins with,
        and the ambiguity the overview needs it for — the same name in two areas — is what the area beside it resolves
        here. It stands on the same line rather than under the name: written underneath it appeared in some rows and
        not in others, and the table lost the one row height it had. An area bearing the name of its study program is
        left unwritten: it would repeat the name in front of it word for word, and its absence says the same thing.
        The separator carries no meaning of its own and is therefore not read out — the space around the area name is
        written into the markup, because it belongs to the reading just as much as to the typography. */}
    <td>{course.program}{namesArea && course.areaName !== course.program
      ? <span className="course-program__area"><span aria-hidden="true"> · </span>{course.areaName}</span> : null}</td>
    <td className="course-table__period">{formatCalendarPeriod(course.studyStart, course.studyEnd)}</td>
    {/* A published course carries its day, and the column heading every cell refers to says what the day is the day
        of. An unpublished one has no day to carry: it shows the dash that stands for a missing entry throughout, and
        the sentence below the table resolves it — for assistive technology in the cell itself, in the same words as
        every other internal view, because a dash is a typographic sign and not a wording (BARRIEREFREIHEIT.md). */}
    <td className="course-table__published">{course.publishedOn
      ? formatCalendarDay(course.publishedOn)
      : <><span aria-hidden="true">—</span><span className="sr-only">{publicationStateLabels.UNPUBLISHED}</span></>}</td>
  </>;
}

export default async function CoursesPage({ searchParams }: PageProps<"/intern/kurse">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const raw = await searchParams;
  const requestedSort = searchParam(raw, "sort");
  const sort = isCourseSort(requestedSort) ? requestedSort : defaultSort;
  const requestedDirection = searchParam(raw, "direction");
  const direction = isCourseSortDirection(requestedDirection) ? requestedDirection : firstDirection[sort];
  const filters: CourseListFilters = {
    program: searchParam(raw, "program"),
    year: searchParam(raw, "year"),
    code: searchParam(raw, "code"),
    responsibility: searchParam(raw, "zustaendigkeit") === "alle" ? "all" : "own",
  };
  const { programs, years, courses, totalInScope } = courseListData(sqlite, account, filters, sort, direction);
  const narrowed = Boolean(filters.program || filters.year || filters.code);
  /* The wider responsibility with everything else left as it stands, so that the way out of an empty result is the
     one step it names and not a return to the unfiltered list. */
  const widerQuery = { ...filterQuery({ ...filters, responsibility: "all" }), sort, direction };

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="course-overview" aria-labelledby="courses-heading">
    <header className="course-overview__header">
      <div className="course-overview__title"><h1 id="courses-heading">Kurse</h1><span className="course-overview__separator" aria-hidden="true">·</span>
        <p className="course-overview__count" aria-live="polite">{courseCountLabel(courses.length, totalInScope, narrowed)}</p></div>
      <Link className="button button--compact" href="/intern/kurse/neu">Kurs anlegen</Link>
    </header>
    <CourseListFilter programs={programs} years={years} values={{ ...filters, responsibility: filters.responsibility === "all" ? "alle" : null }} />
    {/* The region stays focusable throughout, although it only scrolls on a narrow display: whether it does is decided
        by the stylesheet, and a focus stop that is there once too often is the harmless half of that — one missing on
        a display that scrolls would leave the table unreachable by keyboard (BARRIEREFREIHEIT.md). */}
    {courses.length ? <><div className="matrix-wrap course-table-wrap" tabIndex={0}><table className="course-table"><thead><tr><CourseHeaders sort={sort} direction={direction} filters={filters} /></tr></thead>
      <tbody>{courses.map((course) => <tr key={course.id}><CourseCells course={course} namesArea={filters.responsibility === "all"} /></tr>)}</tbody>
    </table></div>
      {/* What the empty cells of the date column mean, and only where there are any: with every listed course
          published the sentence would resolve nothing. It stands outside the scrolling region, so a table wider than
          the display cannot carry it out of sight while the dashes it explains stay visible. */}
      {courses.some((course) => !course.publishedOn) ? <p className="course-table-note">Kurse ohne Datum sind nicht veröffentlicht.</p> : null}</>
      : <p className="empty-note">{filters.responsibility === "own"
        ? <>In Ihren Bereichen gibt es für diese Filter keine Kurse.{" "}
          <Link className="text-link" href={{ pathname: "/intern/kurse", query: widerQuery }} scroll={false}>Auch Kurse anderer Bereiche anzeigen</Link></>
        : "Für diese Filter gibt es keine Kurse."}</p>}
  </section></SiteShell>;
}
