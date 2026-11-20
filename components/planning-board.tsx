"use client";

import { announce, createUndoStack, stackSpans } from "@ui-sdk/core";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { createParts } from "@ui-sdk/react/primitive";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { useShortcut } from "@ui-sdk/react/shortcuts";
import { Slider, SliderControl, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";

import { eventSpans, type EventSpan } from "@/components/event-spans";
import { laneEntries } from "@/components/lane-entries";
import { isCalendarDay } from "@/lib/domain/calendar-day";
import { formatCalendarDay, formatCalendarPeriod, formatCompactDuration, formatPeriodDuration } from "@/lib/domain/calendar-format";
import { coursePath } from "@/lib/domain/course-comparison";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel } from "@/lib/domain/phase-type";
import {
  affectedEvents, axisMonths, axisPercent, axisYears, boardAxis, coursePhases, dayAt, dayIndex, describeChanges, junctionBlocks,
  junctionRange, minimumPhaseDays, moveJunction, moveJunctions, nearestMonday, newOpenPoints, parallelDeviations, periodPlacement, reachableDay, phaseDiffers, phaseJunctions,
  type BoardAxis, type BoardPlan, type PhaseJunction,
} from "@/lib/domain/planning-board";
import type { CoursePlan, PlanEvent, PlanPhase } from "@/lib/domain/publication";

import styles from "./planning-board.module.css";

const Spans = createParts(eventSpans, { root: "div", track: "div", span: "button" });
const Lane = createParts(laneEntries, { root: "div", entry: "button" });

type Zoom = "all" | "year" | "semester";
const zoomOptions: { value: Zoom; label: string; daysInView: number | null }[] = [
  { value: "all", label: "Gesamt", daysInView: null },
  { value: "year", label: "Jahr", daysInView: 365 },
  { value: "semester", label: "Halbjahr", daysInView: 183 },
];

type BoardCourse = CoursePlan & { editable: boolean; state: "PUBLISHED" | "UNPUBLISHED" };
type Focus = { kind: "phase" | "event" | "junction"; id: string } | null;

const eventRowHeight = 30;
/** The narrowest a date is drawn, as `.event`'s `min-width`; lanes are stacked by the same width, so nothing touches. */
const eventMinWidth = 14;
const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" });

function eventEnd(event: Pick<PlanEvent, "startDate" | "endDate">): string {
  return event.endDate ?? event.startDate;
}

function eventLabel(event: PlanEvent): string {
  return `${event.title}, ${eventCategoryLabel(event.category)}, ${formatCalendarPeriod(event.startDate, eventEnd(event), { weekday: true })}${event.provisional ? ", vorläufig" : ""}`;
}

function toSpan(axis: BoardAxis, event: PlanEvent, track: string): EventSpan {
  return { id: event.id, track, start: dayIndex(axis, event.startDate), end: dayIndex(axis, eventEnd(event)) + 1, title: event.title, label: eventLabel(event) };
}

function placedAt(axis: BoardAxis, event: PlanEvent, span: Pick<EventSpan, "start" | "end">): PlanEvent {
  return { ...event, startDate: dayAt(axis, span.start), endDate: span.end - span.start > 1 ? dayAt(axis, span.end - 1) : null };
}

function fromSpans(axis: BoardAxis, events: PlanEvent[], spans: EventSpan[]): PlanEvent[] {
  return events.map((event) => {
    const span = spans.find((candidate) => candidate.id === event.id);
    return span ? placedAt(axis, event, span) : event;
  });
}

type ShownSpans = { origin: string; spans: EventSpan[] };

/**
 * Tells the board where the track shows its spans, which during a drag is the primitive's draft, not the plan. The
 * positions count from `origin`, so they only mean something on an axis that still starts there.
 */
function ReportSpans({ origin, spans, onChange }: { origin: string; spans: EventSpan[]; onChange: (shown: ShownSpans) => void }) {
  const positions = `${origin};${spans.map((span) => `${span.id}:${span.start}:${span.end}`).join()}`;
  const latest = useRef({ origin, spans });
  useEffect(() => { latest.current = { origin, spans }; }, [origin, spans]);
  useEffect(() => { onChange(latest.current); }, [positions, onChange]);
  return null;
}

function isTextEntry(element: Element | null): boolean {
  return element instanceof HTMLInputElement && element.type !== "range";
}

