"use client";

import {
  Autocomplete,
  AutocompleteClear,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteLabel,
  AutocompleteList,
} from "@ui-sdk/react/autocomplete";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";

import { ExternalLinkText } from "@/components/external-link-text";
import { typingDelay } from "@/components/filter-bar";
import { programContactsUrl } from "@/lib/product";
import {
  selectPublicOverview,
  suggestPublicOverview,
  type OverviewChip,
  type OverviewEmptyReason,
  type OverviewSelection,
  type OverviewYear,
  type PublicOverview as Overview,
} from "@/lib/domain/public-overview";

import styles from "./public-overview.module.css";

const allYears = "all";

const neverChanges = () => () => {};
const runningInBrowser = () => true;
const renderedOnServer = () => false;

function addressFor(query: string, year: string): string {
  const parameters = new URLSearchParams();
  if (query.trim()) parameters.set("q", query.trim());
  if (year !== allYears) parameters.set("year", year);
  const search = parameters.toString();
  return search ? `/?${search}` : "/";
}

/* The suggestions are filtered here rather than by the autocomplete, which therefore marks no match of its own. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLocaleLowerCase("de-DE");
  const start = needle ? text.toLocaleLowerCase("de-DE").indexOf(needle) : -1;
  if (start < 0) return text;
  return <>{text.slice(0, start)}<strong>{text.slice(start, start + needle.length)}</strong>{text.slice(start + needle.length)}</>;
}

function CourseLinks({ chips }: { chips: OverviewChip[] }) {
  return <div className={styles.chips}>
    {chips.map((chip) => <Link className={styles.chip} href={chip.href} key={chip.codes.join(" ")}>
      <span className={styles.chipCode}>{chip.label}</span>
      {chip.status ? <span className={styles.chipStatus} data-phase={chip.status.type === "THEORY" ? "theory" : "practice"}>{chip.status.text}</span> : null}
    </Link>)}
  </div>;
}

function YearLabel({ year }: { year: OverviewYear }) {
  return <>
    <span className={styles.yearLabel}>{year.label}</span>
    {year.detail ? <span className={styles.yearDetail}>{year.detail}</span> : null}
  </>;
}

function ProgramList({ programs, years }: Pick<OverviewSelection, "programs" | "years">) {
  const newestFirst = years.toReversed();
  return <div className={styles.programList}>
    {programs.map((program) => <section className={styles.program} key={program.abbreviation}>
      <h3 className={styles.programName}>{program.name}</h3>
      {newestFirst.map((year) => {
        const chips = program.cells[year.year];
        if (!chips) return null;
        return <div className={styles.programYear} key={year.year}>
          <h4 className={styles.programYearHeading}><YearLabel year={year} /></h4>
          <CourseLinks chips={chips} />
        </div>;
      })}
    </section>)}
  </div>;
}

function ProgramTable({ programs, years }: Pick<OverviewSelection, "programs" | "years">) {
  return <div className={styles.tableWrap} role="region" aria-labelledby="results-heading" tabIndex={0}>
    <table className={styles.table} style={{ "--years": years.length } as React.CSSProperties}>
      <thead><tr>
        <th scope="col">Studiengang</th>
        {years.map((year) => <th scope="col" key={year.year}><YearLabel year={year} /></th>)}
      </tr></thead>
      <tbody>{programs.map((program) => <tr key={program.abbreviation}>
        <th scope="row" className={styles.programName}>{program.name}</th>
        {years.map((year) => {
          const chips = program.cells[year.year];
          return <td key={year.year}>{chips
            ? <CourseLinks chips={chips} />
            : <><span aria-hidden="true" className={styles.none}>–</span><span className="sr-only">Kein Plan veröffentlicht</span></>}</td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

function EmptyState({ reason, query, year, exampleCode, onReset }: {
  reason: OverviewEmptyReason; query: string; year: string; exampleCode: string | null; onReset: () => void;
}) {
  if (reason === "nothing-published") {
    return <div className={styles.empty}>
      <h3>Noch keine veröffentlichten Blockpläne</h3>
      <p>Freigegebene Pläne erscheinen hier automatisch.</p>
    </div>;
  }
  const shown = query.trim();
  const [heading, text] = reason === "not-yet-published"
    ? [`Der Plan für „${shown}“ ist noch nicht freigegeben`,
      "Hier stehen die Pläne der laufenden Jahrgänge. Pläne für einen späteren Studienbeginn erscheinen, sobald der Studiengang sie freigibt – der Zeitpunkt ist je Studiengang unterschiedlich."]
    : reason === "not-published"
      ? [`Der Plan für „${shown}“ ist noch nicht freigegeben`,
        "Für diesen Jahrgang ist hier noch kein Plan veröffentlicht. Die Blockpläne erstellt der jeweilige Studiengang. Dort beantwortet man auch Ihre Fragen."]
    : reason === "not-in-year"
      ? [`Für „${shown}“ gibt es keinen Plan mit Studienbeginn ${year}`,
        "Wählen Sie unter „Studienbeginn“ einen anderen Jahrgang oder „Alle“."]
      : [`Kein Studiengang passt zu „${shown}“`,
        `Versuchen Sie den Namen des Studiengangs, zum Beispiel „Personal“ oder „Logistik“${exampleCode ? `, oder eine Kurskennung wie „${exampleCode}“` : ""}.`];
  return <div className={styles.empty}>
    <h3>{heading}</h3>
    <p>{text}</p>
    <div className={styles.emptyActions}>
      {/* A link, so that it also works before or without scripting; with scripting the state resets at once. */}
      <Link className="button" href="/" onClick={onReset}>Suche und Filter zurücksetzen</Link>
      <a className={styles.secondaryAction} href={programContactsUrl}><ExternalLinkText>Kontakt zu den Studiengängen</ExternalLinkText></a>
    </div>
  </div>;
}

