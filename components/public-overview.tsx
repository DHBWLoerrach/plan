"use client";

import { nearestInDirection } from "@ui-sdk/core";
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
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { ExternalLinkText } from "@/components/external-link-text";
import { typingDelay } from "@/components/filter-bar";
import { programContactsUrl } from "@/lib/product";
import {
  highlightPieces,
  searchWords,
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

/* Safari refuses more than 100 replacements in 30 seconds with an error; the address then lags behind, the page does not. */
function writeAddress(next: string) {
  if (next === `${window.location.pathname}${window.location.search}`) return;
  try {
    window.history.replaceState(null, "", next);
  } catch {
    // The next change tries again.
  }
}

function addressFor(query: string, year: string): string {
  const parameters = new URLSearchParams();
  if (query.trim()) parameters.set("q", query.trim());
  if (year !== allYears) parameters.set("year", year);
  const search = parameters.toString();
  return search ? `/?${search}` : "/";
}

/* The suggestions are filtered here rather than by the autocomplete, which therefore marks no match of its own. */
/* The suggestions say what the results below say, so that the two never contradict each other. */
function suggestionsEmptyText(query: string, reason: OverviewEmptyReason | null): string {
  if (!searchWords(query).length) return "Geben Sie einen Studiengang oder eine Kurskennung ein.";
  if (reason === "ended") return "Dieses Studium ist beendet. Den Plan finden Sie unten.";
  if (reason === "not-published" || reason === "not-yet-published") return "Für diesen Jahrgang ist noch kein Plan freigegeben.";
  if (reason === "not-in-year") return "Für den gewählten Studienbeginn gibt es keinen passenden Plan.";
  if (reason === "nothing-running") return "Zurzeit läuft kein Jahrgang mit veröffentlichtem Plan.";
  if (reason === "nothing-published") return "Noch keine veröffentlichten Blockpläne.";
  return "Kein Studiengang und kein Kurs passt.";
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return <>{highlightPieces(text, query).map((piece) => piece.marked ? <strong key={piece.start}>{piece.text}</strong> : piece.text)}</>;
}

function CourseLinkContent({ chip }: { chip: OverviewChip }) {
  return <>
    <span className={styles.chipCode}>{chip.label}</span>
    {/* The space keeps code and status two words for screen readers and agents; the grid lays it out as nothing. */}
    {chip.status ? " " : null}
    {chip.status ? <span className={styles.chipStatus} data-phase={chip.status.type === "THEORY" ? "theory" : "practice"}>{chip.status.text}</span> : null}
  </>;
}

function CourseLinks({ chips }: { chips: OverviewChip[] }) {
  return <div className={styles.chips}>
    {chips.map((chip) => <Link className={styles.chip} href={chip.href} key={chip.codes.join(" ")}><CourseLinkContent chip={chip} /></Link>)}
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

const arrowDirections: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

function screenRect(element: Element, vertical: boolean) {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  // A wrapped phase label changes the link's height without changing its row.
  return { left, right, top, bottom: vertical ? top : bottom };
}

/*
 * Every link keeps its tab stop, as in any data table; the arrows only add a way across, to the nearest link on screen in
 * their direction, so they follow the links however they wrap. A screen reader reading the table keeps its own arrows.
 */
function moveByArrow(event: KeyboardEvent<HTMLTableElement>) {
  const direction = arrowDirections[event.key];
  if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const from = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!from) return;
  const vertical = direction[1] !== 0;
  const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((link) => link !== from);
  const targets = links.map((link, index) => ({ key: String(index), rect: screenRect(link, vertical) }));
  const next = nearestInDirection(screenRect(from, vertical), targets, direction);
  if (next === undefined) return;
  event.preventDefault();
  links[Number(next)].focus();
}

function ProgramTable({ programs, years, scripted }: Pick<OverviewSelection, "programs" | "years"> & { scripted: boolean }) {
  return <div className={styles.tableView}>
    {/* For sighted keyboard users only: a screen reader reading the table uses the arrows for itself. */}
    {scripted ? <p className={styles.arrowHint} aria-hidden="true">Mit den Pfeiltasten zum nächsten Kurs</p> : null}
    <div className={styles.tableWrap} role="region" aria-labelledby="results-heading" tabIndex={0}>
      <table className={styles.table} style={{ "--years": years.length } as React.CSSProperties} onKeyDown={moveByArrow}>
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
              : <><span aria-hidden="true" className={styles.none}>–</span><span className="sr-only">
              {program.omitted?.includes(year.year) ? "Kein Kurs passt zur Suche" : "Kein Plan veröffentlicht"}
            </span></>}</td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

/* The resets are plain links to „/“: the page's link handling empties the search on a plain click, and a click that opens
   a new tab leaves this one as it is. */
function EmptyState({ reason, query, year, exampleCode, endedPlan }: {
  reason: OverviewEmptyReason; query: string; year: string; exampleCode: string | null; endedPlan?: string;
}) {
  if (reason === "nothing-published") {
    return <div className={styles.empty}>
      <h3>Noch keine veröffentlichten Blockpläne</h3>
      <p>Freigegebene Pläne erscheinen hier automatisch.</p>
    </div>;
  }
  /* Without running years only the course codes of ended ones find anything, which their own reason answers. */
  if (reason === "nothing-running") {
    return <div className={styles.empty}>
      <h3>Zurzeit kein laufender Jahrgang mit veröffentlichtem Plan</h3>
      <p>Pläne beendeter Jahrgänge finden Sie über ihre Kurskennung. Neue Pläne erscheinen hier, sobald der Studiengang sie freigibt.</p>
    </div>;
  }
  const shown = query.trim();
  if (reason === "ended" && endedPlan) {
    return <div className={styles.empty}>
      <h3>Das Studium von „{shown}“ ist beendet</h3>
      <p>Hier stehen die Pläne der laufenden Jahrgänge. Der Plan bleibt abrufbar.</p>
      <div className={styles.emptyActions}>
        <Link className="button" href={endedPlan}>Plan ansehen</Link>
        <Link className={styles.secondaryAction} href="/">Suche und Filter zurücksetzen</Link>
      </div>
    </div>;
  }
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
      <Link className="button" href="/">Suche und Filter zurücksetzen</Link>
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
  /* The address, not the server's props, sets the start: back from a plan, the router renders this page from the props
     of its first load, while the address holds the search written since. */
  const parameters = useSearchParams();
  /* A parameter missing from the address is an empty one, not the props' old value: a search cleared before a plan opened
     must stay cleared on the way back. */
  const [query, setQuery] = useState(() => parameters ? parameters.get("q") ?? "" : initialQuery);
  const [year, setYear] = useState(() => knownYear(parameters ? parameters.get("year") ?? "" : initialYear));
  const scripted = useSyncExternalStore(neverChanges, runningInBrowser, renderedOnServer);

  /* Once a link leads away, the address must stay as it is: the router is on its way, and a replaced address would stop
     it. Any change of the search or the study start, typed, cleared, chosen or made by an agent, shows the page is still
     here; so does back or forward to another address of it. */
  const leaving = useRef(false);
  const stay = () => { leaving.current = false; };
  const current = useRef({ query, year, knownYear });
  useEffect(() => {
    current.current = { query, year, knownYear };
  });

  /* The address follows once typing rests, which keeps each key press from rendering twice and Safari from its limit. */
  const pendingAddress = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (leaving.current) return;
    const next = addressFor(query, year);
    pendingAddress.current = setTimeout(() => writeAddress(next), typingDelay);
    return () => clearTimeout(pendingAddress.current);
  }, [query, year]);

  /* Back and forward between addresses of this page keep the component, so the state takes the address it returns to.
     Following a fragment link, like „Zum Inhalt springen“ right after typing, fires the same event; that one is no step
     back or forward, and the link handling below marks it. Coming back to such an entry later is one. */
  const jumping = useRef(false);
  useEffect(() => {
    const ownPath = window.location.pathname;
    const restore = () => {
      if (jumping.current) {
        jumping.current = false;
        return;
      }
      if (window.location.pathname !== ownPath) return;
      clearTimeout(pendingAddress.current);
      leaving.current = false;
      const search = new URLSearchParams(window.location.search);
      setQuery(search.get("q") ?? "");
      setYear(current.current.knownYear(search.get("year") ?? ""));
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  /* Any link of the page counts, the header's too. */
  useEffect(() => {
    const followLink = (event: globalThis.MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self")) return;
      const target = new URL(link.href, window.location.href);
      const samePage = target.origin === window.location.origin && target.pathname === window.location.pathname;
      /* A jump within the page, like „Zum Inhalt springen“, neither leaves it nor brings a search. Its history event follows
         at once if the fragment changes; one to the fragment already shown fires none, so the mark lapses with the task. */
      if (samePage && target.hash && target.search === window.location.search) {
        jumping.current = target.hash !== window.location.hash;
        setTimeout(() => { jumping.current = false; });
        return;
      }
      /* Nothing pending may fire on the way. Any navigation, to another page or to this one with another address, writes
         the search it leaves at once, for back, and then keeps the address untouched until it has arrived. */
      clearTimeout(pendingAddress.current);
      leaving.current = !samePage || target.search !== window.location.search;
      if (leaving.current) writeAddress(addressFor(current.current.query, current.current.year));
      /* A link to this page itself, like the logo or the reset, brings a search of its own, which the state takes at once:
         the address may already read the same, and then no navigation would hand it on. */
      if (samePage) {
        setQuery(target.searchParams.get("q") ?? "");
        setYear(current.current.knownYear(target.searchParams.get("year") ?? ""));
      }
    };
    document.addEventListener("click", followLink, true);
    return () => document.removeEventListener("click", followLink, true);
  }, []);

  const selection = selectPublicOverview(overview, { query, year });
  const suggestions = suggestPublicOverview(overview, query, year);
  const count = selection.programs.length;

  return <>
    <form className={styles.panel} role="search" aria-label="Blockpläne suchen" method="get" action="/"
      onSubmit={(event) => { if (scripted) event.preventDefault(); }}>
      <div className={styles.searchField}>
        <Autocomplete name="q" value={query} filter={false} onValueChange={(value, details) => {
          /* A course suggestion is a link: its plan opens, and the field keeps the search it was found by. */
          if (details.item?.value.startsWith("course:")) return details.cancel();
          stay();
          setQuery(value);
        }}>
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
            <AutocompleteEmpty className={styles.suggestionsEmpty}>
              {suggestionsEmptyText(query, selection.emptyReason)}
            </AutocompleteEmpty>
            <AutocompleteList className={styles.suggestionList}>
              {suggestions.programs.length ? <AutocompleteGroup>
                <AutocompleteGroupLabel className={styles.groupLabel}>Studiengang</AutocompleteGroupLabel>
                {suggestions.programs.map((program) => <AutocompleteItem key={program.abbreviation} value={`program:${program.abbreviation}`}
                  label={program.label} className={styles.suggestion}>
                  <span><Highlighted text={program.name} query={query} /></span>{" "}
                  <span className={styles.suggestionDetail}>{program.detail}</span>
                </AutocompleteItem>)}
              </AutocompleteGroup> : null}
              {suggestions.courses.length ? <AutocompleteGroup>
                <AutocompleteGroupLabel className={styles.groupLabel}>Kurse</AutocompleteGroupLabel>
                {suggestions.courses.map((course) => <AutocompleteItem key={course.code} value={`course:${course.code}`} label={course.code}
                  className={styles.suggestion} render={<Link href={course.href} />}>
                  <span className={styles.suggestionCode}>{course.code}</span>{" "}
                  <span className={styles.suggestionDetail}>{course.detail}</span>
                </AutocompleteItem>)}
              </AutocompleteGroup> : null}
            </AutocompleteList>
            {suggestions.programs.length || suggestions.courses.length ? <p className={styles.keys} aria-hidden="true">
              <span><kbd>↑ ↓</kbd> auswählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Esc</kbd> schließen</span>
            </p> : null}
          </AutocompleteContent>
        </Autocomplete>
        <p className={styles.hint} id="search-hint">Sie kennen die Kurskennung nicht? Der Name des Studiengangs genügt, auch in Teilen.</p>
      </div>

      {overview.years.length > 1 ? <>
        <Field className={`${styles.yearField} ${styles.needsScript}`}>
          <FieldLabel className={styles.label}>Studienbeginn</FieldLabel>
          <SegmentedControl className={styles.segments} value={year} onValueChange={(value) => { stay(); setYear(value ?? allYears); }}>
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

    <section className={styles.results} aria-labelledby="results-heading">
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
        ? <EmptyState reason={selection.emptyReason} query={query} year={year} exampleCode={overview.exampleCode}
          endedPlan={selection.endedPlan} />
        : <>
          {selection.archivedPlan ? <p className={styles.archived}>
            Das Studium von „{selection.archivedPlan.code}“ ist beendet. <Link href={selection.archivedPlan.href}>Plan ansehen</Link>
          </p> : null}
          <ProgramTable programs={selection.programs} years={selection.years} scripted={scripted} />
          <ProgramList programs={selection.programs} years={selection.years} />
        </>}
    </section>
  </>;
}
