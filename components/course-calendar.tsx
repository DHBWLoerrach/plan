"use client";

import { Fragment, type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

import { berlinCalendarDay, plusDays, plusMonths } from "@/lib/domain/calendar-day";
import {
  calendarEventPlacements,
  calendarGroups,
  calendarMonthDays,
  calendarWeekDays,
  courseCalendarViewQuery,
  eventsOnCalendarDay,
  type CalendarEvent,
  type CourseCalendarView,
} from "@/lib/domain/course-calendar";

import styles from "./course-calendar.module.css";

type CalendarResult =
  | { kind: "available"; events: CalendarEvent[] }
  | { kind: "not-found" }
  | { kind: "unavailable" };

type CalendarNavigation = {
  anchor: string;
  view: CourseCalendarView;
  loading: boolean;
  onNavigate: (anchor: string, view: CourseCalendarView) => void;
};

const refreshInterval = 10 * 60 * 1_000;
const pixelsPerMinute = 1.1;
const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const dayWithoutYearFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
});
const shortDayFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit",
});
const monthFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const dayMonthFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "numeric", month: "long" });
const dayMonthYearFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });

function date(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

function eventTime(event: CalendarEvent): string {
  if (!event.allDay) return `${timeFormatter.format(date(event.start))}–${timeFormatter.format(date(event.end))}`;
  return event.start.slice(0, 10) === event.end.slice(0, 10)
    ? "ganztägig"
    : `${shortDateFormatter.format(date(event.start))}–${shortDateFormatter.format(date(event.end))}`;
}

function EventLocation({ value }: { value: string }) {
  if (!value) return null;
  return <p className={styles.location}>{/^https?:\/\//u.test(value)
    ? <a href={value} target="_blank" rel="noopener noreferrer">Online-Raum<span className="sr-only"> (öffnet in neuem Tab)</span></a>
    : value}</p>;
}

function EventDetails({ event }: { event: CalendarEvent }) {
  return <>
    <EventLocation value={event.location} />
    {event.description ? <p className={styles.description}>{event.description}</p> : null}
  </>;
}

export function CalendarEventList({
  events,
  anchor,
  onOpenWeek,
}: {
  events: CalendarEvent[];
  anchor: string;
  onOpenWeek?: (day: string) => void;
}) {
  const groups = calendarGroups(events, anchor);
  if (!groups.length) return <p className={styles.empty}>Keine Kalendertermine ab diesem Datum im Vorlesungskalender.</p>;

  return <div className={styles.groups}>
    {groups.map((group) => <section className={styles.day} key={group.date}>
      <h3>{onOpenWeek
        ? <button className={styles.dayLink} type="button" onClick={() => onOpenWeek(group.date)} title="Wochenansicht öffnen">{dayFormatter.format(date(group.date))}</button>
        : dayFormatter.format(date(group.date))}</h3>
      <ol className={styles.events}>{group.events.map((event, index) => <li className={styles.event} key={`${event.uid}-${event.start}-${index}`}>
        <time className={styles.time} dateTime={event.start}>{eventTime(event)}</time>
        <div className={styles.eventMain}>
          <h4>{event.title}</h4>
          <EventDetails event={event} />
        </div>
      </li>)}</ol>
    </section>)}
  </div>;
}

function WeekCalendar({ events, anchor, today, onOpenList }: {
  events: CalendarEvent[];
  anchor: string;
  today: string;
  onOpenList: (day: string) => void;
}) {
  const allDays = calendarWeekDays(anchor);
  const visibleDays = allDays.filter((day, index) => index < 5 || eventsOnCalendarDay(events, day).length > 0);
  const timedEvents = visibleDays.flatMap((day) => eventsOnCalendarDay(events, day).filter((event) => !event.allDay));
  let startHour = 8;
  let endHour = 18;
  for (const event of timedEvents) {
    const start = date(event.start);
    const end = date(event.end);
    startHour = Math.min(startHour, start.getUTCHours());
    endHour = Math.max(endHour, end.getUTCHours() + (end.getUTCMinutes() > 0 ? 1 : 0));
  }
  const startMinute = startHour * 60;
  const totalMinutes = Math.max((endHour - startHour) * 60, 60);
  const bodyHeight = totalMinutes * pixelsPerMinute;
  const allDayByDay = new Map(visibleDays.map((day) => [day, eventsOnCalendarDay(events, day).filter((event) => event.allDay)]));
  const maxAllDay = Math.max(0, ...visibleDays.map((day) => allDayByDay.get(day)!.length));
  const gridStyle = { "--calendar-day-count": visibleDays.length } as CSSProperties;

  return <div className={styles.calendarScroller} role="region" aria-label="Wochenkalender" tabIndex={0}>
    <div className={styles.weekGrid} style={gridStyle}>
      <div className={styles.weekTimeColumn} aria-hidden="true">
        <div className={styles.weekHeadSpacer} />
        {maxAllDay ? <div className={styles.allDaySpacer} style={{ height: `${maxAllDay * 28 + 8}px` }} /> : null}
        <div className={styles.weekTimeBody} style={{ height: `${bodyHeight}px` }}>
          {Array.from({ length: endHour - startHour }, (_, index) => startHour + index + 1).map((hour) =>
            <span key={hour} style={{ top: `${(hour * 60 - startMinute) * pixelsPerMinute}px` }}>{String(hour).padStart(2, "0")}:00</span>)}
        </div>
      </div>
      {visibleDays.map((day) => {
        const dayEvents = eventsOnCalendarDay(events, day);
        const allDayEvents = allDayByDay.get(day)!;
        const placements = calendarEventPlacements(dayEvents.filter((event) => !event.allDay));
        return <section className={`${styles.weekDay}${day === today ? ` ${styles.today}` : ""}`} key={day} aria-labelledby={`calendar-day-${day}`}>
          <h3 id={`calendar-day-${day}`} className={styles.weekDayHeading}>
            <button type="button" onClick={() => onOpenList(day)} title="Listenansicht ab diesem Tag" aria-label={`${dayWithoutYearFormatter.format(date(day))}: Listenansicht ab diesem Tag öffnen`}>{shortDayFormatter.format(date(day))}</button>
          </h3>
          {maxAllDay ? <div className={styles.allDaySlot} style={{ height: `${maxAllDay * 28 + 8}px` }}>
            {allDayEvents.map((event, index) => <div className={styles.allDayEvent} key={`${event.uid}-${event.start}-${index}`} title={event.title}>
              <span className="sr-only">Ganztägig: </span>{event.title}
            </div>)}
          </div> : null}
          <div className={styles.weekDayBody} style={{ height: `${bodyHeight}px`, "--calendar-hour-pixels": `${60 * pixelsPerMinute}px` } as CSSProperties}>
            {placements.map(({ event, column, columns }, index) => {
              const start = date(event.start);
              const end = date(event.end);
              const eventStart = start.getUTCHours() * 60 + start.getUTCMinutes();
              const duration = Math.max((end.getTime() - start.getTime()) / 60_000, 15);
              const placementStyle = {
                top: `${(eventStart - startMinute) * pixelsPerMinute}px`,
                height: `${Math.max(duration * pixelsPerMinute - 2, 24)}px`,
                left: `${(column / columns) * 100}%`,
                width: `calc(${100 / columns}% - 3px)`,
              };
              return <article className={styles.weekEvent} style={placementStyle} key={`${event.uid}-${event.start}-${index}`}>
                <h4>{event.title}</h4>
                <time dateTime={event.start}>{eventTime(event)}</time>
                <EventDetails event={event} />
              </article>;
            })}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

type MonthSelection = { key: string; weekStart: string; event: CalendarEvent };

function MonthCalendar({ events, anchor, today, onOpenWeek }: {
  events: CalendarEvent[];
  anchor: string;
  today: string;
  onOpenWeek: (day: string) => void;
}) {
  const [selection, setSelection] = useState<MonthSelection | null>(null);
  const selectionTrigger = useRef<HTMLButtonElement | null>(null);
  const days = calendarMonthDays(anchor);
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const month = anchor.slice(0, 7);
  const monthLabel = monthFormatter.format(date(anchor));
  const closeSelection = () => {
    setSelection(null);
    window.requestAnimationFrame(() => selectionTrigger.current?.focus());
  };

  return <>
    <div className={styles.calendarScroller} role="region" aria-label={`Monatsansicht ${monthLabel}`} tabIndex={0}>
      <div className={styles.monthGrid}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((weekday) => <div className={styles.monthWeekday} aria-hidden="true" key={weekday}>{weekday}</div>)}
        {weeks.map((week) => <Fragment key={week[0]}>
          {week.map((day, dayIndex) => {
            const dayEvents = eventsOnCalendarDay(events, day);
            const visibleEvents = dayEvents.slice(0, 3);
            const additionalEvents = dayEvents.length - visibleEvents.length;
            return <section className={`${styles.monthDay}${dayIndex === 6 ? ` ${styles.monthDayEnd}` : ""}${day.slice(0, 7) !== month ? ` ${styles.outsideMonth}` : ""}${day === today ? ` ${styles.today}` : ""}`} key={day}>
              <h3>
                <button type="button" onClick={() => onOpenWeek(day)} aria-label={`Woche für ${dayWithoutYearFormatter.format(date(day))} öffnen`}>{date(day).getUTCDate()}</button>
              </h3>
              <ul>{visibleEvents.map((event, index) => {
                const key = `${day}-${event.uid}-${event.start}-${index}`;
                const expanded = selection?.key === key;
                const timeLabel = event.allDay ? "ganztägig" : timeFormatter.format(date(event.start));
                return <li key={key}><button
                  className={styles.monthEvent}
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${timeLabel} ${event.title} — Details ${expanded ? "ausblenden" : "anzeigen"}`}
                  aria-controls={expanded ? "calendar-month-detail" : undefined}
                  onClick={(clickEvent) => {
                    if (expanded) setSelection(null);
                    else {
                      selectionTrigger.current = clickEvent.currentTarget;
                      setSelection({ key, weekStart: week[0], event });
                    }
                  }}
                >
                  <span>{timeLabel}</span>
                  <strong>{event.title}</strong>
                </button></li>;
              })}</ul>
              {additionalEvents ? <button className={styles.moreEvents} type="button" onClick={() => onOpenWeek(day)}>
                {additionalEvents === 1 ? "1 weiterer Termin" : `${additionalEvents} weitere Termine`}
              </button> : null}
            </section>;
          })}
          {selection?.weekStart === week[0] ? <article className={styles.monthDetail} id="calendar-month-detail" aria-live="polite" onKeyDown={(event) => {
            if (event.key === "Escape") closeSelection();
          }}>
            <div className={styles.monthDetailCard}>
              <div>
                <h3>{selection.event.title}</h3>
                <time dateTime={selection.event.start}>{eventTime(selection.event)}</time>
                <EventDetails event={selection.event} />
              </div>
              <button type="button" onClick={closeSelection} aria-label="Termindetails schließen">×</button>
            </div>
          </article> : null}
        </Fragment>)}
      </div>
    </div>
  </>;
}

function calendarLabel(anchor: string, view: CourseCalendarView): string {
  if (view === "month") return monthFormatter.format(date(anchor));
  if (view === "list") return `Termine ab ${dayFormatter.format(date(anchor))}`;
  const days = calendarWeekDays(anchor);
  const start = date(days[0]);
  const end = date(days[6]);
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  return `${sameMonth ? `${start.getUTCDate()}.` : dayMonthFormatter.format(start)}–${dayMonthYearFormatter.format(end)}`;
}

function CalendarControls({ anchor, view, loading, onNavigate }: CalendarNavigation) {
  const viewOptions: Array<{ view: CourseCalendarView; label: string }> = [
    { view: "week", label: "Woche" },
    { view: "month", label: "Monat" },
    { view: "list", label: "Liste" },
  ];
  const previous = view === "month" ? plusMonths(anchor, -1) : plusDays(anchor, -7);
  const next = view === "month" ? plusMonths(anchor, 1) : plusDays(anchor, 7);
  const previousLabel = view === "month" ? "Vorheriger Monat" : view === "week" ? "Vorherige Woche" : "7 Tage zurück";
  const nextLabel = view === "month" ? "Nächster Monat" : view === "week" ? "Nächste Woche" : "7 Tage weiter";

  return <>
    <div className={styles.viewControls} role="group" aria-label="Kalenderansicht">
      {viewOptions.map((option) => <button key={option.view} type="button" aria-pressed={view === option.view} disabled={loading} onClick={() => onNavigate(anchor, option.view)}>{option.label}</button>)}
    </div>
    <div className={styles.calendarHead}>
      <div>
        <h2 id="course-calendar-heading">Vorlesungskalender</h2>
        <p>{calendarLabel(anchor, view)}</p>
      </div>
      <div className={styles.navigation} role="group" aria-label="Kalenderzeitraum">
        <button type="button" disabled={loading} onClick={() => onNavigate(previous, view)}>{previousLabel}</button>
        <button type="button" disabled={loading} onClick={() => onNavigate(berlinCalendarDay(), view)}>Heute</button>
        <button type="button" disabled={loading} onClick={() => onNavigate(next, view)}>{nextLabel}</button>
      </div>
    </div>
  </>;
}

function errorMessage(result: Exclude<CalendarResult, { kind: "available" }>): string {
  return result.kind === "not-found"
    ? "Für diese Kurskennung wurde kein Vorlesungskalender gefunden."
    : "Der Vorlesungskalender ist zurzeit nicht erreichbar. Bitte versuchen Sie es später erneut.";
}

export function CourseCalendar({
  courseId,
  initialAnchor,
  initialView,
  initialResult,
}: {
  courseId: string;
  initialAnchor: string;
  initialView: CourseCalendarView;
  initialResult: CalendarResult;
}) {
  const [anchor, setAnchor] = useState(initialAnchor);
  const [view, setView] = useState(initialView);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const lastLoadedAt = useRef(0);
  const requestInFlight = useRef(false);

  const refresh = useCallback(async (requestedAnchor: string, requestedView: CourseCalendarView, announce = true) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    if (announce) setAnnouncement("Vorlesungskalender wird geladen.");
    try {
      const query = new URLSearchParams({ datum: requestedAnchor, ansicht: courseCalendarViewQuery(requestedView) });
      const response = await fetch(`/api/internal/courses/${encodeURIComponent(courseId)}/calendar?${query}`, { cache: "no-store" });
      const data = await response.json() as { events?: CalendarEvent[]; error?: string };
      if (response.ok && Array.isArray(data.events)) {
        setResult({ kind: "available", events: data.events });
        lastLoadedAt.current = Date.now();
        if (announce) setAnnouncement("Vorlesungskalender wurde aktualisiert.");
      } else {
        setResult({ kind: response.status === 404 ? "not-found" : "unavailable" });
        if (announce) setAnnouncement("");
      }
    } catch {
      setResult({ kind: "unavailable" });
      if (announce) setAnnouncement("");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (lastLoadedAt.current === 0) lastLoadedAt.current = Date.now();
    const checkForRefresh = () => {
      if (document.hidden || Date.now() - lastLoadedAt.current < refreshInterval) return;
      void refresh(anchor, view, false);
    };
    const interval = window.setInterval(checkForRefresh, 60_000);
    document.addEventListener("visibilitychange", checkForRefresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkForRefresh);
    };
  }, [anchor, refresh, view]);

  const navigate = (nextAnchor: string, nextView: CourseCalendarView) => {
    if (nextAnchor === anchor && nextView === view) return;
    setAnchor(nextAnchor);
    setView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.set("kalender", courseCalendarViewQuery(nextView));
    if (nextAnchor === berlinCalendarDay()) url.searchParams.delete("datum");
    else url.searchParams.set("datum", nextAnchor);
    window.history.replaceState(null, "", url);
    void refresh(nextAnchor, nextView);
  };

  const today = berlinCalendarDay();
  return <section className={styles.calendar} aria-labelledby="course-calendar-heading" aria-busy={loading}>
    <p className={styles.explanation}>Die Einträge werden aktuell aus dem DHBW-Kalendersystem gelesen. Sie gehören nicht zum gespeicherten Planungsstand dieses Kurses.</p>
    <CalendarControls anchor={anchor} view={view} loading={loading} onNavigate={navigate} />
    <p className={styles.status} role="status" aria-live="polite">{announcement}</p>
    {result.kind === "available"
      ? view === "week"
        ? <WeekCalendar events={result.events} anchor={anchor} today={today} onOpenList={(day) => navigate(day, "list")} />
        : view === "month"
          ? <MonthCalendar key={anchor} events={result.events} anchor={anchor} today={today} onOpenWeek={(day) => navigate(day, "week")} />
          : <CalendarEventList events={result.events} anchor={anchor} onOpenWeek={(day) => navigate(day, "week")} />
      : <div className={styles.error} role="alert">
        <p>{errorMessage(result)}</p>
        <button className={styles.retry} type="button" disabled={loading} onClick={() => void refresh(anchor, view)}>Erneut laden</button>
      </div>}
  </section>;
}
