"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

export type PublicFilterOption = { value: string; label: string };
export type PublicFilterValues = { area: string; program: string; year: string; course: string };

/** How long a typed course code rests before it narrows the list, as in the internal course list. */
const codeFilterDelay = 300;
/** The names of the parameters this filter owns, in the order the form offers them. */
const filterNames = ["course", "area", "program", "year"] as const;
type FilterName = (typeof filterNames)[number];

const emptyFilters: PublicFilterValues = { area: "", program: "", year: "", course: "" };

/* Whether this code is running at all. The value never changes once it is read, so nothing ever calls back — the
   store exists to give the server a different answer than the browser, not to signal a change. */
const neverChanges = () => () => {};
const runningInBrowser = () => true;
const renderedOnServer = () => false;

/**
 * The filter bar of the public search. It narrows while typing and selecting, and it does so by writing the address:
 * what is shown stays the page the address names, so a narrowed list can still be shared as a link and read back by
 * a browser that never ran this code.
 *
 * That browser is the reason the submit button is rendered on the server and taken away only once this component has
 * mounted: without scripting the form is a plain GET form and the button is the one way to search, so it has to be
 * in the delivered HTML rather than added to it afterwards.
 */
export function PublicSearchFilter({ areas, programs, years, values }: {
  areas: PublicFilterOption[];
  programs: PublicFilterOption[];
  years: PublicFilterOption[];
  values: PublicFilterValues;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filters, setFilters] = useState(values);
  const filtersRef = useRef(values);
  const [pending, startNavigation] = useTransition();
  /* The server and the first client render agree on false, so the button is part of the delivered markup and
     disappears only after hydration, where it has become redundant. */
  const scripted = useSyncExternalStore(neverChanges, runningInBrowser, renderedOnServer);

  useEffect(() => () => {
    if (codeTimer.current) clearTimeout(codeTimer.current);
  }, []);

  /**
   * The address is not this form's alone: the reset leads to the bare page and the back key restores whatever was set
   * before. Both reach the form as values it never wrote, and it has to show them. The course code is the one value
   * held back, and only while a delayed entry is still outstanding: between the keystroke and the navigation it
   * triggers, the field is ahead of the address on purpose.
   */
  const { area, program, year, course } = values;
  useEffect(() => {
    const fromAddress = { area, program, year, course };
    const nextFilters = codeTimer.current ? { ...fromAddress, course: filtersRef.current.course } : fromAddress;
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
  }, [area, program, year, course]);

  function applyFilters(nextFilters: PublicFilterValues) {
    const params = new URLSearchParams(searchParams.toString());
    for (const name of filterNames) {
      const value = nextFilters[name].trim();
      if (value) params.set(name, value);
      else params.delete(name);
    }
    /* A narrowed list is a different list and starts at its beginning: kept, the page number would point past the end
       of most results and the search would answer an entered course code with an empty page. */
    params.delete("page");
    const query = params.toString();
    startNavigation(() => router.replace(query ? `/?${query}` : "/", { scroll: false }));
  }

  function changeFilter(name: FilterName, value: string) {
    const nextFilters = { ...filtersRef.current, [name]: value };
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    return nextFilters;
  }

  function applyImmediately(nextFilters: PublicFilterValues) {
    if (codeTimer.current) clearTimeout(codeTimer.current);
    codeTimer.current = null;
    applyFilters(nextFilters);
  }

  const anyFilterSet = filterNames.some((name) => filters[name].trim());

  return <form className="public-filter" role="search" aria-label="Blockpläne filtern" aria-busy={pending}
    onSubmit={(event) => { event.preventDefault(); applyImmediately(filtersRef.current); }}>
    <div className="public-filter__fields">
      {/* The course code comes first: whoever knows it is done with one field, and the other three only help those
          who do not. */}
      <label><span>Kurskennung</span><span className="public-filter__search">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input name="course" type="search" value={filters.course} autoComplete="off" aria-describedby="filter-hint"
          placeholder="Kurskennung suchen, z. B. TIF24"
          onChange={(event) => {
            if (codeTimer.current) clearTimeout(codeTimer.current);
            const nextFilters = changeFilter("course", event.currentTarget.value);
            codeTimer.current = setTimeout(() => {
              codeTimer.current = null;
              applyFilters(nextFilters);
            }, codeFilterDelay);
          }} />
      </span></label>
      <label><span>Bereich</span><select name="area" value={filters.area}
        onChange={(event) => applyImmediately(changeFilter("area", event.currentTarget.value))}>
        <option value="">Alle Bereiche</option>
        {areas.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label><span>Studiengang</span><select name="program" value={filters.program}
        onChange={(event) => applyImmediately(changeFilter("program", event.currentTarget.value))}>
        <option value="">Alle Studiengänge</option>
        {programs.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label><span>Jahrgang</span><select name="year" value={filters.year}
        onChange={(event) => applyImmediately(changeFilter("year", event.currentTarget.value))}>
        <option value="">Alle Jahrgänge</option>
        {years.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
    </div>
    {/* The row that acts. With scripting it holds the reset alone, because every other filter takes effect as it is
        made; without it, it opens with the button that submits the form. */}
    {!scripted || anyFilterSet ? <div className="public-filter__actions">
      {scripted ? null : <button className="button button--compact" type="submit">Kurse suchen</button>}
      {/* The reset leads to the bare page as a link, so it works without scripting as well and can be opened in a
          new tab like any other address of this page. */}
      {anyFilterSet ? <Link className="public-filter__reset" href="/" onClick={(event) => {
        if (!scripted) return;
        event.preventDefault();
        filtersRef.current = emptyFilters;
        setFilters(emptyFilters);
        applyImmediately(emptyFilters);
      }}>Alle Filter zurücksetzen</Link> : null}
    </div> : null}
    <p className="public-filter__hint" id="filter-hint">Mehrere Filter werden mit UND verknüpft. Die Kurskennung sucht am Anfang und ohne Beachtung der Groß- und Kleinschreibung.</p>
    <span className="sr-only" role="status">{pending ? "Kurse werden gesucht." : ""}</span>
  </form>;
}