/** Lanes so that markers which would touch on screen, not only overlapping dates, sit below each other. */
function eventLanes(spans: EventSpan[], visualDays: number) {
  return stackSpans(spans.map((span) => ({ ...span, end: Math.max(span.end, span.start + visualDays) })));
}

/** Read-only lanes take focus, one Tab stop per lane and the arrows within it; the edited course's bars lie under its slider. */
type LaneFocus = { label: string; onSelect: (focus: Focus) => void };

function phaseLabel(phase: PlanPhase, differs: boolean): string {
  return `${phaseTypeLabel(phase.type)}, Semester ${phase.semester}, ${formatCalendarPeriod(phase.startDate, phase.endDate, { weekday: true })}, ${formatPeriodDuration(phase.startDate, phase.endDate)}${differs ? ", weicht ab" : ""}`;
}

function PhaseBars({ axis, phases, compareWith, onHover, entries }: { axis: BoardAxis; phases: PlanPhase[]; compareWith?: PlanPhase[]; onHover: (focus: Focus) => void; entries?: LaneFocus }) {
  const bars = phases.map((phase) => {
    const place = periodPlacement(axis, phase.startDate, phase.endDate);
    const differs = !!compareWith && phaseDiffers(phase, compareWith);
    const shared = {
      className: styles.phase,
      "data-phase": phase.type === "THEORY" ? "theory" : "practice",
      "data-differs": differs ? "" : undefined,
      style: { left: `${place.left}%`, width: `${place.width}%` },
      onPointerEnter: () => onHover({ kind: "phase", id: phase.id }),
    };
    const label = <span className={styles.phaseLabel}>{phaseTypeLabel(phase.type)} · {formatCompactDuration(phase.startDate, phase.endDate)}</span>;
    return entries
      ? <Lane.Entry key={phase.id} value={phase.id} {...shared} aria-label={phaseLabel(phase, differs)} onFocus={() => entries.onSelect({ kind: "phase", id: phase.id })}>{label}</Lane.Entry>
      : <div key={phase.id} {...shared}>{label}</div>;
  });
  return entries
    ? <Lane.Root className={styles.phaseTrack} aria-label={entries.label} onEntryPress={(id) => entries.onSelect({ kind: "phase", id })}>{bars}</Lane.Root>
    : <>{bars}</>;
}

function StaticEvents({ axis, events, track, visualDays, onHover, entries }: { axis: BoardAxis; events: PlanEvent[]; track: string; visualDays: number; onHover: (focus: Focus) => void; entries: LaneFocus }) {
  const spans = events.map((event) => toSpan(axis, event, track));
  const lanes = eventLanes(spans, visualDays);
  const rows = Math.max(1, ...[...lanes.values()].map((lane) => lane.lanes));
  return <Lane.Root className={styles.eventTrack} style={{ height: rows * eventRowHeight }} aria-label={entries.label} onEntryPress={(id) => entries.onSelect({ kind: "event", id })}>
    {spans.map((span) => {
      const event = events.find((candidate) => candidate.id === span.id)!;
      return <Lane.Entry key={span.id} value={span.id} className={styles.event} data-readonly="" data-category={event.category.toLowerCase()} data-provisional={event.provisional ? "" : undefined}
        aria-label={span.label}
        style={{ left: `${axisPercent(axis, span.start)}%`, width: `${axisPercent(axis, span.end - span.start)}%`, top: (lanes.get(span.id)?.lane ?? 0) * eventRowHeight }}
        onFocus={() => entries.onSelect({ kind: "event", id: span.id })}
        onPointerEnter={() => onHover({ kind: "event", id: span.id })}>
        <span className={styles.eventTitle}>{span.title}</span>
      </Lane.Entry>;
    })}
  </Lane.Root>;
}

function SemesterBand({ axis, phases }: { axis: BoardAxis; phases: PlanPhase[] }) {
  const semesters = [...new Set(phases.map((phase) => phase.semester))].map((semester) => {
    const own = phases.filter((phase) => phase.semester === semester);
    const start = own.map((phase) => phase.startDate).toSorted()[0];
    const end = own.map((phase) => phase.endDate).toSorted().at(-1)!;
    return { semester, ...periodPlacement(axis, start, end) };
  });
  return <div className={styles.band}>{semesters.map((semester) => <span key={semester.semester} style={{ left: `${semester.left}%`, width: `${semester.width}%` }}>Semester {semester.semester}</span>)}</div>;
}

