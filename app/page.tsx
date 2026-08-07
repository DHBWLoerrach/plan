import Link from "next/link";
import { connection } from "next/server";

import { PublicSearchFilter } from "@/components/public-search-filter";
import { SiteShell } from "@/components/site-shell";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { publicCutPath } from "@/lib/domain/public-cut";
import { filterKeys, type PublicFilterOption, type PublicFilters, type PublicPlanGroup } from "@/lib/services/public-search";

import { publicSearchData, searchParam } from "./data";

const filterLabels: Record<(typeof filterKeys)[number], string> = {
  area: "Bereich",
  program: "Studiengang",
  year: "Jahrgang",
  course: "Kurskennung",
};

/**
 * The options come exclusively from the current master data of published courses. A value
 * taken from the URL that no published course carries any more is not offered as a further choice but marked as such, so that
 * the shown state still matches the shared link.
 */
function options(published: (string | number | PublicFilterOption)[], current: string | undefined) {
  const values = published.map((option) => typeof option === "object"
    ? option
    : { value: String(option), label: String(option) });
  return current && !values.some((option) => option.value === current)
    ? [...values, { value: current, label: `${current} (nicht mehr veröffentlicht)` }]
    : values;
}

/**
 * A group of found courses, read as rows rather than as a grid of cards: what is compared here runs along the row —
 * one course against the next by its designation, its study program and its study period — and a card would set each
 * of those values in a place of its own. It is the same list the internal course overview keeps, in the same table,
 * so a single result looks like a result there as well and not like a grid that failed to fill.
 *
 * The row carries exactly one visible link, on the course code. Every remaining cell has an empty link surface for
 * the same address, hidden from assistive technology and the tab order, so the whole row can be clicked without
 * offering the address repeatedly to everything that reads links rather than rows. Each surface belongs to its own
 * cell: unlike a table row, that is a reliable containing block in Safari, so no surface can escape onto the page.
 */
