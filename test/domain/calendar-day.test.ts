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