type JunctionSliderProps = {
  axis: BoardAxis;
  course: BoardCourse;
  phases: PlanPhase[];
  onMove: (phases: PlanPhase[]) => void;
  onCommit: () => void;
  onSelect: (focus: Focus) => void;
  onHover: (focus: Focus) => void;
};

/** One slider per run of adjoining phases, so that each thumb's announced bounds are the days it can really reach. */
function JunctionSlider(props: JunctionSliderProps) {
  const blocks = junctionBlocks(props.phases);
  const byId = new Map(props.phases.map((phase) => [phase.id, phase]));
  return <>{blocks.map((block) => {
    const first = byId.get(block[0].earlierId)!.semester;
    const last = byId.get(block.at(-1)!.laterId)!.semester;
    const label = blocks.length > 1 ? `Wechsel von ${props.course.code}, Semester ${first === last ? first : `${first} bis ${last}`}` : `Wechsel von ${props.course.code}`;
    return <JunctionBlock key={block[0].laterId} {...props} junctions={block} label={label} />;
  })}</>;
}

function JunctionBlock({ axis, course, phases, junctions, label, onMove, onCommit, onSelect, onHover }: JunctionSliderProps & { junctions: PhaseJunction[]; label: string }) {
  const byId = new Map(phases.map((phase) => [phase.id, phase]));
  const min = dayIndex(axis, reachableDay(phases, junctions[0], junctionRange(phases, junctions[0])!.earliest));
  const max = dayIndex(axis, reachableDay(phases, junctions.at(-1)!, junctionRange(phases, junctions.at(-1)!)!.latest));
  return <Slider className={styles.junctions} style={{ left: `${axisPercent(axis, min)}%`, width: `${axisPercent(axis, max - min)}%` }}
    aria-label={label} min={min} max={max} step={1} largeStep={7} minStepsBetweenThumbs={minimumPhaseDays}
    value={junctions.map((junction) => dayIndex(axis, junction.day))}
    format={(value: number) => formatCalendarDay(dayAt(axis, value), { weekday: true })}
    onValueChange={(next, details) => {
      // A call through the slider's API can set every thumb at once and names none, so all of them are read.
      const values = next as number[];
      if (values.length !== junctions.length || !values.every((value) => Number.isInteger(value) && value >= 0 && value <= axis.days)) {
        details.cancel();
        return;
      }
      const moves = junctions.flatMap((junction, index) => {
        const day = dayAt(axis, values[index]);
        return day === junction.day ? [] : [{ junction, day }];
      });
      let moved: PlanPhase[] | null = null;
      if (moves.length === 1) {
        // One thumb moves at a time by hand: it snaps to Mondays and stops at the last day it can reach.
        const [{ junction, day }] = moves;
        const snap = (details.reason === "drag" || details.reason === "track-press") && !(details.event as PointerEvent | undefined)?.altKey;
        const reachable = reachableDay(phases, junction, snap ? nearestMonday(day) : day);
        moved = reachable === junction.day ? null : moveJunction(phases, junction, reachable);
      } else if (moves.length) {
        moved = moveJunctions(phases, moves);
      }
      if (!moved) {
        details.cancel();
        return;
      }
      onMove(moved);
      // ui-sdk 0.1.0-beta.12 commits neither a screen reader's adjustment nor a call through its API, so those commit here.
      if (details.reason === "accessibility-adjust" || details.reason === "imperative") onCommit();
    }}
    onValueCommit={onCommit}>
    <SliderControl className={styles.junctionControl}>
      <SliderTrack className={styles.junctionTrack}>
        {junctions.map((junction, index) => {
          const earlier = byId.get(junction.earlierId)!;
          const later = byId.get(junction.laterId)!;
          return <SliderThumb key={junction.laterId} index={index} className={styles.junctionThumb}
            aria-label={`${later.semester === earlier.semester ? "Wechsel" : "Semesterwechsel"} von ${phaseTypeLabel(earlier.type)} zu ${phaseTypeLabel(later.type)}, Semester ${later.semester}, ${course.code}`}
            onFocus={() => onSelect({ kind: "junction", id: junction.laterId })}
            onPointerEnter={() => onHover({ kind: "junction", id: junction.laterId })} />;
        })}
      </SliderTrack>
    </SliderControl>
  </Slider>;
}

