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

/**
 * When an entry runs on the one day it is listed under: its clock times, or „ganztägig“ for an all-day entry, which
 * fills that day whether or not it began before it. The times are read straight off the stored wall time, so no
 * time zone is involved in writing them.
 */
export function calendarEventTimeOnDay(event: CalendarEvent): string {
  return event.allDay ? "ganztägig" : `${event.start.slice(11, 16)}–${event.end.slice(11, 16)}`;
}

/** A location as written in the feed, cut into the text around its addresses and the addresses themselves. */
export type CalendarLocationPart = { kind: "text"; text: string } | { kind: "link"; href: string };

const locationUrlPattern = /https?:\/\/[^\s<>"]+/giu;

/**
 * The address a match stands for. Punctuation that closes the sentence around it is not part of it, and a closing
 * parenthesis only is where the address opened one itself. Only web addresses are ever linked, so no feed can place a
 * `javascript:` or similar target into the page.
 */
/* `new URL` rather than `URL.canParse`: the course calendar renders this in the browser, and older Safari lacks it. */
function isWebAddress(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function trimmedUrl(match: string): string {
  let url = match.replace(/[.,;:!?]+$/u, "");
  if (url.endsWith(")") && !url.includes("(")) url = url.slice(0, -1).replace(/[.,;:!?]+$/u, "");
  return url;
}

/**
 * Splits a location into text and links. Feeds write a room, an address on its own, or an address inside a sentence
 * such as „online: https://…“ or „ONLINE; https://…“; every address in it becomes a link, wherever it stands.
 */
export function calendarLocationParts(location: string): CalendarLocationPart[] {
  const parts: CalendarLocationPart[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = parts.at(-1);
    if (last?.kind === "text") last.text += text;
    else parts.push({ kind: "text", text });
  };
  let position = 0;
  for (const match of location.matchAll(locationUrlPattern)) {
    const url = trimmedUrl(match[0]);
    pushText(location.slice(position, match.index));
    if (isWebAddress(url)) parts.push({ kind: "link", href: url });
    else pushText(url);
    position = match.index + url.length;
  }
  pushText(location.slice(position));
  return parts;
}

/** A description split for a page that shows it collapsed: the line that stands for it, and what opening adds. */
export type CalendarDescriptionParts = { firstLine: string; rest: string; collapsible: boolean };

/** Up to this length a single line is shown as it is; anything longer would run past the column of a day page. */
const shortDescriptionLength = 120;

/**
 * Splits a description into its first line and the rest. Feeds carry anything from a lecturer's name to a whole
 * pasted meeting invitation, so a page listing many entries shows the first line and lets the rest be opened. A
 * description of one short line is not worth a control and stays as it is. Blank lines around the rest are dropped,
 * since opening would otherwise start with empty space.
 */
export function calendarDescriptionParts(description: string): CalendarDescriptionParts {
  const value = description.trim();
  const lineBreak = value.indexOf("\n");
  const firstLine = (lineBreak < 0 ? value : value.slice(0, lineBreak)).trim();
  /* Runs of blank lines shrink to one: pasted invitations space their parts out, and opened they would otherwise
     stand as gaps several lines high. */
  const rest = lineBreak < 0 ? "" : value.slice(lineBreak + 1).replace(/\n[^\S\n]*(?:\n[^\S\n]*)+\n/gu, "\n\n").trim();
  return { firstLine, rest, collapsible: Boolean(rest) || firstLine.length > shortDescriptionLength };
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
