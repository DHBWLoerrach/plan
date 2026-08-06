import { describe, expect, it } from "vitest";

import {
  calendarEventPlacements,
  calendarEventsForView,
  calendarMonthDays,
  calendarWeekDays,
  courseCalendarView,
  eventsOnCalendarDay,
  normalizeCalendarAnchor,
  parseCourseCalendar,
  calendarGroups,
} from "@/lib/domain/course-calendar";

const calendar = (events: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR\r\n`;

describe("parseCourseCalendar", () => {
  it("reads DHBW calendar events and represents UTC times as Berlin wall time", () => {
    const [event] = parseCourseCalendar(calendar([
      "BEGIN:VEVENT",
      "UID:event-1",
      "SUMMARY:Analysis\\, Teil 1",
      "DTSTART:20260513T070000Z",
      "DTEND:20260513T101500Z",
      "LOCATION:A336",
      "DESCRIPTION:Zeile 1\\nZeile 2",
      "END:VEVENT",
    ].join("\r\n")));

    expect(event).toEqual({
      uid: "event-1",
      title: "Analysis, Teil 1",
      start: "2026-05-13T09:00:00.000Z",
      end: "2026-05-13T12:15:00.000Z",
      location: "A336",
      description: "Zeile 1\nZeile 2",
      allDay: false,
    });
  });

  it("unfolds lines, reads an all-day period down to its last covered day and ignores incomplete events", () => {
    const events = parseCourseCalendar(calendar([
      "BEGIN:VEVENT",
      "UID:event-1",
      "SUMMARY:Klausurwo",
      " che",
      "DTSTART;VALUE=DATE:20260706",
      "DTEND;VALUE=DATE:20260711",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Ohne Ende",
      "DTSTART:20260706T090000",
      "END:VEVENT",
    ].join("\r\n")));

    // Monday to Friday: the feed writes the following Saturday, which the week does not reach into.
    expect(events).toEqual([expect.objectContaining({
      title: "Klausurwoche",
      start: "2026-07-06T00:00:00.000Z",
      end: "2026-07-10T00:00:00.000Z",
      allDay: true,
    })]);
    expect(eventsOnCalendarDay(events, "2026-07-10").map((event) => event.title)).toEqual(["Klausurwoche"]);
    expect(eventsOnCalendarDay(events, "2026-07-11")).toEqual([]);
  });

  /* The one day an entry lasts is written as two, and a day that begins and ends the entry is what the views ask for
     to say „ganztägig“ rather than a period from one day to the next. */
  it("keeps a single all-day entry on the one day it covers", () => {
    const [event] = parseCourseCalendar(calendar([
      "BEGIN:VEVENT", "UID:holiday", "SUMMARY:Feiertag", "DTSTART;VALUE=DATE:20260706", "DTEND;VALUE=DATE:20260707", "END:VEVENT",
    ].join("\r\n")));

    expect(event).toMatchObject({ start: "2026-07-06T00:00:00.000Z", end: "2026-07-06T00:00:00.000Z", allDay: true });
    expect(eventsOnCalendarDay([event], "2026-07-07")).toEqual([]);
  });
});

describe("calendarGroups", () => {
  it("groups upcoming events by day and places a running all-day event on the anchor day", () => {
    const events = parseCourseCalendar(calendar([
      "BEGIN:VEVENT",
      "UID:week",
      "SUMMARY:Klausurwoche",
      "DTSTART;VALUE=DATE:20260706",
      "DTEND;VALUE=DATE:20260711",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:lecture",
      "SUMMARY:Vorlesung",
      "DTSTART:20260708T090000",
      "DTEND:20260708T120000",
      "END:VEVENT",
    ].join("\r\n")));

    expect(calendarGroups(events, "2026-07-08")).toEqual([{
      date: "2026-07-08",
      events: [expect.objectContaining({ title: "Klausurwoche" }), expect.objectContaining({ title: "Vorlesung" })],
    }]);
  });
});

describe("normalizeCalendarAnchor", () => {
  it("accepts real ISO calendar days and otherwise falls back", () => {
    expect(normalizeCalendarAnchor("2026-02-28", "2026-08-06")).toBe("2026-02-28");
    expect(normalizeCalendarAnchor("2026-02-29", "2026-08-06")).toBe("2026-08-06");
    expect(normalizeCalendarAnchor(undefined, "2026-08-06")).toBe("2026-08-06");
  });
});

describe("courseCalendarView", () => {
  it("übersetzt ausschließlich die drei adressierbaren Kalenderansichten", () => {
    expect(courseCalendarView("woche")).toBe("week");
    expect(courseCalendarView("monat")).toBe("month");
    expect(courseCalendarView("liste")).toBe("list");
    expect(courseCalendarView("unbekannt")).toBeNull();
  });
});

describe("calendar view periods", () => {
  it("builds a Monday-based week and a month made of complete weeks", () => {
    expect(calendarWeekDays("2026-07-08")).toEqual([
      "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12",
    ]);

    const july = calendarMonthDays("2026-07-15");
    expect(july).toHaveLength(35);
    expect(july.at(0)).toBe("2026-06-29");
    expect(july.at(-1)).toBe("2026-08-02");
  });

  it("includes events intersecting the visible week or month", () => {
    const events = parseCourseCalendar(calendar([
      "BEGIN:VEVENT", "UID:running", "SUMMARY:Klausurwoche", "DTSTART;VALUE=DATE:20260706", "DTEND;VALUE=DATE:20260711", "END:VEVENT",
      "BEGIN:VEVENT", "UID:sunday", "SUMMARY:Sonntag", "DTSTART:20260712T090000", "DTEND:20260712T100000", "END:VEVENT",
      "BEGIN:VEVENT", "UID:later", "SUMMARY:Später", "DTSTART:20260803T090000", "DTEND:20260803T100000", "END:VEVENT",
    ].join("\r\n")));

    expect(calendarEventsForView(events, "2026-07-08", "week").map((event) => event.uid)).toEqual(["running", "sunday"]);
    expect(calendarEventsForView(events, "2026-07-15", "month").map((event) => event.uid)).toEqual(["running", "sunday"]);
    expect(eventsOnCalendarDay(events, "2026-07-08").map((event) => event.uid)).toEqual(["running"]);
  });
});

describe("calendarEventPlacements", () => {
  it("places overlapping events beside each other and starts a new cluster afterwards", () => {
    const events = parseCourseCalendar(calendar([
      "BEGIN:VEVENT", "UID:first", "SUMMARY:Erster Termin", "DTSTART:20260706T090000", "DTEND:20260706T110000", "END:VEVENT",
      "BEGIN:VEVENT", "UID:parallel", "SUMMARY:Parallel", "DTSTART:20260706T100000", "DTEND:20260706T120000", "END:VEVENT",
      "BEGIN:VEVENT", "UID:later", "SUMMARY:Danach", "DTSTART:20260706T120000", "DTEND:20260706T130000", "END:VEVENT",
    ].join("\r\n")));

    expect(calendarEventPlacements(events)).toEqual([
      { event: expect.objectContaining({ uid: "first" }), column: 0, columns: 2 },
      { event: expect.objectContaining({ uid: "parallel" }), column: 1, columns: 2 },
      { event: expect.objectContaining({ uid: "later" }), column: 0, columns: 1 },
    ]);
  });
});
