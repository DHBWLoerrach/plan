import Link from "next/link";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";
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
 * The options come exclusively from the current master data of published courses (MVP-SPEZIFIKATION.md). A value
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

function PlanGroupSection({ group }: { group: PublicPlanGroup }) {
  if (!group.courses.length) return null;
  return <section className="plan-group" aria-labelledby={`group-${group.key}`}>
    <h3 id={`group-${group.key}`}>{group.label}</h3>
    <div className="plan-grid">{group.courses.map((course) => <article className="plan-card" key={course.id}>
      <p>{course.area}</p>
      <h4><Link href={publicCutPath({ kind: "course", code: course.code })}>{course.code}</Link></h4>
      <dl>
        <div><dt>Studiengang</dt><dd>{course.program}</dd></div>
        <div><dt>Jahrgang</dt><dd>{course.year}</dd></div>
      </dl>
      <Link className="text-link" href={publicCutPath({ kind: "course", code: course.code })}>Kursplan ansehen<span className="sr-only"> — {course.code}</span> <span aria-hidden="true">→</span></Link>
    </article>)}</div>
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
  // Resetting filters and going back or forward are client-side navigations that keep the form fields mounted; the key
  // remounts them, so the shown filters always match the URL (MVP-SPEZIFIKATION.md).
  const formKey = filterKeys.map((key) => filters[key] ?? "").join("\u0000");

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

    <section className="search-panel" aria-labelledby="search-heading">
      <div className="section-heading"><p className="eyebrow">Suche verfeinern</p><h2 id="search-heading">Passenden Blockplan finden</h2></div>
      <form role="search" aria-labelledby="search-heading" key={formKey}>
        <p id="filter-hint">Mehrere Filter werden mit UND verknüpft. Die Kurskennung sucht am Anfang und ohne Beachtung der Groß- und Kleinschreibung.</p>
        <div className="filter-grid">
          <label>Bereich<select name="area" defaultValue={filters.area ?? ""}>
            <option value="">Alle Bereiche</option>
            {options(published.areas, filters.area).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></label>
          <label>Studiengang<select name="program" defaultValue={filters.program ?? ""}>
            <option value="">Alle Studiengänge</option>
            {options(published.programs, filters.program).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></label>
          <label>Jahrgang<select name="year" defaultValue={filters.year ?? ""}>
            <option value="">Alle Jahrgänge</option>
            {options(published.years, filters.year).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></label>
          <label>Kurskennung<input name="course" defaultValue={filters.course ?? ""} aria-describedby="filter-hint" placeholder="z. B. TIF24" /></label>
        </div>
        <div className="filter-actions">
          <button className="button" type="submit">Kurse suchen</button>
          <Link href="/">Filter zurücksetzen</Link>
        </div>
      </form>
    </section>

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
        <p>{activeFilters.length
          ? "Setzen Sie die Filter zurück oder wählen Sie andere Werte. Zur Auswahl stehen nur Werte, die veröffentlichte Blockpläne tatsächlich tragen."
          : "Veröffentlichte Kurse erscheinen hier automatisch und können anschließend gefiltert werden."}</p>
        {activeFilters.length ? <p><Link className="button" href="/">Filter zurücksetzen</Link></p> : null}
      </div>}
    </section>
  </SiteShell>;
}
