import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CalendarEventList, CourseCalendar } from "@/components/course-calendar";
import { parseCourseCalendar, type CalendarEvent } from "@/lib/domain/course-calendar";

const events: CalendarEvent[] = [
  {
    uid: "one",
    title: "Analysis",
    start: "2026-08-10T09:00:00.000Z",
    end: "2026-08-10T12:15:00.000Z",
    location: "A336",
    description: "Bitte Laptop mitbringen",
    allDay: false,
  },
  {
    uid: "two",
    title: "Online-Seminar",
    start: "2026-08-11T13:00:00.000Z",
    end: "2026-08-11T14:00:00.000Z",
    location: "https://example.test/room",
    description: "",
    allDay: false,
  },
];

describe("CalendarEventList", () => {
  it("renders the readable calendar details grouped by day", () => {
    const markup = renderToStaticMarkup(createElement(CalendarEventList, { events, anchor: "2026-08-10" }));

    expect(markup).toContain("Montag, 10. August 2026");
    expect(markup).toContain("09:00–12:15");
    expect(markup).toContain("Analysis");
    expect(markup).toContain("A336");
    expect(markup).toContain("Bitte Laptop mitbringen");
    expect(markup).toContain('href="https://example.test/room"');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it("states when the feed has no future calendar entries", () => {
    const markup = renderToStaticMarkup(createElement(CalendarEventList, { events: [], anchor: "2026-08-10" }));
    expect(markup).toContain("Keine Kalendertermine ab diesem Datum");
  });

  /* An entry lasting one day says so and does not name a period from that day to the next — what the feed writes as
     its end is the day after the last one it covers, and the day is what is read here. */
  it("names a single all-day entry as lasting the whole day", () => {
    const [holiday] = parseCourseCalendar([
      "BEGIN:VEVENT", "UID:holiday", "SUMMARY:Feiertag", "DTSTART;VALUE=DATE:20260810", "DTEND;VALUE=DATE:20260811", "END:VEVENT",
    ].join("\r\n"));
    const markup = renderToStaticMarkup(createElement(CalendarEventList, { events: [holiday], anchor: "2026-08-10" }));

    expect(markup).toContain("ganztägig");
    expect(markup).not.toContain("11.08.");
  });
});

describe("CourseCalendar", () => {
  it("kennzeichnet die Zeitraum-Navigation als benannte Gruppe", () => {
    const markup = renderToStaticMarkup(createElement(CourseCalendar, {
      courseId: "course-1",
      initialAnchor: "2026-08-06",
      initialView: "week",
      initialResult: { kind: "available", events: [] },
    }));

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Kalenderzeitraum"');
    expect(markup).toContain('aria-label="Kalenderansicht"');
    expect(markup).toContain('aria-pressed="true">Woche');
  });

  it("renders a weekly time grid with parallel teaching events", () => {
    const markup = renderToStaticMarkup(createElement(CourseCalendar, {
      courseId: "course-1",
      initialAnchor: "2026-08-10",
      initialView: "week",
      initialResult: { kind: "available", events },
    }));

    expect(markup).toContain("Montag, 10. August");
    expect(markup).toContain("10.–16. August 2026");
    expect(markup).toContain("Analysis");
    expect(markup).toContain("Listenansicht ab diesem Tag");
  });

  it("renders a monthly grid with expandable event details", () => {
    const markup = renderToStaticMarkup(createElement(CourseCalendar, {
      courseId: "course-1",
      initialAnchor: "2026-08-10",
      initialView: "month",
      initialResult: { kind: "available", events },
    }));

    expect(markup).toContain('aria-label="Monatsansicht August 2026"');
    expect(markup).toContain("09:00 Analysis — Details anzeigen");
    expect(markup).toContain("Woche für Montag, 10. August öffnen");
  });
});
