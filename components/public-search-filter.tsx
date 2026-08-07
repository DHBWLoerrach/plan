"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { SearchField, useAddressFilters } from "@/components/filter-bar";

export type PublicFilterOption = { value: string; label: string };
export type PublicFilterValues = { area: string; program: string; year: string; course: string };

/** The names of the parameters this filter owns, in the order the form offers them. */
const filterNames = ["course", "area", "program", "year"] as const;
/** The public addresses are English, and each parameter is written the way its field is named. */
const parameterNames = { course: "course", area: "area", program: "program", year: "year" } as const;

/* Whether this code is running at all. The value never changes once it is read, so nothing ever calls back — the
   store exists to give the server a different answer than the browser, not to signal a change. */
const neverChanges = () => () => {};
const runningInBrowser = () => true;
const renderedOnServer = () => false;

/**
 * The filter bar of the public search. It narrows while typing and selecting, in the same way the internal course
 * list does, and it does so by writing the address: a narrowed list stays a link that can be shared.
 *
 * The submit button is rendered on the server and taken away only once this component has mounted: without scripting
 * the form is a plain GET form and the button is the one way to search, so it has to be in the delivered HTML rather
 * than added to it afterwards.
 */
export function PublicSearchFilter({ areas, programs, years, values }: {
  areas: PublicFilterOption[];
  programs: PublicFilterOption[];
  years: PublicFilterOption[];
  values: PublicFilterValues;
}) {
  const { filters, pending, set, type, reset, submit } = useAddressFilters({
    path: "/",
    names: filterNames,
    parameterNames,
    values,
    debounced: "course",
    /* A narrowed list is a different list and starts at its beginning: kept, the page number would point past the end
       of most results and the search would answer an entered course code with an empty page. */
    drops: ["page"],
  });
  /* The server and the first client render agree on false, so the button is part of the delivered markup and
     disappears only after hydration, where it has become redundant. */
  const scripted = useSyncExternalStore(neverChanges, runningInBrowser, renderedOnServer);

  const anyFilterSet = filterNames.some((name) => filters[name].trim());

  return <form className="filter-bar filter-bar--public" role="search" aria-label="Blockpläne filtern" aria-busy={pending}
    onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <div className="filter-bar__fields">
      {/* The course code comes first: whoever knows it is done with one field, and the other three only help those
          who do not. */}
      <SearchField label="Kurskennung" name="course" value={filters.course} describedBy="filter-hint"
        placeholder="Kurskennung suchen, z. B. TIF24" onChange={(value) => type("course", value)} />
      <label><span>Bereich</span><select name="area" value={filters.area}
        onChange={(event) => set("area", event.currentTarget.value)}>
        <option value="">Alle Bereiche</option>
        {areas.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label><span>Studiengang</span><select name="program" value={filters.program}
        onChange={(event) => set("program", event.currentTarget.value)}>
        <option value="">Alle Studiengänge</option>
        {programs.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label><span>Jahrgang</span><select name="year" value={filters.year}
        onChange={(event) => set("year", event.currentTarget.value)}>
        <option value="">Alle Jahrgänge</option>
        {years.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
    </div>
    {/* The row that acts. With scripting it holds the reset alone, because every other filter takes effect as it is
        made; without it, it opens with the button that submits the form. */}
    {!scripted || anyFilterSet ? <div className="filter-bar__actions">
      {scripted ? null : <button className="button button--compact" type="submit">Kurse suchen</button>}
      {/* The reset leads to the bare page as a link, so it works without scripting as well and can be opened in a
          new tab like any other address of this page. */}
      {anyFilterSet ? <Link className="filter-bar__reset" href="/" onClick={(event) => {
        if (!scripted) return;
        event.preventDefault();
        reset();
      }}>Alle Filter zurücksetzen</Link> : null}
    </div> : null}
    <p className="filter-bar__hint" id="filter-hint">Mehrere Filter werden mit UND verknüpft. Die Kurskennung sucht am Anfang und ohne Beachtung der Groß- und Kleinschreibung.</p>
    <span className="sr-only" role="status">{pending ? "Kurse werden gesucht." : ""}</span>
  </form>;
}
