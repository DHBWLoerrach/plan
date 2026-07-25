# Blockplan-Editor: Erfassung und Seitenaufbau — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die interne Blockplanseite so umbauen, dass ein vollständiger Studienverlauf ohne Seitensprünge am Stück erfassbar ist und selten genutzte Verwaltungsfunktionen den Arbeitsbereich nicht mehr verdecken.

**Architecture:** Zwei neue reine Domänenmodule (`phase-sequence`, `calendar-format`) liefern Anschlussvorbelegung, Randkontext und Datumsdarstellung. Die vier Server Actions, die heute mit `redirect` enden, geben stattdessen State zurück; zwei neue Client-Sektionen (`PhaseSection`, `EventSection`) halten eine gemeinsame Statusfläche, die das Unmounten einzelner Editoren überdauert. Die Seite ordnet ihre Sektionen nach Nutzungshäufigkeit neu.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19 (`useActionState`), TypeScript, better-sqlite3 + Drizzle, vitest, Tailwind v4 mit handgeschriebenem `app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-07-25-blockplan-editor-ux-design.md`

## Global Constraints

- Dokumentation und Domänensprache auf Deutsch, Code-Bezeichner und Kommentare auf Englisch, Commit-Messages auf Englisch (`AGENTS.md`).
- Vor dem Schreiben von Next.js-Code den einschlägigen Guide in `node_modules/next/dist/docs/` lesen; diese Version weicht von älteren ab (`AGENTS.md`).
- WCAG 2.2 AA ist Abnahmekriterium (`docs/BARRIEREFREIHEIT.md`). Jeder Status wird textlich benannt, nie allein durch Farbe, Symbol oder Position.
- Kalendertage sind zeitzonenlose `YYYY-MM-DD`-Werte; jede Datumsrechnung läuft in UTC (`lib/domain/calendar-day.ts`).
- Zeiträume gelten einschließlich beider Grenztage (`docs/FACHLICHE_REGELN.md`).
- Kursphasen mehrerer Kurse haben keine gemeinsame Identität; eine Änderung wirkt nur auf die bearbeitete Kursphase (`docs/adr/0006-kursphasen-ohne-gemeinsame-identitaet.md`).
- Tests liegen unter `test/domain/` und `test/services/`, laufen mit `npm test` (vitest, Include-Pattern `test/**/*.test.ts`). Für React-Komponenten existiert kein Testsetup — UI-Tasks werden manuell gegen eine Checkliste verifiziert, es wird kein Komponententest-Framework eingeführt.
- Nach jeder Task müssen `npm run typecheck`, `npm run lint` und `npm test` grün sein.
- Nicht im Umfang: Entwurfsvorschau und Veröffentlichungsablauf. Die Sektion „Veröffentlichung" in `app/intern/blockplaene/[blockPlanId]/page.tsx:186-192` bleibt unverändert.

---

## File Structure

**Neu:**
- `lib/domain/calendar-format.ts` — Darstellung von Kalendertagen und Zeiträumen, optional mit Wochentag.
- `lib/domain/phase-sequence.ts` — Anschlussvorbelegung für die nächste Kursphase und Randkontext eines Semesters.
- `components/date-field.tsx` — Datumseingabe mit Label, Wochentagshinweis und Fehlerverknüpfung; von Phasen und Terminen genutzt.
- `components/phase-section.tsx` — Client-Sektion Kursphasen: Statusfläche, Semesterleiste, Randkontext, Einträge, Anlegen-Formular.
- `components/event-section.tsx` — Client-Sektion Termine: Statusfläche, Einträge, Anlegen-Formular.
- `test/domain/calendar-day.test.ts`, `test/domain/calendar-format.test.ts`, `test/domain/phase-sequence.test.ts`.

**Geändert:**
- `lib/domain/calendar-day.ts` — nimmt `plusDays` (heute privat in `publication.ts:52-56`) und `daysBetween` auf.
- `lib/domain/publication.ts` — importiert `plusDays` statt es selbst zu definieren; nimmt den Typ `PlanPhase` auf.
- `app/intern/blockplaene/data.ts` — re-exportiert `PlanPhase` aus der Domäne statt ihn zu definieren.
- `app/intern/blockplaene/actions.ts` — vier Actions ohne `redirect`, erweiterte Zustandstypen.
- `components/phase-forms.tsx` — nur noch Bearbeiten und Löschen einer gespeicherten Kursphase; das Anlegen zieht nach `phase-section.tsx`.
- `components/event-forms.tsx` — nur noch Bearbeiten und Löschen eines gespeicherten Termins; das Anlegen zieht nach `event-section.tsx`.
- `components/plan-matrix.tsx` — nutzt `formatCalendarPeriod` statt der lokalen `formatPeriod`.
- `app/intern/blockplaene/[blockPlanId]/page.tsx` — neue Sektionsreihenfolge, Planeinstellungen, keine Status-Suchparameter mehr.
- `app/globals.css` — Klassen für Semesterleiste, Einträge, Randkontext, Statusfläche, Planeinstellungen.

---

## Task 1: Kalenderarithmetik und -formatierung

**Files:**
- Modify: `lib/domain/calendar-day.ts`
- Modify: `lib/domain/publication.ts:52-56`
- Create: `lib/domain/calendar-format.ts`
- Modify: `components/plan-matrix.tsx:8-13`
- Test: `test/domain/calendar-day.test.ts`, `test/domain/calendar-format.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `plusDays(day: string, days: number): string`, `daysBetween(from: string, to: string): number` aus `@/lib/domain/calendar-day`; `formatCalendarDay(day: string, options?: { weekday?: boolean }): string`, `formatCalendarPeriod(startDate: string, endDate: string, options?: { weekday?: boolean }): string`, `weekdayName(day: string): string` aus `@/lib/domain/calendar-format`.

- [ ] **Step 1: Write the failing test für die Arithmetik**

Create `test/domain/calendar-day.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { daysBetween, plusDays } from "@/lib/domain/calendar-day";

