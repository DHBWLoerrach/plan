import { describe, expect, it } from "vitest";

import { formatCalendarDay, formatCalendarPeriod, formatCompactDuration, formatLongCalendarDay, formatPeriodDuration, weekdayName } from "@/lib/domain/calendar-format";

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

describe("formatPeriodDuration", () => {
  it.each([
    ["2027-04-19", "2027-07-11", "12 Wochen"],
    ["2027-07-12", "2027-09-26", "11 Wochen"],
    ["2026-10-05", "2026-10-11", "1 Woche"],
    ["2026-10-05", "2026-10-15", "1 Woche, 4 Tage"],
    ["2026-10-05", "2026-10-13", "1 Woche, 2 Tage"],
    ["2026-10-05", "2026-10-12", "1 Woche, 1 Tag"],
    ["2026-10-05", "2026-10-09", "5 Tage"],
    ["2026-10-05", "2026-10-05", "1 Tag"],
  ])("names the inclusive length of %s to %s as %s", (startDate, endDate, expected) => {
    expect(formatPeriodDuration(startDate, endDate)).toBe(expected);
  });

  it("counts the leap day of a period spanning it", () => {
    expect(formatPeriodDuration("2028-02-21", "2028-03-05")).toBe("2 Wochen");
  });
});

describe("formatCompactDuration", () => {
  it.each([
    ["2027-04-19", "2027-07-11", "12 Wo."],
    ["2026-10-05", "2026-10-11", "1 Wo."],
    ["2026-10-05", "2026-10-15", "1 Wo. + 4 T."],
    ["2026-10-05", "2026-10-09", "5 T."],
    ["2026-10-05", "2026-10-05", "1 T."],
  ])("abbreviates the length of %s to %s as %s", (startDate, endDate, expected) => {
    expect(formatCompactDuration(startDate, endDate)).toBe(expected);
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

describe("formatLongCalendarDay", () => {
  it("writes weekday, day, month and year out in full", () => {
    expect(formatLongCalendarDay("2026-11-05")).toBe("Donnerstag, 5. November 2026");
  });
});