function PlanGroupSection({ group }: { group: PublicPlanGroup }) {
  if (!group.courses.length) return null;
  return <section className="plan-group" aria-labelledby={`group-${group.key}`}>
    <h3 id={`group-${group.key}`}>{group.label}</h3>
    {/* The region stays focusable, although it only scrolls on a narrow display: the stylesheet decides whether it
        does, and a focus stop too many is the harmless half of that (BARRIEREFREIHEIT.md). */}
    <div className="matrix-wrap course-table-wrap" tabIndex={0}>
      <table className="course-table" aria-labelledby={`group-${group.key}`}>
        <thead><tr>
          <th scope="col">Kurskennung</th>
          <th scope="col">Studiengang</th>
          <th className="course-table__year" scope="col">Jahrgang</th>
          <th scope="col">Studienzeitraum</th>
        </tr></thead>
        <tbody>{group.courses.map((course) => {
          const href = publicCutPath({ kind: "course", code: course.code });
          /* The visible link already prefetches this address. These copies only provide pointer targets and therefore
             stay out of prefetching, assistive technology and the tab order. */
          const cover = <Link className="course-table__cover" href={href} prefetch={false} aria-hidden="true" tabIndex={-1} />;
          return <tr key={course.id}>
            <td className="course-table__code"><Link className="text-link course-table__link" href={href}>{course.code}</Link></td>
            {/* The area beside the name of the study program, and only where it says something the name does not: an
                area bearing the name of its study program would repeat it word for word. The separator carries no
                meaning of its own and is therefore not read out. */}
            <td>{course.program}{course.area !== course.program
              ? <span className="course-program__area"><span aria-hidden="true"> · </span>{course.area}</span> : null}{cover}</td>
            <td className="course-table__year">{course.year}{cover}</td>
            <td className="course-table__period">{formatCalendarPeriod(course.studyStart, course.studyEnd)}{cover}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}

function pageUrl(filters: PublicFilters, page: number) {
  const parameters = new URLSearchParams(Object.entries({ ...filters, page: String(page) }) as [string, string][]);
  return `/?${parameters.toString()}`;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const raw = await searchParams;
  const { options: published, result } = publicSearchData({
    area: searchParam(raw, "area"),
    program: searchParam(raw, "program"),
    year: searchParam(raw, "year"),
    course: searchParam(raw, "course"),
    page: searchParam(raw, "page"),
  });
  const filters = result.filters;
  const activeFilters = filterKeys.flatMap((key) => {
    const value = filters[key];
    if (!value) return [];
    const displayedValue = key === "program"
      ? published.programs.find((option) => option.value === value)?.label ?? value
      : value;
    return [{ label: filterLabels[key], value: displayedValue }];
  });
  const filterText = activeFilters.length
    ? `Aktive Filter: ${activeFilters.map((filter) => `${filter.label} ${filter.value}`).join(", ")}.`
    : "Keine Filter gesetzt.";

  return <SiteShell>
    <section className="search-hero">
      <p className="eyebrow">Studienbetrieb</p>
      <h1>Blockpläne</h1>
      <p className="search-hero__lead">Theorie- und Praxisphasen sowie prüfungsrelevante Termine je Kurs und Jahrgang.</p>
      <p className="search-hero__note">
        <svg className="search-hero__note-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7.1" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.6" r=".95" fill="currentColor" />
          <path d="M8 7.2v4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Es werden ausschließlich Blockpläne angezeigt, die bereits freigegeben wurden.
      </p>
    </section>

    {/* The filter is a bar above the list, not a section of its own: it narrows what stands beneath it and is read
        once, while the list is what the page is visited for. As a panel with an eyebrow, a heading of its own and the
        padding of a main block it took the place of the result and pushed it below the fold. */}
    <PublicSearchFilter
      areas={options(published.areas, filters.area)}
      programs={options(published.programs, filters.program)}
      years={options(published.years, filters.year)}
      values={{ area: filters.area ?? "", program: filters.program ?? "", year: filters.year ?? "", course: filters.course ?? "" }} />

    <section className="results" aria-labelledby="results-heading">
      <h2 className="sr-only" id="results-heading">Suchergebnis</h2>
      <div className="results__heading" role="status">
        <p><strong>{result.total}</strong> {result.total === 1 ? "Kurs" : "Kurse"} gefunden</p>
        <span>{result.total ? `Seite ${result.page} von ${result.pages} · ` : ""}{filterText}</span>
      </div>
      {result.total ? <>
        {result.groups.map((group) => <PlanGroupSection group={group} key={group.key} />)}
        {result.pages > 1 ? <nav className="pagination" aria-label="Seitennavigation">
          {result.page > 1
            ? <Link href={pageUrl(filters, result.page - 1)} rel="prev">Vorherige Seite</Link>
            : <span>Vorherige Seite</span>}
          <span>Seite {result.page} von {result.pages}</span>
          {result.page < result.pages
            ? <Link href={pageUrl(filters, result.page + 1)} rel="next">Nächste Seite</Link>
            : <span>Nächste Seite</span>}
        </nav> : null}
      </> : <div className="empty-state">
        <h3>{activeFilters.length ? "Keine Kurse für diese Filter" : "Noch keine veröffentlichten Kurse"}</h3>
        {/* The way back to a filled list is the reset in the bar right above, so it is named rather than offered a
            second time: two buttons to the same address would be one way too many (ADR 0011). */}
        <p>{activeFilters.length
          ? "Setzen Sie die Filter in der Leiste darüber zurück oder wählen Sie andere Werte. Zur Auswahl stehen nur Werte, die veröffentlichte Blockpläne tatsächlich tragen."
          : "Veröffentlichte Kurse erscheinen hier automatisch und können anschließend gefiltert werden."}</p>
      </div>}
    </section>
  </SiteShell>;
}
