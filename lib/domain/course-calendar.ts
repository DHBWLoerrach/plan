import { isCalendarDay, plusDays, weekdayIndex } from "@/lib/domain/calendar-day";

/** One current teaching entry read from the external calendar of a course. Dates encode Berlin wall time in UTC fields. */
export type CalendarEvent = {
  uid: string;
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
  allDay: boolean;
};

export type CalendarGroup = { date: string; events: CalendarEvent[] };
export type CourseCalendarView = "week" | "month" | "list";
export type CalendarEventPlacement = { event: CalendarEvent; column: number; columns: number };

const calendarViewQueries: Record<string, CourseCalendarView> = {
  woche: "week",
  monat: "month",
  liste: "list",
};

export function courseCalendarView(value: string | null | undefined): CourseCalendarView | null {
  return value ? calendarViewQueries[value] ?? null : null;
}

export function courseCalendarViewQuery(view: CourseCalendarView): string {
  return view === "week" ? "woche" : view === "month" ? "monat" : "liste";
}

const berlinParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** UTC is used as a neutral container for Berlin wall time so rendering is independent of the browser time zone. */
function toBerlinWallTime(date: Date): Date {
  const parts: Record<string, string> = {};
  for (const part of berlinParts.formatToParts(date)) parts[part.type] = part.value;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second));
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/u.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = "0", minute = "0", second = "0", utc] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  return utc ? toBerlinWallTime(date) : date;
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/giu, "\n")
    .replace(/\\,/gu, ",")
    .replace(/\\;/gu, ";")
    .replace(/\\\\/gu, "\\");
}

function eventFromProperties(properties: Record<string, string>): CalendarEvent | null {
  const start = parseDate(properties.DTSTART);
  const end = parseDate(properties.DTEND);
  if (!start || !end) return null;
  const allDay = !properties.DTSTART.includes("T");
  /* DTEND does not belong to the event (RFC 5545): a single all-day entry on the sixth is written as ending on the
     seventh. Every view here reckons in the days an entry covers and asks its end whether a day is still one of them,
     so what is kept is the last covered day. A feed that already writes both the same way round keeps its one day. */
  if (allDay && end > start) end.setUTCDate(end.getUTCDate() - 1);
  return {
    uid: properties.UID ?? "",
    title: unescapeText(properties.SUMMARY ?? "").trim() || "(ohne Titel)",
    start: start.toISOString(),
    end: end.toISOString(),
    location: unescapeText(properties.LOCATION ?? "").trim(),
    description: unescapeText(properties.DESCRIPTION ?? "").trim(),
    allDay,
  };
}

/** Parses the deliberately small ICS subset supplied by the DHBW feeds: flat VEVENTs without recurrence rules. */
export function parseCourseCalendar(text: string): CalendarEvent[] {
  const lines = text.replace(/\r\n/gu, "\n").replace(/\n[ \t]/gu, "").split("\n");
  const events: CalendarEvent[] = [];
  let properties: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      properties = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (properties) {
        const event = eventFromProperties(properties);
        if (event) events.push(event);
      }
      properties = null;
      continue;
    }
    if (!properties) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(";", 1)[0].toUpperCase();
    properties[name] = line.slice(colon + 1);
  }

  return events.toSorted((left, right) => left.start.localeCompare(right.start));
}

export function normalizeCalendarAnchor(value: string | null | undefined, fallback: string): string {
  return value && isCalendarDay(value) ? value : fallback;
}

export function calendarWeekDays(anchor: string): string[] {
  const monday = plusDays(anchor, -((weekdayIndex(anchor) + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => plusDays(monday, index));
}

export function calendarMonthDays(anchor: string): string[] {
  const first = `${anchor.slice(0, 7)}-01`;
  const start = calendarWeekDays(first)[0];
  const nextMonth = new Date(`${first}T00:00:00.000Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const last = plusDays(nextMonth.toISOString().slice(0, 10), -1);
  const end = calendarWeekDays(last)[6];
  const days = Math.round((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000) + 1;
  return Array.from({ length: days }, (_, index) => plusDays(start, index));
}

export function eventsOnCalendarDay(events: CalendarEvent[], day: string): CalendarEvent[] {
  return events.filter((event) => event.allDay
    ? event.start.slice(0, 10) <= day && day <= event.end.slice(0, 10)
    : event.start.slice(0, 10) === day);
}

/** Upcoming calendar entries, grouped by their visible first day and capped to keep the interactive payload bounded. */
export function calendarGroups(events: CalendarEvent[], anchor: string): CalendarGroup[] {
  const anchorStart = `${anchor}T00:00:00.000Z`;
  const upcoming = events.filter((event) => event.end >= anchorStart).slice(0, 200);
  const groups: CalendarGroup[] = [];

  for (const event of upcoming) {
    const date = event.start < anchorStart ? anchor : event.start.slice(0, 10);
    const last = groups.at(-1);
    if (last?.date === date) last.events.push(event);
    else groups.push({ date, events: [event] });
  }
  return groups;
}

/** The bounded event payload needed by the list view from one anchor day onward. */
export function calendarEventsFrom(events: CalendarEvent[], anchor: string): CalendarEvent[] {
  return calendarGroups(events, anchor).flatMap((group) => group.events);
}

/** The bounded payload that can contribute to one visible calendar view. */
export function calendarEventsForView(events: CalendarEvent[], anchor: string, view: CourseCalendarView): CalendarEvent[] {
  if (view === "list") return calendarEventsFrom(events, anchor);
  const days = view === "week" ? calendarWeekDays(anchor) : calendarMonthDays(anchor);
  const from = days[0];
  const to = days.at(-1)!;
  return events.filter((event) => event.allDay
    ? event.start.slice(0, 10) <= to && event.end.slice(0, 10) >= from
    : event.start.slice(0, 10) >= from && event.start.slice(0, 10) <= to).slice(0, 200);
}

/** Greedy column allocation for one day's timed events; all events in an overlap cluster share its column count. */
export function calendarEventPlacements(events: CalendarEvent[]): CalendarEventPlacement[] {
  const result: CalendarEventPlacement[] = [];
  let cluster: Array<Omit<CalendarEventPlacement, "columns">> = [];
  let clusterEnd = "";
  let columnEnds: string[] = [];

  const flush = () => {
    if (!cluster.length) return;
    const columns = Math.max(...cluster.map((placement) => placement.column)) + 1;
    result.push(...cluster.map((placement) => ({ ...placement, columns })));
    cluster = [];
    columnEnds = [];
  };

  for (const event of events.toSorted((left, right) => left.start.localeCompare(right.start))) {
    if (cluster.length && event.start >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= event.start);
    if (column < 0) column = columnEnds.length;
    columnEnds[column] = event.end;
    cluster.push({ event, column });
    if (!clusterEnd || event.end > clusterEnd) clusterEnd = event.end;
  }
  flush();
  return result;
}