/**
 * The address follows once typing rests so filtered results can be shared.
 * Without scripting the GET form lets the server render the same selection from the address.
 */
export function PublicOverview({ overview, initialQuery, initialYear }: { overview: Overview; initialQuery: string; initialYear: string }) {
  const knownYear = (value: string) => overview.years.some((candidate) => String(candidate.year) === value) ? value : allYears;
  const parameters = useSearchParams();
  const fromAddress = parameters
    ? { query: parameters.get("q") ?? "", year: knownYear(parameters.get("year") ?? "") }
    : null;
  /* The address, not the server's props, sets the start: back from a plan, the router renders this page from the props
     of its first load, while the address holds the search written since. */
  const [query, setQuery] = useState(fromAddress?.query ?? initialQuery);
  const [year, setYear] = useState(fromAddress?.year ?? knownYear(initialYear));
  const scripted = useSyncExternalStore(neverChanges, runningInBrowser, renderedOnServer);

  /* A navigation within this page, like the logo's link to „/“ or the browser's back button, keeps the component and its
     state, so the state follows the address whenever it changes — except for the one change this component wrote itself. */
  const address = fromAddress ? addressFor(fromAddress.query, fromAddress.year) : null;
  const [seenAddress, setSeenAddress] = useState(address);
  const [writtenAddress, setWrittenAddress] = useState<string | null>(null);
  if (fromAddress && address !== seenAddress) {
    setSeenAddress(address);
    if (address === writtenAddress) setWrittenAddress(null);
    else {
      setQuery(fromAddress.query);
      setYear(fromAddress.year);
    }
  }

  const pendingAddress = useRef<ReturnType<typeof setTimeout>>(undefined);
  const writeAddress = (next: string) => {
    if (next === `${window.location.pathname}${window.location.search}`) return;
    setWrittenAddress(next);
    window.history.replaceState(null, "", next);
  };
  useEffect(() => {
    const next = addressFor(query, year);
    pendingAddress.current = setTimeout(() => writeAddress(next), typingDelay);
    return () => clearTimeout(pendingAddress.current);
  }, [query, year]);
  /* A link followed before typing rests would leave the address to a timer that fires mid-navigation and replaces the
     plan's address with the search. The search is written at once instead, so that back returns to it. */
  const settleAddress = (event: MouseEvent) => {
    if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
    clearTimeout(pendingAddress.current);
    writeAddress(addressFor(query, year));
  };

  const selection = selectPublicOverview(overview, { query, year });
  const suggestions = suggestPublicOverview(overview, query, year);
  const count = selection.programs.length;
  const reset = () => { setQuery(""); setYear(allYears); };

  return <>
    <form className={styles.panel} role="search" aria-label="Blockpläne suchen" method="get" action="/" onClickCapture={settleAddress}
      onSubmit={(event) => { if (scripted) event.preventDefault(); }}>
      <div className={styles.searchField}>
        <Autocomplete name="q" value={query} onValueChange={setQuery} filter={false}>
          <AutocompleteLabel className={styles.label}>Studiengang oder Kurs suchen</AutocompleteLabel>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <AutocompleteInput className={styles.searchInput} type="search" autoComplete="off" aria-describedby="search-hint"
              placeholder={overview.exampleCode ? `z. B. Personalmanagement oder ${overview.exampleCode}` : "z. B. Personalmanagement"} />
            <AutocompleteClear className={styles.clear} aria-label="Suche löschen">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </AutocompleteClear>
          </div>
          <AutocompleteContent className={styles.suggestions} sideOffset={4}>
            <AutocompleteEmpty className={styles.suggestionsEmpty}>Kein Studiengang und kein Kurs passt.</AutocompleteEmpty>
            <AutocompleteList className={styles.suggestionList}>
              {suggestions.programs.length ? <AutocompleteGroup>
                <AutocompleteGroupLabel className={styles.groupLabel}>Studiengang</AutocompleteGroupLabel>
                {suggestions.programs.map((program) => <AutocompleteItem key={program.abbreviation} value={`program:${program.abbreviation}`}
                  label={program.label} className={styles.suggestion}>
                  <span><Highlighted text={program.name} query={query} /></span>
                  <span className={styles.suggestionDetail}>{program.detail}</span>
                </AutocompleteItem>)}
              </AutocompleteGroup> : null}
              {suggestions.courses.length ? <AutocompleteGroup>
                <AutocompleteGroupLabel className={styles.groupLabel}>Kurse</AutocompleteGroupLabel>
                {suggestions.courses.map((course) => <AutocompleteItem key={course.code} value={`course:${course.code}`} label={course.code}
                  className={styles.suggestion} render={<Link href={course.href} />}>
                  <span className={styles.suggestionCode}>{course.code}</span>
                  <span className={styles.suggestionDetail}>{course.detail}</span>
                </AutocompleteItem>)}
              </AutocompleteGroup> : null}
            </AutocompleteList>
            <p className={styles.keys} aria-hidden="true">
              <span><kbd>↑ ↓</kbd> auswählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Esc</kbd> schließen</span>
            </p>
          </AutocompleteContent>
        </Autocomplete>
        <p className={styles.hint} id="search-hint">Sie kennen die Kurskennung nicht? Der Name des Studiengangs genügt, auch in Teilen.</p>
      </div>

      {overview.years.length > 1 ? <>
        <Field className={`${styles.yearField} ${styles.needsScript}`}>
          <FieldLabel className={styles.label}>Studienbeginn</FieldLabel>
          <SegmentedControl className={styles.segments} value={year} onValueChange={(value) => setYear(value ?? allYears)}>
            <SegmentedControlIndicator className={styles.segmentIndicator} />
            <SegmentedControlItem className={styles.segment} value={allYears}>Alle</SegmentedControlItem>
            {overview.years.map((candidate) => <SegmentedControlItem key={candidate.year} className={styles.segment}
              value={String(candidate.year)}>{candidate.year}</SegmentedControlItem>)}
          </SegmentedControl>
        </Field>
        {/* The segmented control's buttons only choose once scripting runs, so without it a native list takes its place. */}
        <noscript>
          <div className={styles.yearField}>
            <label className={styles.label} htmlFor="year-select">Studienbeginn</label>
            <select className={styles.yearSelect} id="year-select" name="year" defaultValue={year}>
              <option value={allYears}>Alle</option>
              {overview.years.map((candidate) => <option key={candidate.year} value={String(candidate.year)}>{candidate.year}</option>)}
            </select>
          </div>
        </noscript>
      </> : null}

      {scripted ? null : <button className="button" type="submit">Suchen</button>}
    </form>

    <section className={styles.results} aria-labelledby="results-heading" onClickCapture={settleAddress}>
      <h2 className="sr-only" id="results-heading">Blockpläne</h2>
      <div className={styles.resultsHead}>
        <p role="status"><strong>{count}</strong> {count === 1 ? "Studiengang" : "Studiengänge"}
          {query.trim() ? ` ${count === 1 ? "passt" : "passen"} zu „${query.trim()}“` : " mit laufenden Jahrgängen"}</p>
        <p className={styles.next}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
          <span><strong>Studienbeginn {overview.nextYear}:</strong> Die Pläne erscheinen nach und nach.</span>
        </p>
      </div>

      {selection.emptyReason
        ? <EmptyState reason={selection.emptyReason} query={query} year={year} exampleCode={overview.exampleCode} onReset={reset} />
        : <>
          <ProgramTable programs={selection.programs} years={selection.years} />
          <ProgramList programs={selection.programs} years={selection.years} />
        </>}
    </section>
  </>;
}
