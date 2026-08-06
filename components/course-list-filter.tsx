"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type FilterOption = { id: string; label: string };
type YearOption = { year: string };
type FilterValues = { program: string | null; year: string | null; code: string | null; responsibility: string | null };

const codeFilterDelay = 300;
/** The names of the parameters this filter owns, in the order the form offers them. */
const filterNames = ["responsibility", "program", "year", "code"] as const;
/** How each of them is written in the address, which is German like every other internal address of this application. */
const parameterNames: Record<(typeof filterNames)[number], string> = { responsibility: "zustaendigkeit", program: "program", year: "year", code: "code" };

export function CourseListFilter({ programs, years, values }: { programs: FilterOption[]; years: YearOption[]; values: FilterValues }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressValues = { program: values.program ?? "", year: values.year ?? "", code: values.code ?? "", responsibility: values.responsibility ?? "" };
  const [filters, setFilters] = useState(addressValues);
  const filtersRef = useRef(addressValues);
  const [pending, startNavigation] = useTransition();

  useEffect(() => () => {
    if (codeTimer.current) clearTimeout(codeTimer.current);
  }, []);

  /**
   * The address is not this form's alone: the way out of an empty result sets the responsibility, and the back key
   * restores whatever was set before. Both reach the form as values it never wrote, and it has to show them — a form
   * that kept its own would claim a narrowing the list beneath it no longer stands on.
   *
   * What the form itself sets arrives here a second time, unchanged, once the list has been read anew; adopting it
   * again costs a render and changes nothing. The course code is the one value held back, and only for as long as a
   * delayed entry is still outstanding: between the keystroke and the navigation it triggers, the field is ahead of
   * the address on purpose, and overwriting it would take back the very entry that is on its way.
   */
  const { program, year, code, responsibility } = addressValues;
  useEffect(() => {
    const fromAddress = { program, year, code, responsibility };
    const nextFilters = codeTimer.current ? { ...fromAddress, code: filtersRef.current.code } : fromAddress;
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
  }, [program, year, code, responsibility]);

  function applyFilters(nextFilters: typeof addressValues) {
    const params = new URLSearchParams(searchParams.toString());
    for (const name of filterNames) {
      const value = nextFilters[name].trim();
      if (value) params.set(parameterNames[name], value);
      else params.delete(parameterNames[name]);
    }
    const query = params.toString();
    startNavigation(() => router.replace(`/intern/kurse${query ? `?${query}` : ""}`, { scroll: false }));
  }

  function changeFilter(name: keyof typeof filters, value: string) {
    const nextFilters = { ...filtersRef.current, [name]: value };
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    return nextFilters;
  }

  function applyImmediately(nextFilters: typeof filters) {
    if (codeTimer.current) clearTimeout(codeTimer.current);
    codeTimer.current = null;
    applyFilters(nextFilters);
  }

  /**
   * Emptying every filter goes the same way as changing one, so the address keeps what the filter does not own — the
   * sorting outlives the reset the way it outlives every other change here.
   */
  function resetFilters() {
    const emptyFilters = { program: "", year: "", code: "", responsibility: "" };
    filtersRef.current = emptyFilters;
    setFilters(emptyFilters);
    applyImmediately(emptyFilters);
  }
  const anyFilterSet = filterNames.some((name) => filters[name].trim());

  return <form className="filter-grid course-list-filter" role="search" aria-label="Kurse filtern"
    aria-busy={pending} onSubmit={(event) => { event.preventDefault(); applyImmediately(filtersRef.current); }}>
    {/* The empty value is the responsibility one opens on, so the plain list address is the own courses and only the
        wider view carries a parameter — the same way the comparison writes only its non-default scope. Of the two
        states it has, one is that default: a tick box therefore says in its own label what the choice is and reaches
        it in a single press, where a select of two entries would hide the default behind its own closed state. */}
    <label className="course-list-filter__responsibility"><input name="zustaendigkeit" type="checkbox" value="alle"
      checked={filters.responsibility === "alle"}
      onChange={(event) => applyImmediately(changeFilter("responsibility", event.currentTarget.checked ? "alle" : ""))} /> Auch Kurse anderer Bereiche</label>
    <label className="course-list-filter__program">Studiengang<select name="program" value={filters.program}
      onChange={(event) => applyImmediately(changeFilter("program", event.currentTarget.value))}><option value="">Alle Studiengänge</option>{programs.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
    <label className="course-list-filter__year">Jahrgang<select name="year" value={filters.year}
      onChange={(event) => applyImmediately(changeFilter("year", event.currentTarget.value))}><option value="">Alle Jahrgänge</option>{years.map((option) => <option key={option.year} value={option.year}>{option.year}</option>)}</select></label>
    <label className="course-list-filter__code">Kurskennung<input name="code" type="search" value={filters.code} autoComplete="off" placeholder="z. B. TIF26"
      onChange={(event) => {
        if (codeTimer.current) clearTimeout(codeTimer.current);
        const nextFilters = changeFilter("code", event.currentTarget.value);
        codeTimer.current = setTimeout(() => applyFilters(nextFilters), codeFilterDelay);
      }} /></label>
    {/* Where nothing is filtered there is nothing to empty, and the button says so by standing greyed out instead of
        leaving: a control that comes and goes moves the row it sits in, and it would take the focus with it at the
        very moment it is pressed. It is marked as disabled rather than being disabled, so it keeps that focus — the
        same way the matrix refuses hiding its last column. The refusal is therefore the handler's to carry. */}
    <button type="button" className="course-list-filter__reset" aria-disabled={!anyFilterSet}
      onClick={() => { if (anyFilterSet) resetFilters(); }}>Zurücksetzen</button>
    <span className="sr-only" role="status">{pending ? "Filter werden aktualisiert." : ""}</span>
  </form>;
}
