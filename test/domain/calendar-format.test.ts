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
