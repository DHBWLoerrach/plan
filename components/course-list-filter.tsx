"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type FilterOption = { id: string; label: string };
type YearOption = { year: string };
type FilterValues = { program: string | null; year: string | null; code: string | null };

const codeFilterDelay = 300;

export function CourseListFilter({ programs, years, values }: { programs: FilterOption[]; years: YearOption[]; values: FilterValues }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialValues = { program: values.program ?? "", year: values.year ?? "", code: values.code ?? "" };
  const [filters, setFilters] = useState(initialValues);
  const filtersRef = useRef(initialValues);
  const [pending, startNavigation] = useTransition();

  useEffect(() => {
    function readFiltersFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const nextValues = { program: params.get("program") ?? "", year: params.get("year") ?? "", code: params.get("code") ?? "" };
      filtersRef.current = nextValues;
      setFilters(nextValues);
    }
    window.addEventListener("popstate", readFiltersFromUrl);
    return () => {
      window.removeEventListener("popstate", readFiltersFromUrl);
      if (codeTimer.current) clearTimeout(codeTimer.current);
    };
  }, []);

  function applyFilters(nextFilters: typeof initialValues) {
    const params = new URLSearchParams(searchParams.toString());
    for (const name of ["program", "year", "code"]) {
      const value = nextFilters[name as keyof typeof nextFilters].trim();
      if (value) params.set(name, value);
      else params.delete(name);
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

  return <form className="filter-grid course-list-filter" role="search" aria-label="Kurse filtern"
    aria-busy={pending} onSubmit={(event) => { event.preventDefault(); applyImmediately(filtersRef.current); }}>
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
    <Link className="course-list-filter__reset" href="/intern/kurse" onClick={() => {
      if (codeTimer.current) clearTimeout(codeTimer.current);
      const emptyFilters = { program: "", year: "", code: "" };
      filtersRef.current = emptyFilters;
      setFilters(emptyFilters);
    }}>Zurücksetzen</Link>
    <span className="sr-only" role="status">{pending ? "Filter werden aktualisiert." : ""}</span>
  </form>;
}
