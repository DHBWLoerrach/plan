import { describe, expect, it } from "vitest";

import { matchesCodePrefix, normalizeCodePrefix, normalizeCourseCode } from "@/lib/domain/course-code";

describe("normalizeCourseCode", () => {
  it("makes the same course code compare equal however it is written", () => {
    expect(normalizeCourseCode(" TIF25A ")).toBe("tif25a");
    expect(normalizeCourseCode("tif25a")).toBe(normalizeCourseCode("TIF25A"));
  });
});

describe("normalizeCodePrefix", () => {
  it("keeps a filter that holds a value", () => {
    expect(normalizeCodePrefix(" TIF24 ")).toBe("tif24");
  });

  it("reports an absent filter as none, so the caller filters nothing rather than everything", () => {
    expect(normalizeCodePrefix(null)).toBeNull();
    expect(normalizeCodePrefix(undefined)).toBeNull();
    expect(normalizeCodePrefix("")).toBeNull();
    expect(normalizeCodePrefix("   ")).toBeNull();
  });
});

describe("matchesCodePrefix", () => {
  it("matches the beginning of a course code without regard to case", () => {
    const prefix = normalizeCodePrefix("tif24")!;
    expect(matchesCodePrefix("TIF24A", prefix)).toBe(true);
    expect(matchesCodePrefix("TIF24B", prefix)).toBe(true);
    expect(matchesCodePrefix("TIF25A", prefix)).toBe(false);
  });

  it("matches the beginning only, not an occurrence somewhere in the code", () => {
    expect(matchesCodePrefix("WWI24A", normalizeCodePrefix("24")!)).toBe(false);
  });
});