describe("plusDays", () => {
  it("advances a calendar day across a month boundary", () => {
    expect(plusDays("2027-03-31", 1)).toBe("2027-04-01");
  });

  it("advances across a year boundary", () => {
    expect(plusDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("steps backwards with a negative count", () => {
    expect(plusDays("2027-04-01", -1)).toBe("2027-03-31");
  });

  it("handles a leap day", () => {
    expect(plusDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("daysBetween", () => {
  it("counts the days strictly between two calendar days", () => {
    expect(daysBetween("2027-06-19", "2027-09-14")).toBe(86);
  });

  it("returns zero for days that follow one another directly", () => {
    expect(daysBetween("2027-03-31", "2027-04-01")).toBe(0);
  });

  it("returns zero when the later day is not after the earlier one", () => {
    expect(daysBetween("2027-04-01", "2027-03-31")).toBe(0);
  });

  it("counts across a year boundary", () => {
    expect(daysBetween("2026-12-31", "2027-01-15")).toBe(14);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/domain/calendar-day.test.ts`
Expected: FAIL — `plusDays` und `daysBetween` werden nicht aus `@/lib/domain/calendar-day` exportiert.

- [ ] **Step 3: Implement the arithmetic**

Append to `lib/domain/calendar-day.ts`:

```ts
/** The calendar day the given number of days after the given one; a negative count steps backwards. */
export function plusDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The number of days strictly between two calendar days, so directly consecutive days yield zero. Used to name the
 * span a draft leaves unassigned between two course phases.
 */
export function daysBetween(from: string, to: string): number {
  const difference = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(0, Math.round(difference / 86_400_000) - 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/domain/calendar-day.test.ts`
Expected: PASS (8 Tests)

- [ ] **Step 5: Remove the duplicate `plusDays` from `publication.ts`**

In `lib/domain/publication.ts` die lokale Definition in Zeile 52-56 löschen und stattdessen importieren. Der Import-Block am Dateianfang wird zu:

```ts
import { plusDays } from "@/lib/domain/calendar-day";
import type { EventCategory } from "@/lib/domain/event-category";
import { type PhaseType, phaseTypeLabel } from "@/lib/domain/phase-type";
```

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run: `npm test && npm run typecheck`
Expected: PASS — insbesondere `test/domain/publication.test.ts` bleibt grün, weil `plusDays` sich identisch verhält.

- [ ] **Step 7: Write the failing test für die Formatierung**

Create `test/domain/calendar-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatCalendarDay, formatCalendarPeriod, weekdayName } from "@/lib/domain/calendar-format";

describe("formatCalendarDay", () => {
  it("formats a calendar day in German notation", () => {
    expect(formatCalendarDay("2027-03-09")).toBe("09.03.2027");
  });

  it("prefixes the abbreviated weekday when asked", () => {
    expect(formatCalendarDay("2027-03-09", { weekday: true })).toBe("Di 09.03.2027");
  });

  it("stays on the calendar day regardless of the local time zone", () => {
    expect(formatCalendarDay("2027-01-01", { weekday: true })).toBe("Fr 01.01.2027");
  });
});

describe("formatCalendarPeriod", () => {
  it("joins start and end with an en dash", () => {
    expect(formatCalendarPeriod("2026-10-01", "2026-12-31")).toBe("01.10.2026 – 31.12.2026");
  });

  it("collapses a period that starts and ends on the same day", () => {
    expect(formatCalendarPeriod("2026-10-01", "2026-10-01")).toBe("01.10.2026");
  });

  it("prefixes both weekdays when asked", () => {
    expect(formatCalendarPeriod("2026-10-01", "2026-12-31", { weekday: true })).toBe("Do 01.10.2026 – Do 31.12.2026");
  });
});

describe("weekdayName", () => {
  it("names the weekday in full", () => {
    expect(weekdayName("2027-06-22")).toBe("Dienstag");
  });

  it("names a Saturday", () => {
    expect(weekdayName("2027-06-19")).toBe("Samstag");
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run test/domain/calendar-format.test.ts`
Expected: FAIL — `lib/domain/calendar-format.ts` existiert nicht.

- [ ] **Step 9: Implement the formatting**

Create `lib/domain/calendar-format.ts`:

```ts
/**
 * Presentation of timezone-free calendar days. The weekday is spelled out here instead of taken from `Intl`, because
 * the abbreviations differ between ICU builds while the editor compares them against printed block plans.
 */
const abbreviatedWeekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const fullWeekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const dayFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function utcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** The full German name of the weekday a calendar day falls on. */
export function weekdayName(day: string): string {
  return fullWeekdays[utcDate(day).getUTCDay()];
}

/** A calendar day as `TT.MM.JJJJ`, optionally preceded by its abbreviated weekday. */
export function formatCalendarDay(day: string, options?: { weekday?: boolean }): string {
  const date = utcDate(day);
  const formatted = dayFormatter.format(date);
  return options?.weekday ? `${abbreviatedWeekdays[date.getUTCDay()]} ${formatted}` : formatted;
}

/** An inclusive period; a period of a single day collapses to that day (FACHLICHE_REGELN.md). */
export function formatCalendarPeriod(startDate: string, endDate: string, options?: { weekday?: boolean }): string {
  const start = formatCalendarDay(startDate, options);
  const end = formatCalendarDay(endDate, options);
  return start === end ? start : `${start} – ${end}`;
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run test/domain/calendar-format.test.ts`
Expected: PASS (8 Tests)

- [ ] **Step 11: Let the public matrix use the shared formatter**

In `components/plan-matrix.tsx` die lokale Funktion `formatPeriod` (Zeile 8-13) löschen, den Import ergänzen und beide Aufrufstellen umstellen.

Import ergänzen:

```ts
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
```

In Zeile 34 `formatPeriod(row.startDate, row.endDate)` ersetzen durch `formatCalendarPeriod(row.startDate, row.endDate)`.

In Zeile 40 `formatPeriod(event.startDate, event.endDate ?? event.startDate)` ersetzen durch `formatCalendarPeriod(event.startDate, event.endDate ?? event.startDate)`.

Die öffentliche Ansicht bleibt bewusst ohne Wochentag — er dient der Eingabekontrolle im Editor.

- [ ] **Step 12: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: alles grün.

```bash
git add lib/domain/calendar-day.ts lib/domain/calendar-format.ts lib/domain/publication.ts components/plan-matrix.tsx test/domain/calendar-day.test.ts test/domain/calendar-format.test.ts
git commit -m "Add shared calendar arithmetic and formatting"
```

---

## Task 2: Anschlussvorbelegung für die nächste Kursphase

**Files:**
- Modify: `lib/domain/publication.ts` (Typ `PlanPhase` aufnehmen)
- Modify: `app/intern/blockplaene/data.ts:9`
- Create: `lib/domain/phase-sequence.ts`
- Test: `test/domain/phase-sequence.test.ts`

**Interfaces:**
- Consumes: `plusDays` aus `@/lib/domain/calendar-day` (Task 1).
- Produces: Typ `PlanPhase = DraftPhase & { id: string; code: string }` aus `@/lib/domain/publication`; Typ `NextPhaseDefaults` und `nextPhaseDefaults(input: { phases: PlanPhase[]; courses: { id: string; code: string }[]; semester: number }): NextPhaseDefaults` aus `@/lib/domain/phase-sequence`.

- [ ] **Step 1: Move the `PlanPhase` type into the domain layer**

Der Typ liegt heute in `app/intern/blockplaene/data.ts:9`. Die neuen Domänenfunktionen brauchen ihn, dürfen aber nicht aus `app/` importieren.

In `lib/domain/publication.ts` direkt nach der Deklaration von `DraftPhase` ergänzen:

```ts
/** A saved draft phase as the editor lists it: the domain data plus its identity and the code of its course. */
export type PlanPhase = DraftPhase & { id: string; code: string };
```

In `app/intern/blockplaene/data.ts` die Zeile `export type PlanPhase = DraftPhase & { id: string; code: string };` löschen und die Import-Zeile 5 sowie einen Re-Export anpassen:

```ts
import type { DraftEvent, DraftPhase, PlanPhase } from "@/lib/domain/publication";

export type { PlanPhase };
```

`DraftPhase` bleibt im Import, weil `blockPlanDraftPhases` ihn weiterhin in seiner Rückgabe verwendet. Bestehende Importe von `PlanPhase` aus `../data` (etwa `page.tsx:18`) funktionieren durch den Re-Export unverändert weiter.

- [ ] **Step 2: Write the failing test**

Create `test/domain/phase-sequence.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { nextPhaseDefaults } from "@/lib/domain/phase-sequence";
import type { PlanPhase } from "@/lib/domain/publication";

const courses = [
  { id: "course-a", code: "TIF26A" },
  { id: "course-b", code: "TIF26B" },
];

const phases: PlanPhase[] = [
  { id: "p1", code: "TIF26A", courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
  { id: "p2", code: "TIF26A", courseId: "course-a", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
  { id: "p3", code: "TIF26B", courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" },
  { id: "p4", code: "TIF26B", courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2027-01-01", endDate: "2027-03-31" },
];

describe("nextPhaseDefaults", () => {
  it("continues the day after the latest phase and flips the phase type", () => {
    expect(nextPhaseDefaults({ phases, courses, semester: 1 })).toEqual({
      courseIds: ["course-a", "course-b"],
      semester: "1",
      type: "THEORY",
      startDate: "2027-04-01",
      endDate: "",
      ambiguousPredecessors: [],
    });
  });

  it("flips practice back to theory", () => {
    const theoryLast: PlanPhase[] = [phases[0], phases[2]];

    expect(nextPhaseDefaults({ phases: theoryLast, courses, semester: 1 })).toMatchObject({
      type: "PRACTICE",
      startDate: "2027-01-01",
    });
  });

  it("takes the predecessor from an earlier semester when the opened one is still empty", () => {
    expect(nextPhaseDefaults({ phases, courses, semester: 2 })).toMatchObject({
      semester: "2",
      type: "THEORY",
      startDate: "2027-04-01",
    });
  });

  it("prefers a predecessor inside the opened semester over one before it", () => {
    const withSecondSemester: PlanPhase[] = [
      ...phases,
      { id: "p5", code: "TIF26A", courseId: "course-a", semester: 2, type: "THEORY", startDate: "2027-04-01", endDate: "2027-06-30" },
      { id: "p6", code: "TIF26B", courseId: "course-b", semester: 2, type: "THEORY", startDate: "2027-04-01", endDate: "2027-06-30" },
    ];

    expect(nextPhaseDefaults({ phases: withSecondSemester, courses, semester: 2 })).toMatchObject({
      type: "PRACTICE",
      startDate: "2027-07-01",
    });
  });

  it("ignores phases of a later semester", () => {
    const withThirdSemester: PlanPhase[] = [
      ...phases,
      { id: "p7", code: "TIF26A", courseId: "course-a", semester: 3, type: "THEORY", startDate: "2028-04-01", endDate: "2028-06-30" },
      { id: "p8", code: "TIF26B", courseId: "course-b", semester: 3, type: "THEORY", startDate: "2028-04-01", endDate: "2028-06-30" },
    ];

    expect(nextPhaseDefaults({ phases: withThirdSemester, courses, semester: 1 })).toMatchObject({
      startDate: "2027-04-01",
    });
  });

  it("leaves the defaults empty when the selected courses end on different days", () => {
    const diverging: PlanPhase[] = [
      phases[0],
      { id: "p9", code: "TIF26B", courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-01-31" },
    ];

    expect(nextPhaseDefaults({ phases: diverging, courses, semester: 1 })).toEqual({
      courseIds: ["course-a", "course-b"],
      semester: "1",
      type: "",
      startDate: "",
      endDate: "",
      ambiguousPredecessors: [
        { code: "TIF26A", endDate: "2026-12-31" },
        { code: "TIF26B", endDate: "2027-01-31" },
      ],
    });
  });

  it("leaves the defaults empty when the selected courses end on different phase types", () => {
    const diverging: PlanPhase[] = [
      phases[0],
      { id: "p10", code: "TIF26B", courseId: "course-b", semester: 1, type: "PRACTICE", startDate: "2026-10-01", endDate: "2026-12-31" },
    ];

    expect(nextPhaseDefaults({ phases: diverging, courses, semester: 1 })).toMatchObject({
      type: "",
      startDate: "",
      ambiguousPredecessors: [
        { code: "TIF26A", endDate: "2026-12-31" },
        { code: "TIF26B", endDate: "2026-12-31" },
      ],
    });
  });

  it("reports an empty end date for a selected course without any phase yet", () => {
    expect(nextPhaseDefaults({ phases: [phases[0]], courses, semester: 1 })).toMatchObject({
      startDate: "",
      ambiguousPredecessors: [
        { code: "TIF26A", endDate: "2026-12-31" },
        { code: "TIF26B", endDate: "" },
      ],
    });
  });

  it("returns empty defaults without a hint when no course has a phase yet", () => {
    expect(nextPhaseDefaults({ phases: [], courses, semester: 1 })).toEqual({
      courseIds: ["course-a", "course-b"],
      semester: "1",
      type: "",
      startDate: "",
      endDate: "",
      ambiguousPredecessors: [],
    });
  });

  it("works for a single selected course", () => {
    expect(nextPhaseDefaults({ phases, courses: [courses[0]], semester: 1 })).toMatchObject({
      courseIds: ["course-a"],
      type: "THEORY",
      startDate: "2027-04-01",
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/domain/phase-sequence.test.ts`
Expected: FAIL — `lib/domain/phase-sequence.ts` existiert nicht.

- [ ] **Step 4: Implement `nextPhaseDefaults`**

Create `lib/domain/phase-sequence.ts`:

```ts
import { plusDays } from "@/lib/domain/calendar-day";
import type { PhaseType } from "@/lib/domain/phase-type";
import type { PlanPhase } from "@/lib/domain/publication";

export type NextPhaseDefaults = {
  courseIds: string[];
  semester: string;
  /** Empty when the selected courses do not share one predecessor type. */
  type: string;
  /** Empty when the selected courses do not share one predecessor end date. */
  startDate: string;
  endDate: string;
  /** One entry per selected course when no unambiguous default was possible; an empty end date means no phase yet. */
  ambiguousPredecessors: { code: string; endDate: string }[];
};

const oppositeType: Record<PhaseType, PhaseType> = { THEORY: "PRACTICE", PRACTICE: "THEORY" };

/**
 * The predecessor of a course in the opened semester: its phase with the latest end date among all phases up to and
 * including that semester. Phases of later semesters stay out, so editing an earlier semester of an already planned
 * course still continues where that semester left off.
 */
function predecessor(phases: PlanPhase[], courseId: string, semester: number): PlanPhase | undefined {
  return phases
    .filter((phase) => phase.courseId === courseId && phase.semester <= semester)
    .reduce<PlanPhase | undefined>((latest, phase) => (!latest || phase.endDate > latest.endDate ? phase : latest), undefined);
}

/**
 * The values the create form starts with after a phase was saved. One form serves every selected course, because
 * `createDraftPhases` gives each of them an independent phase with equal details. A default is therefore only offered
 * when it fits every selected course: otherwise the fields stay empty and the differing predecessors are named, since
 * a date that silently holds for just one course is the error that is hardest to find later.
 */
export function nextPhaseDefaults({ phases, courses, semester }: {
  phases: PlanPhase[];
  courses: { id: string; code: string }[];
  semester: number;
}): NextPhaseDefaults {
  const base = { courseIds: courses.map((course) => course.id), semester: String(semester), type: "", startDate: "", endDate: "" };
  const predecessors = courses.map((course) => ({ code: course.code, phase: predecessor(phases, course.id, semester) }));
  const found = predecessors.filter((entry) => entry.phase);
  if (!found.length) return { ...base, ambiguousPredecessors: [] };

  const unanimous = found.length === courses.length
    && new Set(found.map((entry) => entry.phase!.endDate)).size === 1
    && new Set(found.map((entry) => entry.phase!.type)).size === 1;
  if (!unanimous) {
    return {
      ...base,
      ambiguousPredecessors: predecessors.map((entry) => ({ code: entry.code, endDate: entry.phase?.endDate ?? "" })),
    };
  }

  const shared = found[0].phase!;
  return { ...base, type: oppositeType[shared.type], startDate: plusDays(shared.endDate, 1), ambiguousPredecessors: [] };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/domain/phase-sequence.test.ts`
Expected: PASS (10 Tests)

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: alles grün.

```bash
git add lib/domain/phase-sequence.ts lib/domain/publication.ts app/intern/blockplaene/data.ts test/domain/phase-sequence.test.ts
git commit -m "Derive defaults for the next course phase from its predecessor"
```

---

## Task 3: Randkontext eines Semesters

**Files:**
- Modify: `lib/domain/phase-sequence.ts`
- Test: `test/domain/phase-sequence.test.ts`

**Interfaces:**
- Consumes: `daysBetween` aus `@/lib/domain/calendar-day` (Task 1); Typ `PlanPhase` (Task 2).
- Produces: Typen `PhaseNeighbour`, `UnplannedSpan`, `SemesterContext` und `semesterContext(input: { courses: { id: string; code: string }[]; phases: PlanPhase[]; semester: number }): SemesterContext` aus `@/lib/domain/phase-sequence`.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/phase-sequence.test.ts`. Den Import in Zeile 3 erweitern zu:

```ts
import { nextPhaseDefaults, semesterContext } from "@/lib/domain/phase-sequence";
```

Danach anhängen:

```ts
const spanning: PlanPhase[] = [
  { id: "s1", code: "TIF26A", courseId: "course-a", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
  { id: "s2", code: "TIF26B", courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
  { id: "s3", code: "TIF26A", courseId: "course-a", semester: 2, type: "PRACTICE", startDate: "2027-04-01", endDate: "2027-06-19" },
  { id: "s4", code: "TIF26B", courseId: "course-b", semester: 2, type: "PRACTICE", startDate: "2027-04-01", endDate: "2027-06-19" },
  { id: "s5", code: "TIF26A", courseId: "course-a", semester: 3, type: "THEORY", startDate: "2027-09-14", endDate: "2027-12-31" },
  { id: "s6", code: "TIF26B", courseId: "course-b", semester: 3, type: "THEORY", startDate: "2027-09-14", endDate: "2027-12-31" },
];

describe("semesterContext", () => {
  it("names the last phase before and the first phase after the opened semester", () => {
    const context = semesterContext({ courses, phases: spanning, semester: 2 });

    expect(context.before).toEqual([
      { code: "TIF26A", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
      { code: "TIF26B", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
    ]);
    expect(context.after).toEqual([
      { code: "TIF26A", semester: 3, type: "THEORY", startDate: "2027-09-14", endDate: "2027-12-31" },
      { code: "TIF26B", semester: 3, type: "THEORY", startDate: "2027-09-14", endDate: "2027-12-31" },
    ]);
  });

  it("counts the days the draft leaves unassigned before the following semester", () => {
    expect(semesterContext({ courses, phases: spanning, semester: 2 }).unplanned).toEqual([
      { code: "TIF26A", from: "2027-06-19", to: "2027-09-14", days: 86 },
      { code: "TIF26B", from: "2027-06-19", to: "2027-09-14", days: 86 },
    ]);
  });

  it("reports no unassigned span when the following semester starts the next day", () => {
    const seamless: PlanPhase[] = [
      spanning[0],
      spanning[2],
      { id: "s7", code: "TIF26A", courseId: "course-a", semester: 3, type: "THEORY", startDate: "2027-06-20", endDate: "2027-12-31" },
    ];

    expect(semesterContext({ courses: [courses[0]], phases: seamless, semester: 2 }).unplanned).toEqual([]);
  });

  it("measures the gap from the opened semester, not from the one before it", () => {
    const emptySecond: PlanPhase[] = [spanning[0], spanning[4]];

    expect(semesterContext({ courses: [courses[0]], phases: emptySecond, semester: 2 }).unplanned).toEqual([
      { code: "TIF26A", from: "2027-03-31", to: "2027-09-14", days: 166 },
    ]);
  });

  it("has no predecessor in the first semester", () => {
    const context = semesterContext({ courses, phases: spanning, semester: 1 });

    expect(context.before).toEqual([]);
    expect(context.after).toHaveLength(2);
  });

  it("has no successor in the last planned semester", () => {
    const context = semesterContext({ courses, phases: spanning, semester: 3 });

    expect(context.after).toEqual([]);
    expect(context.unplanned).toEqual([]);
    expect(context.before).toHaveLength(2);
  });

  it("keeps courses apart whose phases run on different days", () => {
    const diverging: PlanPhase[] = [
      spanning[0],
      { id: "s8", code: "TIF26B", courseId: "course-b", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-02-28" },
      spanning[4],
    ];

    expect(semesterContext({ courses, phases: diverging, semester: 2 }).before).toEqual([
      { code: "TIF26A", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
      { code: "TIF26B", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-02-28" },
    ]);
  });

  it("returns empty context for a draft without any phase", () => {
    expect(semesterContext({ courses, phases: [], semester: 1 })).toEqual({ before: [], after: [], unplanned: [] });
  });
});
```

Zur vierten Erwartung: Von `2027-03-31` bis `2027-09-14` liegen 167 Tage Differenz, also 166 Tage echt dazwischen.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/domain/phase-sequence.test.ts`
Expected: FAIL — `semesterContext` wird nicht exportiert.

- [ ] **Step 3: Implement `semesterContext`**

Append to `lib/domain/phase-sequence.ts`. Zuerst den Import in Zeile 1 erweitern:

```ts
import { daysBetween, plusDays } from "@/lib/domain/calendar-day";
```

Danach anhängen:

```ts
export type PhaseNeighbour = {
  code: string;
  semester: number;
  type: PhaseType;
  startDate: string;
  endDate: string;
};

export type UnplannedSpan = { code: string; from: string; to: string; days: number };

export type SemesterContext = {
  /** Per course the last phase belonging to an earlier semester. */
  before: PhaseNeighbour[];
  /** Per course the first phase belonging to a later semester. */
  after: PhaseNeighbour[];
  /** Per course the span between what is planned so far and the following semester. */
  unplanned: UnplannedSpan[];
};

function neighbour(code: string, phase: PlanPhase): PhaseNeighbour {
  return { code, semester: phase.semester, type: phase.type, startDate: phase.startDate, endDate: phase.endDate };
}

function earliest(phases: PlanPhase[]): PlanPhase | undefined {
  return phases.reduce<PlanPhase | undefined>((first, phase) => (!first || phase.startDate < first.startDate ? phase : first), undefined);
}

/**
 * What borders the opened semester. The editor shows one semester at a time, so planning the next block needs to see
 * where the previous one ended and where an already planned following one begins. The unassigned span is measured
 * from the latest phase up to and including the opened semester, which is what a continuing draft actually has to
 * fill.
 */
export function semesterContext({ courses, phases, semester }: {
  courses: { id: string; code: string }[];
  phases: PlanPhase[];
  semester: number;
}): SemesterContext {
  const context: SemesterContext = { before: [], after: [], unplanned: [] };
  for (const course of courses) {
    const ofCourse = phases.filter((phase) => phase.courseId === course.id);
    const previous = predecessor(ofCourse, course.id, semester - 1);
    const next = earliest(ofCourse.filter((phase) => phase.semester > semester));
    if (previous) context.before.push(neighbour(course.code, previous));
    if (next) context.after.push(neighbour(course.code, next));

    const planned = predecessor(ofCourse, course.id, semester);
    if (!planned || !next) continue;
    const days = daysBetween(planned.endDate, next.startDate);
    if (days > 0) context.unplanned.push({ code: course.code, from: planned.endDate, to: next.startDate, days });
  }
  return context;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/domain/phase-sequence.test.ts`
Expected: PASS (18 Tests — 10 aus Task 2 plus 8 neue)

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: alles grün.

```bash
git add lib/domain/phase-sequence.ts test/domain/phase-sequence.test.ts
git commit -m "Derive the surrounding phases and unplanned span of a semester"
```

---

## Task 4: Kursphasen-Sektion mit Erfassungsrhythmus

Ab hier gibt es kein automatisiertes Testsetup für React-Komponenten. Jede Task endet stattdessen mit einer manuellen Verifikation gegen die angegebene Checkliste.

**Files:**
- Modify: `app/intern/blockplaene/actions.ts:154-199`
- Create: `components/date-field.tsx`
- Create: `components/phase-section.tsx`
- Modify: `components/phase-forms.tsx`
- Modify: `app/intern/blockplaene/[blockPlanId]/page.tsx:128-161`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `nextPhaseDefaults`, `semesterContext`, Typen `NextPhaseDefaults`, `PhaseNeighbour`, `UnplannedSpan`, `SemesterContext` (Tasks 2 und 3); `formatCalendarDay`, `formatCalendarPeriod`, `weekdayName` (Task 1).
- Produces: `DateField` aus `@/components/date-field`; `PhaseSection` aus `@/components/phase-section`; erweiterte `PhaseFormState` und `PhaseDetailsFormState` aus `@/app/intern/blockplaene/actions`.

- [ ] **Step 1: Read the Next.js guide on Server Actions**

Run: `ls node_modules/next/dist/docs/`

Den Abschnitt zu Server Actions und Formularen lesen, bevor die Actions geändert werden. Relevant ist, wie Rückgabewerte von `useActionState` mit `revalidatePath` zusammenspielen, wenn keine Navigation stattfindet.

- [ ] **Step 2: Widen the phase form state**

In `app/intern/blockplaene/actions.ts` die Typdefinitionen in Zeile 17-19 ersetzen:

```ts
export type EventFormState = EditorFormState<EventField, EventInput> & { token?: string };
export type PhaseFormState = EditorFormState<PhaseField, PhaseInput> & {
  /** The values the create form starts the next course phase with. */
  next?: NextPhaseDefaults;
  /** Set when a change moved the phase into another semester, so the section can say where it went. */
  movedToSemester?: number;
  /** Changes on every successful save and remounts the uncontrolled fields. */
  token?: string;
};
export type PhaseDetailsFormState = EditorFormState<PhaseField, PhaseDetails> & { movedToSemester?: number };
```

Die Importe am Dateianfang ergänzen:

```ts
import { type NextPhaseDefaults, nextPhaseDefaults } from "@/lib/domain/phase-sequence";

import { blockPlanCourses, blockPlanDraftPhases } from "./data";
```

`./data` ist `app/intern/blockplaene/data.ts` — dieselbe Verzeichnisebene wie `actions.ts`.

- [ ] **Step 3: Replace the three phase redirects with returned state**

In `app/intern/blockplaene/actions.ts` die Hilfsfunktion `backToSemester` (Zeile 154-160) löschen und die drei Actions ersetzen:

```ts
export async function createPhasesAction(_: PhaseFormState, formData: FormData): Promise<PhaseFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const input = phaseInput(formData);
  let created: string[];
  try {
    created = createDraftPhases(sqlite, { accountId: await requireAccountId(), blockPlanId, ...input });
  } catch (error) {
    return rejected<PhaseField, PhaseInput>(error, input);
  }
  revalidateBlockPlan(blockPlanId);
  // The defaults for the next phase come from the saved draft, so they already include what was just created.
  const selected = blockPlanCourses(blockPlanId).filter((course) => input.courseIds.includes(course.id));
  return {
    success: created.length > 1
      ? `${created.length} eigenständige Kursphasen wurden angelegt — je ausgewähltem Kurs eine.`
      : "Die Kursphase wurde angelegt.",
    next: nextPhaseDefaults({ phases: blockPlanDraftPhases(blockPlanId), courses: selected, semester: Number(input.semester) }),
    token: created[0],
  };
}

export async function updatePhaseAction(_: PhaseDetailsFormState, formData: FormData): Promise<PhaseDetailsFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const phaseId = String(formData.get("phaseId") ?? "");
  const details = phaseDetails(formData);
  try {
    updateDraftPhase(sqlite, { accountId: await requireAccountId(), phaseId, ...details });
  } catch (error) {
    return rejected<PhaseField, PhaseDetails>(error, details);
  }
  revalidateBlockPlan(blockPlanId);
  // A phase may have been moved out of the opened semester; it then leaves the list and the section says where to.
  const saved = Number(details.semester);
  const opened = Number(formData.get("openSemester") ?? saved);
  return { success: "Die Kursphase wurde gespeichert.", movedToSemester: saved === opened ? undefined : saved };
}

export async function deletePhaseAction(_: PhaseFormState, formData: FormData): Promise<PhaseFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const phaseId = String(formData.get("phaseId") ?? "");
  try {
    deleteDraftPhase(sqlite, { accountId: await requireAccountId(), phaseId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  return { success: "Die Kursphase wurde aus dem Entwurf gelöscht." };
}
```

Der `redirect`-Import in Zeile 4 bleibt: `createBlockPlanFromCourseAction` und `deleteBlockPlanAction` navigieren weiterhin, weil sie die Route wechseln.

- [ ] **Step 4: Create the reusable date field**

Create `components/date-field.tsx`:

```tsx
"use client";

import { useId, useState } from "react";

import { weekdayName } from "@/lib/domain/calendar-format";

/**
 * A date input that names the weekday of the entered day. Block phases practically always begin on a Monday and end
 * on a Friday, so the weekday catches a transposed digit right where it is typed. A native date input renders in the
 * browser locale, which is why the weekday lives next to the field rather than inside it.
 */
export function DateField({ label, name, defaultValue, required, invalid, errorId, hint, autoFocus }: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  invalid?: boolean;
  errorId?: string;
  hint?: string;
  /** Set on the first empty required field after a save, so capturing continues without reaching for the mouse. */
  autoFocus?: boolean;
}) {
  const ids = { field: useId(), weekday: useId(), hint: useId() };
  const [value, setValue] = useState(defaultValue);
  const weekday = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? weekdayName(value) : "";
  const describedBy = [hint ? ids.hint : "", weekday ? ids.weekday : "", invalid ? errorId ?? "" : ""].filter(Boolean).join(" ");
  return <>
    <label htmlFor={ids.field}>{label}</label>
    <input id={ids.field} name={name} type="date" required={required} defaultValue={defaultValue} autoFocus={autoFocus}
      onChange={(event) => setValue(event.target.value)}
      aria-invalid={invalid || undefined} aria-describedby={describedBy || undefined} />
    {weekday ? <p id={ids.weekday} className="field-hint">{weekday}</p> : null}
    {hint ? <p id={ids.hint} className="field-hint">{hint}</p> : null}
  </>;
}
```

`autoFocus` greift beim Mounten. Weil das Anlegen-Formular nach jedem Speichern über einen wechselnden `key` neu gemountet wird, landet der Fokus dort genau einmal je Speichervorgang — nicht beim ersten Aufruf der Seite, wo ein Fokussprung unerwartet käme.

Falls ESLint `jsx-a11y/no-autofocus` meldet, die Stelle mit einer Begründung ausnehmen:

```tsx
{/* eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate focus return after a save, see BARRIEREFREIHEIT.md */}
```

- [ ] **Step 5: Reduce `phase-forms.tsx` to editing a saved phase**

`components/phase-forms.tsx` vollständig ersetzen. Das Anlegen zieht in Task-Schritt 6 nach `phase-section.tsx`; die Detailfelder bleiben hier, weil nur das Bearbeiten sie noch braucht.

```tsx
"use client";

import { useActionState, useId } from "react";

import { type PhaseDetailsFormState, type PhaseFormState, deletePhaseAction, updatePhaseAction } from "@/app/intern/blockplaene/actions";
import { DateField } from "@/components/date-field";
import { ConfirmDeleteForm } from "@/components/editor-controls";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { type PhaseType, phaseTypes } from "@/lib/domain/phase-type";
import type { PhaseField } from "@/lib/services/phase-admin";

export type EditablePhase = { id: string; courseId: string; code: string; semester: number; type: PhaseType; startDate: string; endDate: string };

const periodHint = "Der Zeitraum gilt einschließlich beider Grenztage; Start- und Enddatum dürfen derselbe Tag sein.";

function EditPhaseForm({ blockPlanId, phase, semesters, openSemester, onSaved }: {
  blockPlanId: string;
  phase: EditablePhase;
  semesters: number;
  openSemester: number;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<PhaseDetailsFormState, FormData>(async (previous, formData) => {
    const result = await updatePhaseAction(previous, formData);
    if (result.success) {
      onSaved(result.movedToSemester
        ? `Die Kursphase von ${phase.code} wurde nach Semester ${result.movedToSemester} verschoben.`
        : result.success);
    }
    return result;
  }, {});
  const ids = { error: useId(), semester: useId(), type: useId() };
  // A rejected save keeps what was entered; otherwise the saved phase provides the defaults.
  const values = state.values ?? { semester: String(phase.semester), type: phase.type, startDate: phase.startDate, endDate: phase.endDate };
  const invalid = (field: PhaseField) => state.field === field;
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="phaseId" value={phase.id} />
    <input type="hidden" name="openSemester" value={openSemester} />
    <p>Alle Angaben sind erforderlich. Die Änderung wirkt nur auf diese Kursphase von {phase.code}.</p>
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    <label htmlFor={ids.semester}>Semester</label>
    <select id={ids.semester} name="semester" required defaultValue={values.semester}
      aria-invalid={invalid("semester") || undefined} aria-describedby={invalid("semester") ? ids.error : undefined}>
      {Array.from({ length: semesters }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
    </select>
    <label htmlFor={ids.type}>Phasentyp</label>
    <select id={ids.type} name="type" required defaultValue={values.type}
      aria-invalid={invalid("type") || undefined} aria-describedby={invalid("type") ? ids.error : undefined}>
      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" defaultValue={values.startDate} required
      invalid={invalid("startDate")} errorId={ids.error} hint={periodHint} />
    <DateField label="Enddatum" name="endDate" defaultValue={values.endDate} required
      invalid={invalid("endDate")} errorId={ids.error} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Kursphase speichern"}</button>
  </form>;
}

function DeletePhaseForm({ blockPlanId, phase, onSaved }: { blockPlanId: string; phase: EditablePhase; onSaved: (message: string) => void }) {
  const [state, formAction, isPending] = useActionState<PhaseFormState, FormData>(async (previous, formData) => {
    const result = await deletePhaseAction(previous, formData);
    if (result.success) onSaved(`Die Kursphase von ${phase.code} wurde aus dem Entwurf gelöscht.`);
    return result;
  }, {});
  return <ConfirmDeleteForm action={formAction} error={state.error} isPending={isPending}
    openLabel={`Kursphase von ${phase.code} löschen`}
    confirmLabel="Endgültig löschen"
    heading={`Kursphase von ${phase.code} löschen`}
    consequence={`Die Kursphase vom ${formatCalendarPeriod(phase.startDate, phase.endDate)} wird aus dem Entwurf entfernt. Kursphasen anderer Kurse bleiben bestehen, auch wenn sie gemeinsam angelegt wurden.`}>
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="phaseId" value={phase.id} />
  </ConfirmDeleteForm>;
}

export function PhaseEditorForms({ blockPlanId, phase, semesters, openSemester, onSaved }: {
  blockPlanId: string;
  phase: EditablePhase;
  semesters: number;
  openSemester: number;
  onSaved: (message: string) => void;
}) {
  return <>
    <EditPhaseForm blockPlanId={blockPlanId} phase={phase} semesters={semesters} openSemester={openSemester} onSaved={onSaved} />
    <DeletePhaseForm blockPlanId={blockPlanId} phase={phase} onSaved={onSaved} />
  </>;
}
```

- [ ] **Step 6: Create the phase section**

Create `components/phase-section.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { type PhaseFormState, createPhasesAction } from "@/app/intern/blockplaene/actions";
import { DateField } from "@/components/date-field";
import { CollapsibleEditor } from "@/components/editor-controls";
import { type EditablePhase, PhaseEditorForms } from "@/components/phase-forms";
import { formatCalendarDay, formatCalendarPeriod } from "@/lib/domain/calendar-format";
import type { NextPhaseDefaults, SemesterContext } from "@/lib/domain/phase-sequence";
import { phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import type { SemesterEntry } from "@/lib/domain/semester-overview";
import type { PhaseField } from "@/lib/services/phase-admin";

type PhaseCourse = { id: string; code: string };

/** Completeness and errors of a semester as text, never by colour or position alone (BARRIEREFREIHEIT.md). */
function shortStatus(entry: SemesterEntry): string {
  if (entry.codesWithOverlap.length) return `Fehler: überlappende Kursphasen (${entry.codesWithOverlap.join(", ")})`;
  if (!entry.phaseCount) return "noch keine Kursphase";
  if (entry.codesWithoutPhase.length) {
    return entry.codesWithoutPhase.length === 1
      ? `1 Kurs ohne Kursphase (${entry.codesWithoutPhase[0]})`
      : `${entry.codesWithoutPhase.length} Kurse ohne Kursphase (${entry.codesWithoutPhase.join(", ")})`;
  }
  return "vollständig";
}

function fullStatus(entry: SemesterEntry): string {
  if (!entry.phaseCount) return "In diesem Semester ist noch keine Kursphase gespeichert.";
  const parts = [entry.phaseCount === 1 ? "1 Kursphase" : `${entry.phaseCount} Kursphasen`];
  parts.push(entry.codesWithoutPhase.length
    ? `ohne Kursphase: ${entry.codesWithoutPhase.join(", ")}`
    : "jeder Kurs hat hier mindestens eine Kursphase");
  if (entry.codesWithOverlap.length) parts.push(`Fehler — überlappende Kursphasen: ${entry.codesWithOverlap.join(", ")}`);
  return parts.join(" · ");
}

function CreatePhasesForm({ blockPlanId, courses, semesters, semester, defaults, onSaved }: {
  blockPlanId: string;
  courses: PhaseCourse[];
  semesters: number;
  semester: number;
  defaults: NextPhaseDefaults;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<PhaseFormState, FormData>(async (previous, formData) => {
    const result = await createPhasesAction(previous, formData);
    if (result.success) onSaved(result.success);
    return result;
  }, {});
  const ids = { error: useId(), consequence: useId(), semester: useId(), type: useId(), ambiguous: useId() };
  // After a save the server supplies the defaults for the next phase; a rejected save keeps what was entered.
  const values = state.values ?? state.next ?? defaults;
  const active = state.next ?? defaults;
  const selected = new Set(values.courseIds);
  const invalid = (field: PhaseField) => state.field === field;
  const periodHint = "Der Zeitraum gilt einschließlich beider Grenztage; Start- und Enddatum dürfen derselbe Tag sein.";
  return <form key={state.token ?? "initial"} action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <p>Alle Angaben sind erforderlich. Die Kursphase entsteht zunächst in Semester {semester}; Sie können ein anderes Semester wählen.</p>
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    <fieldset className="account-fieldset" aria-describedby={`${ids.consequence}${invalid("courseIds") ? ` ${ids.error}` : ""}`}>
      <legend>Kurse für die neue Kursphase</legend>
      <p id={ids.consequence}>
        Für jeden ausgewählten Kurs entsteht eine eigenständige Kursphase mit zunächst gleichen Angaben. Danach besteht keine
        gemeinsame Identität: Eine spätere Änderung oder Löschung wirkt nur auf die jeweils bearbeitete Kursphase.
      </p>
      {courses.map((course) => <label key={course.id}>
        <input type="checkbox" name="courseIds" value={course.id} defaultChecked={selected.has(course.id)} /> {course.code}
      </label>)}
    </fieldset>
    {active.ambiguousPredecessors.length ? <p id={ids.ambiguous} className="empty-note">
      Startdatum und Phasentyp bleiben leer, weil die ausgewählten Kurse unterschiedlich weit geplant sind: {active.ambiguousPredecessors
        .map((entry) => entry.endDate
          ? `${entry.code} bis ${formatCalendarDay(entry.endDate, { weekday: true })}`
          : `${entry.code} noch ohne Kursphase`)
        .join(", ")}.
    </p> : null}
    <label htmlFor={ids.semester}>Semester</label>
    <select id={ids.semester} name="semester" required defaultValue={values.semester}
      aria-invalid={invalid("semester") || undefined} aria-describedby={invalid("semester") ? ids.error : undefined}>
      {Array.from({ length: semesters }, (_, index) => index + 1).map((entry) => <option key={entry} value={entry}>Semester {entry}</option>)}
    </select>
    <label htmlFor={ids.type}>Phasentyp</label>
    <select id={ids.type} name="type" required defaultValue={values.type}
      aria-invalid={invalid("type") || undefined} aria-describedby={invalid("type") ? ids.error : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" defaultValue={values.startDate} required
      invalid={invalid("startDate")} errorId={ids.error} hint={periodHint}
      autoFocus={Boolean(state.token) && !values.startDate} />
    <DateField label="Enddatum" name="endDate" defaultValue={values.endDate} required
      invalid={invalid("endDate")} errorId={ids.error}
      autoFocus={Boolean(state.token) && Boolean(values.startDate)} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Kursphasen werden angelegt …" : "Anlegen und nächste erfassen"}</button>
  </form>;
}

export function PhaseSection({ blockPlanId, courses, semesters, semester, overview, phases, context, nextDefaults }: {
  blockPlanId: string;
  courses: PhaseCourse[];
  semesters: number;
  semester: number;
  overview: SemesterEntry[];
  phases: EditablePhase[];
  context: SemesterContext;
  nextDefaults: NextPhaseDefaults;
}) {
  // The status lives on the section, because a moved or deleted phase takes its own editor and state with it.
  const [status, setStatus] = useState<string | null>(null);
  const entry = overview[semester - 1];
  return <section aria-labelledby="draft-heading">
    <h2 id="draft-heading">Kursphasen</h2>
    <p>Der Verlauf wird semesterweise erfasst. Jede Anlage, Änderung und Löschung wird einzeln gespeichert.</p>
    <p role="status">{status ?? ""}</p>

    <nav aria-label="Semester des Blockplans">
      <ul className="semester-bar">{overview.map((item) => <li key={item.semester}>
        <Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${item.semester}`}
          aria-current={item.semester === semester ? "page" : undefined}>
          Semester {item.semester}
        </Link>
        <span>{shortStatus(item)}</span>
      </li>)}</ul>
    </nav>

    <h3>Semester {semester}</h3>
    {entry ? <p>{fullStatus(entry)}</p> : null}

    {context.before.length ? <div className="entry-context">
      <h4>Vor diesem Semester</h4>
      <ul>{context.before.map((item) => <li key={item.code}>
        {item.code}: Semester {item.semester} · {phaseTypeLabel(item.type)} bis {formatCalendarDay(item.endDate, { weekday: true })}
        {" "}<Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${item.semester}`}>Zu Semester {item.semester}</Link>
      </li>)}</ul>
    </div> : null}

    {phases.length ? <ul className="entry-list">{phases.map((phase) => <li key={phase.id}>
      <CollapsibleEditor
        heading={`${phase.code}: ${phaseTypeLabel(phase.type)} ${formatCalendarPeriod(phase.startDate, phase.endDate, { weekday: true })}`}
        openLabel={`Kursphase bearbeiten (${phase.code}, ${formatCalendarPeriod(phase.startDate, phase.endDate)})`}
        closeLabel={`Bearbeitung schließen (${phase.code}, ${formatCalendarPeriod(phase.startDate, phase.endDate)})`}>
        <PhaseEditorForms blockPlanId={blockPlanId} phase={phase} semesters={semesters} openSemester={semester} onSaved={setStatus} />
      </CollapsibleEditor>
    </li>)}</ul> : <p className="empty-note">In Semester {semester} ist noch keine Kursphase gespeichert.</p>}

    {context.after.length ? <div className="entry-context">
      <h4>Nach diesem Semester</h4>
      <ul>{context.after.map((item) => <li key={item.code}>
        {item.code}: Semester {item.semester} · {phaseTypeLabel(item.type)} ab {formatCalendarDay(item.startDate, { weekday: true })}
        {" "}<Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${item.semester}`}>Zu Semester {item.semester}</Link>
      </li>)}</ul>
      {context.unplanned.map((span) => <p key={span.code}>
        Bei {span.code} sind zwischen {formatCalendarDay(span.from)} und {formatCalendarDay(span.to)} noch {span.days} Tage keiner Kursphase zugeordnet.
      </p>)}
    </div> : null}

    <h4>Nächste Kursphase anlegen</h4>
    <CreatePhasesForm blockPlanId={blockPlanId} courses={courses} semesters={semesters} semester={semester}
      defaults={nextDefaults} onSaved={setStatus} />
  </section>;
}
```

- [ ] **Step 7: Wire the section into the page**

In `app/intern/blockplaene/[blockPlanId]/page.tsx`:

Die Importe von `CreatePhasesForm, PhaseEditor` aus `@/components/phase-forms` (Zeile 7) entfernen und ersetzen durch:

```ts
import { PhaseSection } from "@/components/phase-section";
```

Ergänzen:

```ts
import { nextPhaseDefaults, semesterContext } from "@/lib/domain/phase-sequence";
```

Die Hilfsfunktion `semesterStatusText` (Zeile 39-48) löschen — sie lebt jetzt in `phase-section.tsx`.

Dadurch werden zwei Importe in `page.tsx` überflüssig und müssen mit entfernt werden: `phaseTypeLabel` aus `@/lib/domain/phase-type` (Zeile 12) und der Typ `SemesterEntry` aus `@/lib/domain/semester-overview` (Zeile 14). Die Funktion `semesterOverview` aus derselben Zeile bleibt, weil `overview` weiterhin auf der Seite berechnet und an die Sektion übergeben wird.

Die Ableitung von `phaseStatus` (Zeile 85-90) und die Auswertung der Suchparameter `kursphasen-angelegt`, `kursphase-gespeichert`, `kursphase-geloescht` ersatzlos löschen.

Nach der Berechnung von `semesterPhases` (Zeile 84) ergänzen:

```ts
const context = semesterContext({ courses, phases, semester });
const nextDefaults = nextPhaseDefaults({ phases, courses, semester });
```

Die gesamte Sektion `<section aria-labelledby="draft-heading">` (Zeile 128-161) ersetzen durch:

```tsx
    <PhaseSection blockPlanId={plan.id} courses={courses} semesters={semesters} semester={semester}
      overview={overview} phases={semesterPhases} context={context} nextDefaults={nextDefaults} />
```

Der Hinweis auf ein unbekanntes Semester (Zeile 141-143) bleibt erhalten, wandert aber vor die Sektion:

```tsx
    {requestedSemester && !knownSemester
      ? <p role="status">Semester {requestedSemester} gibt es in diesem Blockplan nicht. Angezeigt wird Semester 1.</p>
      : null}
```

- [ ] **Step 8: Add the styles**

Append to `app/globals.css`:

```css
.semester-bar { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1.25rem 0 0; padding: 0; list-style: none; }
.semester-bar li { display: grid; gap: .15rem; padding: .5rem .7rem; background: #fff; border: 1px solid var(--line); }
.semester-bar li:has([aria-current]) { border-left: 4px solid var(--red); }
.semester-bar span { color: var(--gray); font-size: .82rem; }

.entry-list { display: grid; gap: .75rem; margin: 1.25rem 0 0; padding: 0; list-style: none; }
.entry-list > li { padding: 0; }

.entry-context { margin: 1.25rem 0 0; padding: .75rem .9rem; border: 1px dashed var(--line); background: #fff; color: var(--gray); }
.entry-context h4 { margin: 0 0 .4rem; font-size: .9rem; font-weight: 700; }
.entry-context ul { margin: 0; padding: 0; list-style: none; display: grid; gap: .3rem; font-size: .9rem; }
.entry-context p { margin: .5rem 0 0; font-size: .9rem; }

.field-hint { margin: 0; color: var(--gray); font-size: .85rem; }
```

Die `.editor-card`-Regel gilt weiterhin für `CollapsibleEditor` innerhalb von `.entry-list > li`; sie braucht keine Anpassung.

- [ ] **Step 9: Verify manually**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alles grün.

Run: `npm run dev` und einen Blockplan mit mindestens zwei Kursen und drei Semestern öffnen. Prüfen:

1. Eine Kursphase für beide Kurse anlegen. Erwartung: Die Seite scrollt nicht an den Anfang, das Formular bleibt sichtbar, die Erfolgsmeldung steht oben in der Sektion, Startdatum ist auf den Folgetag gesetzt und der Phasentyp gekippt.
2. Direkt eine zweite anlegen. Erwartung: Der Rhythmus wiederholt sich ohne Nachjustieren.
3. In Semester 2 wechseln. Erwartung: Unter „Vor diesem Semester" steht die letzte Phase aus Semester 1 mit Sprunglink.
4. In Semester 3 eine Phase anlegen, dann zu Semester 2 zurück. Erwartung: „Nach diesem Semester" nennt die Phase aus Semester 3 und beziffert die unverplanten Tage.
5. Eine Phase bearbeiten und ihr Semester ändern. Erwartung: Sie verschwindet aus der Liste, die Statusmeldung nennt das Zielsemester.
6. Eine Phase löschen. Erwartung: Der Eintrag verschwindet, die Meldung bleibt oben stehen.
7. Bei zwei Kursen mit unterschiedlich weit geplantem Verlauf eine neue Phase für beide anlegen wollen. Erwartung: Startdatum und Phasentyp bleiben leer, der Hinweis nennt beide Kurse mit ihren abweichenden Enddaten.
8. Ein Datum eintippen. Erwartung: Der Wochentag unter dem Feld aktualisiert sich sofort.
8a. Nach dem Anlegen ohne Maus weitertippen. Erwartung: Der Fokus steht im Enddatum, wenn das Startdatum vorbelegt wurde, sonst im Startdatum. Beim ersten Laden der Seite springt der Fokus nicht.
9. Nach dem Speichern die Seite neu laden. Erwartung: Keine Erfolgsmeldung mehr, keine Statusparameter in der URL, der Semesterparameter bleibt.
10. Mit Tab durch die Sektion navigieren. Erwartung: Fokus überall sichtbar, keine Falle, alle Bedienelemente eindeutig benannt.
11. Fenster auf 320 CSS-Pixel Breite verkleinern. Erwartung: Kein horizontaler Seitenscroll, alle Inhalte erreichbar.

- [ ] **Step 10: Commit**

```bash
git add app/intern/blockplaene/actions.ts app/intern/blockplaene/[blockPlanId]/page.tsx components/date-field.tsx components/phase-forms.tsx components/phase-section.tsx app/globals.css
git commit -m "Keep the create form in place while capturing course phases"
```

---

## Task 5: Termine-Sektion

**Files:**
- Modify: `app/intern/blockplaene/actions.ts:103-139`
- Create: `components/event-section.tsx`
- Modify: `components/event-forms.tsx`
- Modify: `app/intern/blockplaene/[blockPlanId]/page.tsx:163-184`

**Interfaces:**
- Consumes: `DateField` (Task 4); `formatCalendarDay`, `formatCalendarPeriod` (Task 1); `EventFormState` mit `token` (Task 4, Schritt 2).
- Produces: `EventSection` aus `@/components/event-section`.

- [ ] **Step 1: Return a token when creating an event and drop the delete redirect**

In `app/intern/blockplaene/actions.ts` die beiden Actions ersetzen:

```ts
export async function createEventAction(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const input = eventInput(formData);
  let eventId: string;
  try {
    eventId = createDraftEvent(sqlite, { accountId: await requireAccountId(), blockPlanId, ...input });
  } catch (error) {
    return rejected<EventField, EventInput>(error, input);
  }
  revalidateBlockPlan(blockPlanId);
  // The token remounts the create form, so title, description and dates start empty for the next event.
  return { success: `Der Termin „${input.title}“ wurde angelegt.`, token: eventId, values: input };
}

export async function deleteEventAction(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const blockPlanId = String(formData.get("blockPlanId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  try {
    deleteDraftEvent(sqlite, { accountId: await requireAccountId(), eventId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateBlockPlan(blockPlanId);
  return { success: "Der Termin wurde aus dem Entwurf gelöscht." };
}
```

`values: input` trägt Kategorie, Vorläufig-Haken und Kursauswahl in das neu gemountete Formular; welche Felder davon übernommen werden, entscheidet die Komponente im nächsten Schritt.

- [ ] **Step 2: Split `event-forms.tsx` into fields and saved-event editing**

`components/event-forms.tsx` vollständig ersetzen:

```tsx
"use client";

import { useActionState, useId } from "react";

import { type EventFormState, deleteEventAction, updateEventAction } from "@/app/intern/blockplaene/actions";
import { DateField } from "@/components/date-field";
import { ConfirmDeleteForm } from "@/components/editor-controls";
import { eventCategories } from "@/lib/domain/event-category";
import type { DraftEvent } from "@/lib/domain/publication";
import type { EventField, EventInput } from "@/lib/services/event-admin";

export type EventCourse = { id: string; code: string };

/**
 * The values an event form starts with, whether from a saved event, a rejected save or a cleared create form.
 * `EventInput` already has exactly these fields, so the form reuses it instead of introducing a parallel type; a
 * saved event carries `null` for description and end date, which becomes an empty field here.
 */
export function eventDefaults(event?: DraftEvent): EventInput {
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    category: event?.category ?? "",
    startDate: event?.startDate ?? "",
    endDate: event?.endDate ?? "",
    provisional: event?.provisional ?? false,
    courseIds: event?.courseIds ?? [],
  };
}

export function EventFields({ courses, defaults, state, errorId }: {
  courses: EventCourse[];
  defaults: EventInput;
  state: EventFormState;
  errorId: string;
}) {
  const ids = { title: useId(), description: useId(), category: useId(), hint: useId() };
  const affected = new Set(defaults.courseIds);
  const invalid = (field: EventField) => state.field === field;
  return <>
    <p id={ids.hint}>Titel, Kategorie und Startdatum sind erforderlich. Der Titel fasst höchstens 160, die Beschreibung höchstens 2000 Zeichen.</p>
    {state.error ? <p id={errorId} role="alert">{state.error}</p> : null}
    <label htmlFor={ids.title}>Titel</label>
    <input id={ids.title} name="title" type="text" required maxLength={160} defaultValue={defaults.title} autoComplete="off"
      aria-invalid={invalid("title") || undefined} aria-describedby={invalid("title") ? errorId : undefined} />
    <label htmlFor={ids.description}>Beschreibung (optional)</label>
    <textarea id={ids.description} name="description" rows={3} maxLength={2000} defaultValue={defaults.description}
      aria-invalid={invalid("description") || undefined} aria-describedby={invalid("description") ? errorId : undefined} />
    <label htmlFor={ids.category}>Kategorie</label>
    <select id={ids.category} name="category" required defaultValue={defaults.category}
      aria-invalid={invalid("category") || undefined} aria-describedby={invalid("category") ? errorId : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {eventCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" defaultValue={defaults.startDate} required
      invalid={invalid("startDate")} errorId={errorId} />
    <DateField label="Enddatum (optional)" name="endDate" defaultValue={defaults.endDate}
      invalid={invalid("endDate")} errorId={errorId}
      hint="Ohne Enddatum gilt der Termin genau am Starttag, sonst einschließlich beider Grenztage." />
    <label className="account-check"><input type="checkbox" name="provisional" defaultChecked={defaults.provisional} /> Zeitangabe ist vorläufig</label>
    <fieldset className="account-fieldset" aria-describedby={invalid("courseIds") ? errorId : undefined}>
      <legend>Betroffene Kurse</legend>
      <p>Ein Termin betrifft mindestens einen Kurs dieses Blockplans. Das Semester wird je Kurs aus seinen Kursphasen abgeleitet.</p>
      {courses.map((course) => <label key={course.id}><input type="checkbox" name="courseIds" value={course.id} defaultChecked={affected.has(course.id)} /> {course.code}</label>)}
    </fieldset>
  </>;
}

function EditEventForm({ blockPlanId, courses, event, onSaved }: {
  blockPlanId: string;
  courses: EventCourse[];
  event: DraftEvent;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(async (previous, formData) => {
    const result = await updateEventAction(previous, formData);
    if (result.success) onSaved(result.success);
    return result;
  }, {});
  const errorId = useId();
  // A rejected save keeps what was entered; otherwise the saved event provides the defaults.
  const defaults = state.values ?? eventDefaults(event);
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="eventId" value={event.id} />
    <EventFields courses={courses} defaults={defaults} state={state} errorId={errorId} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Terminangaben speichern"}</button>
  </form>;
}

function DeleteEventForm({ blockPlanId, event, onSaved }: { blockPlanId: string; event: DraftEvent; onSaved: (message: string) => void }) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(async (previous, formData) => {
    const result = await deleteEventAction(previous, formData);
    if (result.success) onSaved(`Der Termin „${event.title}“ wurde aus dem Entwurf gelöscht.`);
    return result;
  }, {});
  return <ConfirmDeleteForm action={formAction} error={state.error} isPending={isPending}
    openLabel="Termin löschen"
    confirmLabel="Endgültig löschen"
    heading={`Termin „${event.title}“ löschen`}
    consequence="Der Termin wird mit seinen Kurszuordnungen dauerhaft aus dem Entwurf entfernt. Die veröffentlichte Fassung bleibt bis zur nächsten Veröffentlichung unverändert.">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="eventId" value={event.id} />
  </ConfirmDeleteForm>;
}

export function EventEditorForms({ blockPlanId, courses, event, onSaved }: {
  blockPlanId: string;
  courses: EventCourse[];
  event: DraftEvent;
  onSaved: (message: string) => void;
}) {
  return <>
    <EditEventForm blockPlanId={blockPlanId} courses={courses} event={event} onSaved={onSaved} />
    <DeleteEventForm blockPlanId={blockPlanId} event={event} onSaved={onSaved} />
  </>;
}
```

- [ ] **Step 3: Create the event section**

Create `components/event-section.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { type EventFormState, createEventAction } from "@/app/intern/blockplaene/actions";
import { CollapsibleEditor } from "@/components/editor-controls";
import { type EventCourse, EventEditorForms, EventFields, eventDefaults } from "@/components/event-forms";
import { formatCalendarDay, formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import type { DraftEvent } from "@/lib/domain/publication";
import type { EventInput } from "@/lib/services/event-admin";

/** One event with the semester derived per affected course; courses sharing a semester are named together. */
export type EventEntry = {
  event: DraftEvent;
  derived: { semester: number | null; codes: string[] }[];
};

function affectedText(groups: EventEntry["derived"]): string {
  return groups
    .map((group) => group.semester ? `${group.codes.join(", ")} · Semester ${group.semester}` : `${group.codes.join(", ")} · Semester noch nicht ableitbar`)
    .join(" | ");
}

function CreateEventForm({ blockPlanId, courses, onSaved }: {
  blockPlanId: string;
  courses: EventCourse[];
  onSaved: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(async (previous, formData) => {
    const result = await createEventAction(previous, formData);
    if (result.success) onSaved(result.success);
    return result;
  }, {});
  const errorId = useId();
  // After a save the form remounts: title, description and dates start empty, while category, the provisional flag
  // and the course selection carry over, because consecutive events usually share them.
  const defaults: EventInput = state.token && state.values
    ? { ...eventDefaults(), category: state.values.category, provisional: state.values.provisional, courseIds: state.values.courseIds }
    : state.values ?? eventDefaults();
  return <form key={state.token ?? "initial"} action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <EventFields courses={courses} defaults={defaults} state={state} errorId={errorId} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Termin wird angelegt …" : "Anlegen und nächsten erfassen"}</button>
  </form>;
}

export function EventSection({ blockPlanId, courses, entries, missingPhaseSemester }: {
  blockPlanId: string;
  courses: EventCourse[];
  entries: EventEntry[];
  /** The semester to offer when an event has no derivable semester; the first one still without a phase. */
  missingPhaseSemester: number | null;
}) {
  const [status, setStatus] = useState<string | null>(null);
  return <section aria-labelledby="events-heading">
    <h2 id="events-heading">Prüfungsrelevante Termine</h2>
    <p role="status">{status ?? ""}</p>
    {entries.length ? <ul className="entry-list">{entries.map(({ event, derived }) => {
      const period = event.endDate ? formatCalendarPeriod(event.startDate, event.endDate, { weekday: true }) : formatCalendarDay(event.startDate, { weekday: true });
      const heading = `${period} · ${eventCategoryLabel(event.category)}${event.provisional ? " · Vorläufig" : ""}`;
      return <li key={event.id}>
        <p className="entry-meta">{heading}</p>
        <p><strong>{event.title}</strong></p>
        {event.description ? <p>{event.description}</p> : null}
        <p className="entry-meta">{affectedText(derived)}</p>
        {derived.some((group) => group.semester === null) ? <p className="empty-note">
          Für den {formatCalendarDay(event.startDate)} fehlt eine Kursphase.
          {missingPhaseSemester ? <> <Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${missingPhaseSemester}`}>Semester {missingPhaseSemester} ergänzen</Link></> : null}
        </p> : null}
        <CollapsibleEditor heading={event.title}
          openLabel={`Termin „${event.title}“ bearbeiten`}
          closeLabel={`Bearbeitung von „${event.title}“ schließen`}>
          <EventEditorForms blockPlanId={blockPlanId} courses={courses} event={event} onSaved={setStatus} />
        </CollapsibleEditor>
      </li>;
    })}</ul> : <p className="empty-note">Noch keine prüfungsrelevanten Termine im Entwurf.</p>}
    <h3>Neuen Termin anlegen</h3>
    <CreateEventForm blockPlanId={blockPlanId} courses={courses} onSaved={setStatus} />
  </section>;
}
```

- [ ] **Step 4: Wire the section into the page**

In `app/intern/blockplaene/[blockPlanId]/page.tsx`:

Den Import von `CreateEventForm, EventEditor` aus `@/components/event-forms` (Zeile 6) entfernen und ersetzen durch:

```ts
import { type EventEntry, EventSection } from "@/components/event-section";
```

Die Hilfsfunktionen `eventPeriod` (Zeile 22-25) und `affectedCourseLabels` (Zeile 31-37) löschen. Damit entfällt auch der Import von `eventCategoryLabel` aus `@/lib/domain/event-category` (Zeile 11); `DraftEvent` und `deriveEventSemester` (Zeile 13) bleiben, weil die folgende Gruppierung sie braucht.

An die Stelle der gelöschten Funktionen tritt eine Gruppierung, die Kurse mit gleichem abgeleitetem Semester zusammenfasst:

```tsx
/**
 * Groups the affected courses of an event by the semester derived from their course phases. In an incomplete draft a
 * phase covering the start day may be missing; that group then says so instead of hiding the gap.
 */
function eventEntries(events: DraftEvent[], phases: PlanPhase[], courseCodes: Map<string, string>): EventEntry[] {
  return events.map((event) => {
    const bySemester = new Map<number | null, string[]>();
    for (const courseId of event.courseIds) {
      const semester = deriveEventSemester(phases, courseId, event.startDate);
      const codes = bySemester.get(semester) ?? [];
      codes.push(courseCodes.get(courseId) ?? courseId);
      bySemester.set(semester, codes);
    }
    return {
      event,
      derived: [...bySemester].map(([semester, codes]) => ({ semester, codes })),
    };
  });
}
```

Die Auswertung des Suchparameters `termin-geloescht` (Zeile 68) ersatzlos löschen.

Vor dem Rendern ergänzen:

```ts
const entries = eventEntries(events, phases, courseCodes);
const missingPhaseSemester = overview.find((item) => item.codesWithoutPhase.length)?.semester ?? null;
```

Die gesamte Sektion `<section aria-labelledby="events-heading">` (Zeile 163-184) ersetzen durch:

```tsx
    <EventSection blockPlanId={plan.id} courses={courses} entries={entries} missingPhaseSemester={missingPhaseSemester} />
```

- [ ] **Step 5: Add the entry styles**

Append to `app/globals.css`:

```css
.entry-list > li { padding: .9rem 1rem; background: #fff; border: 1px solid var(--line); }
.entry-list > li > p { margin: 0 0 .3rem; }
.entry-meta { color: var(--gray); font-size: .9rem; }
```

Die in Task 4 ergänzte Regel `.entry-list > li { padding: 0; }` dabei entfernen — sie wird durch diese ersetzt.

- [ ] **Step 6: Verify manually**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alles grün.

Run: `npm run dev`. Prüfen:

1. Einen Termin anlegen. Erwartung: Erfolgsmeldung oben in der Sektion; Titel, Beschreibung und beide Daten sind leer; Kategorie, Vorläufig-Haken und Kursauswahl stehen noch.
2. Direkt einen zweiten Termin mit gleichem Kurs und gleicher Kategorie anlegen. Erwartung: Nur Titel und Datum sind zu tippen.
3. Einen Termin mit fehlerhaftem Titel absenden (leer). Erwartung: Fehlermeldung am Feld, die übrigen Eingaben bleiben erhalten.
4. Einen Termin auf ein Datum ohne Kursphase legen. Erwartung: Ein Hinweis nennt das Datum einmal — nicht je Kurs — und verlinkt in ein Semester ohne Kursphase.
5. Einen Termin bearbeiten und speichern. Erwartung: Meldung oben, kein Sprung an den Seitenanfang.
6. Einen Termin löschen. Erwartung: Eintrag verschwindet, Meldung bleibt stehen, keine Statusparameter in der URL.
7. Bei 320 CSS-Pixeln Breite prüfen. Erwartung: kein horizontaler Seitenscroll.

- [ ] **Step 7: Commit**

```bash
git add app/intern/blockplaene/actions.ts app/intern/blockplaene/[blockPlanId]/page.tsx components/event-forms.tsx components/event-section.tsx app/globals.css
git commit -m "Clear the event create form and group derived semesters"
```

---

## Task 6: Seitenaufbau nach Nutzungshäufigkeit

**Files:**
- Modify: `app/intern/blockplaene/[blockPlanId]/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `PhaseSection` (Task 4), `EventSection` (Task 5), `formatCalendarPeriod` (Task 1).
- Produces: nichts für spätere Tasks.

- [ ] **Step 1: Move the study period into the header**

In `app/intern/blockplaene/[blockPlanId]/page.tsx` die Kopf-Definitionsliste (Zeile 97-101) ersetzen:

```tsx
    <dl className="course-list">
      <dt>Zugeordnete Kurse</dt><dd>{courses.map((course) => <span key={course.id}>{course.code}</span>)}</dd>
      <dt>Studienzeitraum</dt><dd>{studyPeriods.map((period) => <span key={period}>{period}</span>)}</dd>
      <dt>Veröffentlichungszustand</dt><dd>{publicationState}</dd>
      <dt>Letzte Entwurfsänderung</dt><dd>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(plan.draftUpdatedAt))}{plan.draftUpdatedBy ? ` durch ${plan.draftUpdatedBy}` : ""}</dd>
    </dl>
```

Davor ergänzen — der Studienzeitraum ist die Grenze, gegen die jede Kursphase geprüft wird, und steht deshalb im Kopf statt in der ausgeklappten Kurstabelle:

```ts
// Assigned courses share year and duration, so identical periods are named once instead of per course.
const studyPeriods = [...new Set(courses.map((course) => formatCalendarPeriod(course.studyStart, course.studyEnd)))];
```

Den Import ergänzen:

```ts
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
```

- [ ] **Step 2: Reorder the sections and fold the rare ones away**

Die Sektionen im `return` in diese Reihenfolge bringen: Kopf, `PhaseSection`, `EventSection`, Veröffentlichung, Planeinstellungen, Rücklink.

Die bisherigen Sektionen „Bezeichnung" (Zeile 103-106), „Kurse" (Zeile 108-126) und „Löschen" (Zeile 194-199) aus ihrer heutigen Position entfernen und gemeinsam am Ende einsetzen:

```tsx
    <details className="plan-settings">
      <summary>Planeinstellungen</summary>
      <p>Bezeichnung, Kurszuordnung und Löschung ändern Sie selten — meist nur beim Anlegen des Blockplans.</p>

      <section aria-labelledby="name-heading">
        <h2 id="name-heading">Bezeichnung</h2>
        <RenameBlockPlanForm blockPlanId={plan.id} name={plan.name} derivedName={derivedName} />
      </section>

      <section aria-labelledby="courses-heading">
        <h2 id="courses-heading">Kurse</h2>
        <ul className="entry-list">{courses.map((course) => <li key={course.id}>
          <p><strong><Link className="text-link" href={`/intern/kurse/${course.id}`}>{course.code}</Link></strong></p>
          <p className="entry-meta">{course.program} · {formatCalendarPeriod(course.studyStart, course.studyEnd)}</p>
          {courses.length > 1
            ? <DetachCourseForm blockPlanId={plan.id} courseId={course.id} code={course.code} />
            : <p className="entry-meta">Letzter Kurs — nicht lösbar</p>}
        </li>)}</ul>
        {courses.length >= maximumCoursesPerBlockPlan
          ? <p className="empty-note">Dieser Blockplan enthält die Höchstzahl von {maximumCoursesPerBlockPlan} Kursen.</p>
          : attachable.length
            ? <AttachCourseForm blockPlanId={plan.id} courses={attachable} />
            : <p className="empty-note">Es gibt derzeit keinen blockplanlosen Kurs mit demselben Bereich, Jahrgang und derselben Studiendauer.</p>}
      </section>

      <section aria-labelledby="delete-heading">
        <h2 id="delete-heading">Löschen</h2>
        {plan.versionId
          ? <p className="empty-note">Dieser Blockplan besitzt eine veröffentlichte Fassung und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung zuerst zurück.</p>
          : <DeleteBlockPlanForm blockPlanId={plan.id} displayName={displayName} courseCodes={courses.map((course) => course.code)} />}
      </section>
    </details>
```

Die Kurstabelle wird dabei zur Liste, weil sie das Lösen-Formular je Kurs enthält und bei 320 CSS-Pixeln sonst nicht umbricht.

- [ ] **Step 3: Style the settings block**

Append to `app/globals.css`:

```css
.plan-settings { margin-top: 2.5rem; padding: 0 0 .5rem; border-top: 1px solid var(--line); }
.plan-settings > summary { padding: 1rem 0; font-weight: 700; cursor: pointer; }
.plan-settings > summary:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
.plan-settings > p { margin: 0 0 1rem; color: var(--gray); }
.plan-settings section { margin-bottom: 2rem; }
```

- [ ] **Step 4: Verify manually**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alles grün.

Run: `npm run dev`. Prüfen:

1. Blockplan öffnen. Erwartung: Nach dem Kopf folgen sofort die Kursphasen; Bezeichnung und Kursverwaltung sind nicht mehr sichtbar.
2. Kopf lesen. Erwartung: Kurskennungen und Studienzeitraum stehen dort, Zeitraum im Format `01.09.2025 – 30.08.2028`.
3. „Planeinstellungen" aufklappen. Erwartung: Bezeichnung, Kurse und Löschen erscheinen; Umbenennen, Zuordnen, Lösen und Löschen funktionieren unverändert.
4. Mit Tastatur bedienen. Erwartung: `summary` ist per Tab erreichbar, mit Enter oder Leertaste zu öffnen, Fokus sichtbar.
5. Einen Blockplan mit veröffentlichter Fassung öffnen. Erwartung: In den Planeinstellungen steht der Hinweis, dass nicht gelöscht werden kann.
6. Screenreader-Durchgang über die Seite. Erwartung: Überschriftenebenen bleiben schlüssig, alle Sektionen sind über ihre Überschrift erreichbar.
7. Bei 320 CSS-Pixeln prüfen. Erwartung: kein horizontaler Seitenscroll.

- [ ] **Step 5: Commit**

```bash
git add app/intern/blockplaene/[blockPlanId]/page.tsx app/globals.css
git commit -m "Order block plan sections by how often they are used"
```

---

## Abschluss

Nach Task 6 ist die Spec vollständig umgesetzt. Offen und bewusst nicht Teil dieses Plans: die Entwurfsvorschau und der Veröffentlichungsablauf mit Freigabe-Checkliste. Beide werden separat spezifiziert.