function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(1100);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth || 1100));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function EventEndField({ event, lastDay, onChange }: { event: PlanEvent; lastDay: string; onChange: (end: string) => void }) {
  const end = eventEnd(event);
  const [draft, setDraft] = useState(end);
  const [shownEnd, setShownEnd] = useState(end);
  const id = useId();
  if (shownEnd !== end) {
    setShownEnd(end);
    setDraft(end);
  }
  function apply() {
    if (draft === end) return;
    // A five-digit year passes a date field's own check and sorts below a four-digit one, so it is checked as a day first.
    if (!isCalendarDay(draft) || draft < event.startDate || draft > lastDay) {
      setDraft(end);
      return;
    }
    onChange(draft);
  }
  return <p className={styles.endField}>
    <label htmlFor={id}>Ende</label>
    <input id={id} type="date" min={event.startDate} max={lastDay} value={draft} onChange={(change) => setDraft(change.target.value)} onBlur={apply}
      onKeyDown={(key) => { if (key.key === "Enter") { key.preventDefault(); apply(); } }} />
  </p>;
}

function FocusDetails({ focus, plan, course, parallels, phases, events, lastDay, onEndChange }: {
  focus: Focus;
  plan: BoardPlan;
  course: BoardCourse;
  parallels: BoardCourse[];
  phases: PlanPhase[];
  events: PlanEvent[];
  lastDay: string;
  onEndChange: (id: string, end: string) => void;
}) {
  const empty = <p className={styles.detailsEmpty}>Zeigen Sie auf eine Phase, einen Wechsel oder einen Termin, um seine Angaben hier zu sehen. Ein angeklickter Termin bleibt ausgewählt, auch wenn der Zeiger weiterwandert.</p>;
  if (!focus) return empty;
  const allPhases = [...plan.phases, ...phases.filter((phase) => phase.courseId !== course.id)];
  const allEvents = [...plan.events, ...events.filter((event) => !event.courseIds.includes(course.id))];
  const codeOf = (courseId: string) => [course, ...parallels].find((candidate) => candidate.id === courseId)?.code ?? "";
  if (focus.kind === "junction") {
    const later = plan.phases.find((phase) => phase.id === focus.id);
    const earlier = later && plan.phases.find((phase) => phase.endDate < later.startDate && phaseJunctions(plan.phases).some((junction) => junction.laterId === later.id && junction.earlierId === phase.id));
    if (!later || !earlier) return empty;
    return <div className={styles.detailsBody}>
      <p className={styles.detailsKind}>{later.semester === earlier.semester ? "Wechsel" : "Semesterwechsel"} · {course.code}</p>
      <p className={styles.detailsTitle}>{formatCalendarDay(later.startDate, { weekday: true })}</p>
      <p>{phaseTypeLabel(earlier.type)} {formatCalendarPeriod(earlier.startDate, earlier.endDate)} ({formatPeriodDuration(earlier.startDate, earlier.endDate)}), danach {phaseTypeLabel(later.type)} {formatCalendarPeriod(later.startDate, later.endDate)} ({formatPeriodDuration(later.startDate, later.endDate)}).</p>
      <p className={styles.detailsHint}>Ziehen rastet auf Montage ein, mit gedrückter Alt-Taste tagesgenau. Pfeiltasten verschieben um einen Tag, Umschalt mit Pfeil um eine Woche.</p>
    </div>;
  }
  if (focus.kind === "phase") {
    const phase = allPhases.find((candidate) => candidate.id === focus.id);
    if (!phase) return empty;
    return <div className={styles.detailsBody}>
      <p className={styles.detailsKind}>Kursphase · {codeOf(phase.courseId)}</p>
      <p className={styles.detailsTitle}>{phaseTypeLabel(phase.type)}, Semester {phase.semester}</p>
      <p>{formatCalendarPeriod(phase.startDate, phase.endDate, { weekday: true })} · {formatPeriodDuration(phase.startDate, phase.endDate)}</p>
      {phase.courseId !== course.id && phaseDiffers(phase, plan.phases) ? <p className={styles.detailsHint}>Weicht vom Kursverlauf von {course.code} ab.</p> : null}
    </div>;
  }
  const event = allEvents.find((candidate) => candidate.id === focus.id);
  if (!event) return empty;
  const editable = course.editable && event.courseIds.includes(course.id);
  return <div className={styles.detailsBody}>
    <p className={styles.detailsKind}>{eventCategoryLabel(event.category)} · {codeOf(event.courseIds[0])}{event.provisional ? " · vorläufig" : ""}</p>
    <p className={styles.detailsTitle}>{event.title}</p>
    <p>{formatCalendarPeriod(event.startDate, eventEnd(event), { weekday: true })}</p>
    {event.description ? <p>{event.description}</p> : null}
    {editable ? <EventEndField key={event.id} event={event} lastDay={lastDay} onChange={(end) => onEndChange(event.id, end)} /> : null}
    {editable ? <p className={styles.detailsHint}>Ziehen verschiebt, der Griff am rechten Rand ändert das Ende. Mit der Tastatur: Pfeile verschieben um einen Tag, Umschalt mit Pfeil ändert das Ende.</p> : null}
  </div>;
}

