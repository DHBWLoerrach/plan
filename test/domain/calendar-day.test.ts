import { describe, expect, it } from "vitest";

import { inclusiveDays, isCalendarDay, plusDays } from "@/lib/domain/calendar-day";

describe("isCalendarDay", () => {
  it("accepts a valid Gregorian day and refuses anything a half-typed field may hold", () => {
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2027-02-29")).toBe(false);
    expect(isCalendarDay("2027-3-1")).toBe(false);
    expect(isCalendarDay("")).toBe(false);
  });
});

describe("inclusiveDays", () => {
  it("counts both days of the period", () => {
    expect(inclusiveDays("2027-03-31", "2027-04-01")).toBe(2);
  });

  it("counts a single day as one", () => {
    expect(inclusiveDays("2027-03-31", "2027-03-31")).toBe(1);
  });

  it("counts the leap day of a period spanning it", () => {
    expect(inclusiveDays("2028-02-28", "2028-03-01")).toBe(3);
  });
});

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
