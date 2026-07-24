import Link from "next/link";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";
import { getFilterOptions, listPublicPlans, type PublicFilters } from "@/lib/public-data";

function value(searchParams: Record<string, string | string[] | undefined>, key: keyof PublicFilters) {
  const candidate = searchParams[key];
  return typeof candidate === "string" ? candidate : undefined;
}

function PlanGroup({ title, plans }: { title: string; plans: ReturnType<typeof listPublicPlans>["groups"]["current"] }) {
  if (!plans.length) return null;
  return <section className="plan-group" aria-labelledby={`group-${title}`}><h2 id={`group-${title}`}>{title}</h2><div className="plan-grid">{plans.map((plan) => <article className="plan-card" key={plan.id}><p>{plan.area}</p><h3><Link href={`/${plan.id}`}>{plan.name}</Link></h3><dl><div><dt>Jahrgang</dt><dd>{plan.year}</dd></div><div><dt>Kurse</dt><dd>{plan.courses.map((course) => course.code).join(", ")}</dd></div></dl><Link className="text-link" href={`/${plan.id}`}>Blockplan ansehen <span aria-hidden="true">→</span></Link></article>)}</div></section>;
}

function pageUrl(filters: PublicFilters, page: number) {
  const parameters = new URLSearchParams(Object.entries({ ...filters, page: String(page) }).filter(([, currentValue]) => currentValue));
  return `/?${parameters.toString()}`;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const rawSearchParams = await searchParams;
  const filters: PublicFilters = { area: value(rawSearchParams, "area"), program: value(rawSearchParams, "program"), year: value(rawSearchParams, "year"), course: value(rawSearchParams, "course"), page: value(rawSearchParams, "page") };
  const [options, result] = [getFilterOptions(), listPublicPlans(filters)];
  return <SiteShell><section className="search-hero"><div><p className="eyebrow">Studienbetrieb · DHBW Lörrach</p><h1>Blockpläne<br /><em>klar finden.</em></h1><p>Veröffentlichte Theorie- und Praxisphasen sowie prüfungsrelevante Termine für Ihren Kurs.</p></div><aside aria-label="Hinweis"><strong>Öffentlicher Stand</strong><span>Hier sehen Sie ausschließlich bewusst veröffentlichte Blockpläne.</span></aside></section>
    <section className="search-panel" aria-labelledby="search-heading"><div className="section-heading"><p className="eyebrow">Suche verfeinern</p><h2 id="search-heading">Passenden Blockplan finden</h2></div><form><div className="filter-grid"><label>Bereich<select name="area" defaultValue={filters.area ?? ""}><option value="">Alle Bereiche</option>{options.areas.map((option) => <option key={option.value}>{option.value}</option>)}</select></label><label>Studiengang<select name="program" defaultValue={filters.program ?? ""}><option value="">Alle Studiengänge</option>{options.programs.map((option) => <option key={option.value}>{option.value}</option>)}</select></label><label>Jahrgang<select name="year" defaultValue={filters.year ?? ""}><option value="">Alle Jahrgänge</option>{options.years.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}</select></label><label>Kurskennung<input name="course" defaultValue={filters.course} placeholder="z. B. TIF24" /></label></div><div className="filter-actions"><button className="button" type="submit">Blockpläne suchen</button><Link href="/">Filter zurücksetzen</Link></div></form></section>
    <section className="results" aria-live="polite"><div className="results__heading"><p><strong>{result.total}</strong> {result.total === 1 ? "Blockplan" : "Blockpläne"} gefunden</p>{result.total ? <span>Seite {result.page} von {result.pages} · Filter sind per URL teilbar.</span> : null}</div>{result.total ? <><PlanGroup title="Aktuell laufend" plans={result.groups.current} /><PlanGroup title="Zukünftig" plans={result.groups.future} /><PlanGroup title="Vergangen" plans={result.groups.past} />{result.pages > 1 ? <nav className="pagination" aria-label="Seitennavigation">{result.page > 1 ? <Link href={pageUrl(filters, result.page - 1)}>Vorherige Seite</Link> : <span>Vorherige Seite</span>}<span>Seite {result.page} von {result.pages}</span>{result.page < result.pages ? <Link href={pageUrl(filters, result.page + 1)}>Nächste Seite</Link> : <span>Nächste Seite</span>}</nav> : null}</> : <div className="empty-state"><h2>Noch keine veröffentlichten Blockpläne</h2><p>Veröffentlichte Blockpläne erscheinen hier automatisch und können anschließend gefiltert werden.</p></div>}</section>
  </SiteShell>;
}