/**
 * A prototype of the planning board: the whole study period of a course on one axis, the courses of its comparison
 * below it, and the changes and dates of the edited course moved directly on it. Nothing is saved; every move lands
 * in a list of changes told in words, with what follows from it, and can be taken back.
 */
export function PlanningBoard({ course, parallels, phases, events, today }: {
  course: BoardCourse;
  parallels: BoardCourse[];
  phases: PlanPhase[];
  events: PlanEvent[];
  today: string;
}) {
  const saved = useMemo<BoardPlan>(() => ({ phases: coursePhases(phases, course.id), events: events.filter((event) => event.courseIds.includes(course.id)) }), [phases, events, course.id]);
  const savedKey = useMemo(() => JSON.stringify(saved), [saved]);
  // Draft, comparison base and history start from one loaded state. A reload, like a change of the comparison, only
  // replaces it while the draft is untouched; otherwise someone else's edit would show up as one of the draft's changes.
  const [base, setBase] = useState(saved);
  const [baseKey, setBaseKey] = useState(savedKey);
  const [plan, setPlan] = useState<BoardPlan>(saved);
  const [history] = useState(() => createUndoStack<BoardPlan>(saved));
  if (savedKey !== baseKey && !describeChanges(base, plan).length) {
    setBase(saved);
    setBaseKey(savedKey);
    setPlan(saved);
    history.reset(saved);
  }
  const outdated = savedKey !== baseKey;
  // The draft outlives a change of the comparison, so the axis has to cover it as well as what was loaded.
  const axis = useMemo(() => boardAxis([course, ...parallels], [...phases, ...events, ...plan.phases, ...plan.events]), [course, parallels, phases, events, plan]);
  const [, setHistoryVersion] = useState(0);
  const [zoom, setZoom] = useState<Zoom>("all");
  const [hover, setHover] = useState<Focus>(null);
  const [selected, setSelected] = useState<Focus>(null);
  const [detailsFocused, setDetailsFocused] = useState(false);
  const [shownSpans, setShownSpans] = useState<ShownSpans | null>(null);
  const board = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const width = useWidth(viewport);
  const hintId = useId();
  // The slider and the spans report a commit after the move that caused it has rendered, so the ref holds that plan.
  const latest = useRef(plan);
  const recorded = useRef(saved);
  // The first pointer on a slider owns the gesture; a second finger joins it rather than starting over.
  const gesture = useRef<{ pointerId: number; start: BoardPlan } | null>(null);
  useEffect(() => { latest.current = plan; }, [plan]);

  const factor = Math.max(1, axis.days / (zoomOptions.find((option) => option.value === zoom)!.daysInView ?? axis.days));
  const pixelsPerDay = width * factor / axis.days;
  const visualDays = Math.ceil(eventMinWidth / pixelsPerDay);
  const changes = describeChanges(base, plan);
  const affected = affectedEvents(base, plan);
  const openPoints = newOpenPoints(course, base, plan);
  const spans = plan.events.map((event) => toSpan(axis, event, course.id));
  const years = axisYears(axis);
  const months = zoom === "all" ? [] : axisMonths(axis);
  const todayIndex = dayIndex(axis, today);
  const editable = course.editable;

  useEffect(() => {
    const node = viewport.current;
    if (!node || zoom === "all") return;
    const center = Math.min(Math.max(todayIndex, 0), axis.days) / axis.days * node.scrollWidth;
    node.scrollLeft = center - node.clientWidth / 2;
  }, [zoom, todayIndex, axis.days, viewport]);

  function commit(next: BoardPlan) {
    latest.current = next;
    setPlan(next);
    if (next === recorded.current) return;
    recorded.current = next;
    history.record(next);
    setHistoryVersion((version) => version + 1);
  }

  function step(direction: "undo" | "redo") {
    const next = direction === "undo" ? history.undo() : history.redo();
    if (!next) return;
    recorded.current = next;
    setPlan(next);
    setHistoryVersion((version) => version + 1);
    announce(direction === "undo" ? "Letzte Änderung zurückgenommen." : "Änderung wiederhergestellt.");
  }

  function changeEnd(id: string, end: string) {
    commit({ ...plan, events: plan.events.map((event) => (event.id === id ? { ...event, endDate: end === event.startDate ? null : end } : event)) });
  }

  function discard() {
    commit(base);
    announce("Alle Änderungen verworfen.");
  }

  const onBoard = () => !!board.current?.contains(document.activeElement) && !isTextEntry(document.activeElement);
  useShortcut("mod+z", () => step("undo"), { description: "Letzte Änderung zurücknehmen", when: onBoard });
  useShortcut("mod+shift+z", () => step("redo"), { description: "Änderung wiederherstellen", when: onBoard });

  function select(next: Focus) {
    setSelected(next);
    setHover(null);
  }

  return <section ref={board} className={styles.boardSection} aria-labelledby="board-heading">
    <div className={styles.toolbar}>
      <h2 id="board-heading" className="eyebrow">Planungstafel (Prototyp)</h2>
      <SegmentedControl className={styles.zoom} aria-label="Zeitraum der Ansicht" value={zoom} onValueChange={(value) => setZoom(value as Zoom)}>
        <SegmentedControlIndicator className={styles.zoomIndicator} />
        {zoomOptions.map((option) => <SegmentedControlItem key={option.value} value={option.value} className={styles.zoomItem}>{option.label}</SegmentedControlItem>)}
      </SegmentedControl>
    </div>
    <p className={styles.intro} id={hintId}>
      {editable
        ? <>Wechsel und Termine von {course.code} lassen sich direkt verschieben. Darunter stehen die Kurse des Vergleichs; abweichende Phasen sind gestrichelt umrandet. Es wird nichts gespeichert.</>
        : <>Dieser Kurs gehört nicht zu Ihren Bereichen. Die Tafel zeigt ihn nur an.</>}
    </p>
    {outdated ? <p className={styles.outdated} role="status">
      {course.code} wurde geändert, seit Sie die Tafel geöffnet haben. Ihr Entwurf und seine Änderungen beziehen sich weiter auf den Stand beim Öffnen. „Alle verwerfen“ übernimmt den neuen Stand.
    </p> : null}

    <div ref={viewport} className={styles.viewport} role="region" aria-label="Zeitachse" tabIndex={0} onPointerLeave={() => setHover(null)}>
      <div className={styles.canvas} style={{ width: `${factor * 100}%` }}>
        <div className={styles.band} aria-hidden="true">{years.map((year) => <span key={year.year} style={{ left: `${year.left}%`, width: `${year.width}%` }}>{year.year}</span>)}</div>
        {months.length ? <div className={styles.months} aria-hidden="true">{months.map((month) => <span key={month.day} style={{ left: `${month.left}%` }}>{monthFormatter.format(new Date(`${month.day}T00:00:00Z`))}{month.day.endsWith("-01-01") ? ` ${month.day.slice(0, 4)}` : ""}</span>)}</div> : null}
        <div aria-hidden="true"><SemesterBand axis={axis} phases={plan.phases} /></div>
        {todayIndex >= 0 && todayIndex < axis.days ? <div className={styles.today} style={{ left: `${axisPercent(axis, todayIndex)}%` }} aria-hidden="true"><span>heute</span></div> : null}

        <div className={styles.lane} data-edited="">
          <p className={styles.laneLabel}>{course.code}{editable ? " · bearbeitbar" : ""}{course.state === "PUBLISHED" ? " · veröffentlicht" : ""}</p>
          {editable ? <div className={styles.phaseTrack}>
            <PhaseBars axis={axis} phases={plan.phases} onHover={setHover} entries={{ label: `Phasen von ${course.code}`, onSelect: select }} />
            <div className={styles.junctionGesture}
              onPointerDownCapture={(event) => { gesture.current ??= { pointerId: event.pointerId, start: latest.current }; }}
              onPointerUpCapture={(event) => { if (gesture.current?.pointerId === event.pointerId) gesture.current = null; }}
              onPointerCancelCapture={(event) => {
                // The slider keeps a cancelled drag's last value; the browser took the gesture over, so it never happened.
                if (gesture.current?.pointerId !== event.pointerId) return;
                latest.current = gesture.current.start;
                setPlan(gesture.current.start);
                gesture.current = null;
              }}>
            <JunctionSlider axis={axis} course={course} phases={plan.phases} onSelect={select} onHover={setHover}
              onMove={(next) => {
                // A screen reader's adjustment commits in the same tick as the change, before a render could update the ref.
                latest.current = { ...latest.current, phases: next };
                setPlan(latest.current);
              }}
              onCommit={() => commit(latest.current)} />
            </div>
          </div> : <PhaseBars axis={axis} phases={plan.phases} onHover={setHover} entries={{ label: `Phasen von ${course.code}`, onSelect: select }} />}
          {editable ? <Spans.Root className={styles.eventsRoot} aria-label={`Termine von ${course.code}`} days={axis.days} spans={spans}
            onSpansChange={(next) => commit({ ...latest.current, events: fromSpans(axis, latest.current.events, next) })}
            onSpanPress={(id) => select({ kind: "event", id })}
            describe={(span) => eventLabel(placedAt(axis, plan.events.find((event) => event.id === span.id)!, span))}>
            <Spans.Track value={course.id} className={styles.eventTrack}>
              {({ spans: shown }) => {
                const lanes = eventLanes(shown, visualDays);
                const rows = Math.max(1, ...[...lanes.values()].map((lane) => lane.lanes));
                return <>
                  <ReportSpans origin={axis.origin} spans={shown} onChange={setShownSpans} />
                  <div style={{ height: rows * eventRowHeight }} aria-hidden="true" />
                  {shown.map((span) => {
                    const event = plan.events.find((candidate) => candidate.id === span.id)!;
                    const isSelected = selected?.kind === "event" && selected.id === span.id;
                    return <Spans.Span key={span.id} value={span.id} className={styles.event} data-selected={isSelected ? "" : undefined}
                      data-category={event.category.toLowerCase()} data-provisional={event.provisional ? "" : undefined}
                      aria-label={span.label} aria-describedby={hintId}
                      style={{ left: `${axisPercent(axis, span.start)}%`, width: `${axisPercent(axis, span.end - span.start)}%`, top: (lanes.get(span.id)?.lane ?? 0) * eventRowHeight, "--span-end": `${(span.end - span.start) * pixelsPerDay}px` } as CSSProperties}
                      onFocus={() => select({ kind: "event", id: span.id })}
                      onPointerEnter={() => setHover({ kind: "event", id: span.id })}>
                      <span className={styles.eventTitle}>{span.title}</span>
                      {isSelected || (span.end - span.start) * pixelsPerDay >= 28 ? <span className={styles.eventEdge} data-span-edge="end" /> : null}
                    </Spans.Span>;
                  })}
                </>;
              }}
            </Spans.Track>
          </Spans.Root> : <StaticEvents axis={axis} events={plan.events} track={course.id} visualDays={visualDays} onHover={setHover} entries={{ label: `Termine von ${course.code}`, onSelect: select }} />}
        </div>

        {parallels.map((parallel) => <div key={parallel.id} className={styles.lane}>
          <p className={styles.laneLabel}><Link href={coursePath(parallel.id)}>{parallel.code}</Link>{parallel.state === "PUBLISHED" ? " · veröffentlicht" : ""}</p>
          <PhaseBars axis={axis} phases={coursePhases(phases, parallel.id)} compareWith={plan.phases} onHover={setHover} entries={{ label: `Phasen von ${parallel.code}`, onSelect: select }} />
          <StaticEvents axis={axis} events={events.filter((event) => event.courseIds.includes(parallel.id))} track={parallel.id} visualDays={visualDays} onHover={setHover} entries={{ label: `Termine von ${parallel.code}`, onSelect: select }} />
        </div>)}
      </div>
    </div>
    <p className={styles.legend} aria-hidden="true">
      <span data-phase="theory" /> Theorie <span data-phase="practice" /> Praxis <span data-differs="" /> weicht ab <span data-provisional="" /> vorläufiger Termin
    </p>

    <div className={styles.panels}>
      <section className={styles.details} aria-labelledby="board-details-heading"
        onFocus={() => {
          if (!detailsFocused && hover) select(hover);
          setDetailsFocused(true);
        }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDetailsFocused(false); }}>
        <h3 id="board-details-heading">Auswahl</h3>
        <FocusDetails focus={detailsFocused ? selected : hover ?? selected} plan={shownSpans?.origin === axis.origin ? { ...plan, events: fromSpans(axis, plan.events, shownSpans.spans) } : plan} course={course} parallels={parallels} phases={phases} events={events} lastDay={dayAt(axis, axis.days - 1)} onEndChange={changeEnd} />
      </section>

      <section className={styles.changes} aria-labelledby="board-changes-heading">
        <div className={styles.changesHead}>
          <h3 id="board-changes-heading">Änderungen ({changes.length})</h3>
          <div className={styles.changesActions}>
            <button type="button" className="button button--ghost button--compact" aria-disabled={!history.canUndo() || undefined} onClick={() => step("undo")} aria-keyshortcuts="Control+Z Meta+Z">Rückgängig</button>
            <button type="button" className="button button--ghost button--compact" aria-disabled={!history.canRedo() || undefined} onClick={() => step("redo")} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z">Wiederholen</button>
          </div>
        </div>
        {changes.length ? <ol className={styles.changeList}>{changes.map((change) => <li key={change.key}>
          <p>{change.text}</p>
          {change.consequences.length ? <ul>{change.consequences.map((consequence) => <li key={consequence}>{consequence}</li>)}</ul> : null}
        </li>)}</ol> : <p className={styles.detailsEmpty}>Noch nichts verschoben.</p>}
        {affected.length ? <div className={styles.affected}>
          <h4>Betroffene Termine</h4>
          <ul>{affected.map((text) => <li key={text}>{text}</li>)}</ul>
        </div> : null}
        {openPoints.length ? <div className={styles.openPoints} role="status">
          <p><strong>Neue offene Punkte</strong> – sie würden eine Veröffentlichung verhindern:</p>
          <ul>{openPoints.map((point) => <li key={point.key}>{point.message}</li>)}</ul>
        </div> : null}
        {changes.length ? <div className={styles.changesActions}>
          <Dialog>
            <DialogTrigger className="button button--compact">Änderungen prüfen</DialogTrigger>
            <DialogBackdrop className={styles.backdrop} />
            <DialogContent className={styles.dialog}>
              <DialogTitle>{changes.length === 1 ? "1 Änderung" : `${changes.length} Änderungen`} an {course.code}</DialogTitle>
              <DialogDescription>
                {course.state === "PUBLISHED" ? "Der Kurs ist veröffentlicht: Gespeichert wären die Änderungen sofort öffentlich sichtbar. " : ""}
                Im Prototyp wird nichts gespeichert. So sähe die gesammelte Bestätigung aus.
              </DialogDescription>
              <ol className={styles.changeList}>{changes.map((change) => <li key={change.key}>
                <p>{change.text}</p>
                {change.consequences.length ? <ul>{change.consequences.map((consequence) => <li key={consequence}>{consequence}</li>)}</ul> : null}
              </li>)}</ol>
              {affected.length ? <div className={styles.affected}>
                <h3>Betroffene Termine</h3>
                <ul>{affected.map((text) => <li key={text}>{text}</li>)}</ul>
              </div> : null}
              {openPoints.length ? <p>Danach bestünden {openPoints.length === 1 ? "1 neuer offener Punkt" : `${openPoints.length} neue offene Punkte`}.</p> : null}
              <DialogClose className="button button--ghost">Schließen</DialogClose>
            </DialogContent>
          </Dialog>
          <button type="button" className="button button--ghost button--compact" onClick={discard}>Alle verwerfen</button>
        </div> : null}
      </section>

      {parallels.length ? <section className={styles.deviations} aria-labelledby="board-deviations-heading">
        <h3 id="board-deviations-heading">Abweichungen der Parallelkurse</h3>
        <p className={styles.detailsHint}>Verglichen mit dem Kursverlauf von {course.code}, wie er auf der Tafel gerade steht.</p>
        <ul className={styles.deviationList}>{parallels.map((parallel) => {
          const { summary, phases: differing } = parallelDeviations(course.code, plan.phases, coursePhases(phases, parallel.id));
          const count = differing.length === 1 ? "1 abweichende Phase" : `${differing.length} abweichende Phasen`;
          const headline = summary ? (differing.length ? `${summary}, außerdem ${count}` : summary) : differing.length ? count : "gleicher Kursverlauf";
          return <li key={parallel.id}>
            <p><strong>{parallel.code}</strong>{parallel.state === "PUBLISHED" ? " (veröffentlicht)" : ""}: {headline}</p>
            {differing.length ? <ul>{differing.map((text) => <li key={text}>{text}</li>)}</ul> : null}
          </li>;
        })}</ul>
      </section> : null}
    </div>
  </section>;
}
