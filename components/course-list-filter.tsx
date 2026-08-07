"use client";

import { SearchField, useAddressFilters } from "@/components/filter-bar";

type FilterOption = { id: string; label: string };
type YearOption = { year: string };
type FilterValues = { program: string | null; year: string | null; code: string | null; responsibility: string | null };
type FilterName = "responsibility" | "program" | "year" | "code";
type ActiveFilter = { name: FilterName; label: string };

/** The names of the parameters this filter owns, in the order the form offers them. */
const filterNames: readonly FilterName[] = ["responsibility", "program", "year", "code"];
/** How each of them is written in the address, which is German like every other internal address of this application. */
const parameterNames: Record<FilterName, string> = { responsibility: "zustaendigkeit", program: "program", year: "year", code: "code" };

export function CourseListFilter({ programs, years, values }: { programs: FilterOption[]; years: YearOption[]; values: FilterValues }) {
  const { filters, pending, set, type, reset, submit } = useAddressFilters({
    path: "/intern/kurse",
    names: filterNames,
    parameterNames,
    values: {
      program: values.program ?? "", year: values.year ?? "", code: values.code ?? "", responsibility: values.responsibility ?? "",
    },
    debounced: "code",
  });

  const anyFilterSet = filterNames.some((name) => filters[name].trim());
  const activeFilters: ActiveFilter[] = [];
  const selectedProgram = programs.find((option) => option.id === filters.program);
  if (filters.code.trim()) activeFilters.push({ name: "code", label: `Kurskennung: ${filters.code.trim()}` });
  if (filters.program.trim()) activeFilters.push({ name: "program", label: `Studiengang: ${selectedProgram?.label ?? filters.program}` });
  if (filters.year.trim()) activeFilters.push({ name: "year", label: `Jahrgang: ${filters.year}` });
  if (filters.responsibility === "alle") activeFilters.push({ name: "responsibility", label: "Kurse anderer Bereiche" });

  return <form className="filter-bar course-list-filter" role="search" aria-label="Kurse filtern"
    aria-busy={pending} onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <div className="filter-bar__fields">
      <SearchField label="Kurskennung" name="code" value={filters.code} placeholder="Kurskennung suchen, z. B. TIF26"
        onChange={(value) => type("code", value)} />
      <label><span>Studiengang</span><select name="program" value={filters.program}
        onChange={(event) => set("program", event.currentTarget.value)}><option value="">Alle Studiengänge</option>{programs.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label className="course-list-filter__year"><span>Jahrgang</span><select name="year" value={filters.year}
        onChange={(event) => set("year", event.currentTarget.value)}><option value="">Alle Jahrgänge</option>{years.map((option) => <option key={option.year} value={option.year}>{option.year}</option>)}</select></label>
    </div>
    <div className="filter-bar__actions">
      {/* The empty value is the responsibility one opens on, so the plain list address is the own courses and only the
          wider view carries a parameter. A checkbox exposes that one optional widening without hiding the default in
          a select and names the effect instead of the underlying authorization concept. */}
      <label className="course-list-filter__responsibility"><input name="zustaendigkeit" type="checkbox" value="alle"
        checked={filters.responsibility === "alle"}
        onChange={(event) => set("responsibility", event.currentTarget.checked ? "alle" : "")} /> Kurse anderer Bereiche einbeziehen</label>
      {anyFilterSet ? <button type="button" className="filter-bar__reset" onClick={reset}>Alle Filter zurücksetzen</button> : null}
    </div>
    {activeFilters.length ? <div className="filter-bar__active" aria-label="Aktive Filter">
      <span>Aktive Filter:</span>
      <ul>{activeFilters.map((filter) => <li key={filter.name}><button type="button"
        aria-label={`Filter ${filter.label} entfernen`}
        onClick={() => set(filter.name, "")}>{filter.label}<span aria-hidden="true">×</span></button></li>)}</ul>
    </div> : null}
    <span className="sr-only" role="status">{pending ? "Filter werden aktualisiert." : ""}</span>
  </form>;
}
