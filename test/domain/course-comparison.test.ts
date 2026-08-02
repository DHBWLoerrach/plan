import { describe, expect, it } from "vitest";

import { comparisonScope, comparisonScopeLabel, comparisonScopes, coursePlanPath, defaultComparisonScope } from "@/lib/domain/course-comparison";

describe("comparisonScope", () => {
  it("reads every offered option back from its address", () => {
    for (const entry of comparisonScopes) expect(comparisonScope(entry.parameter)).toBe(entry.scope);
  });

  /* A view cannot be wrong the way a cut can: a comparison does not decide what the page is about, only what stands
     beside it. An unreadable value therefore falls back instead of failing. */
  it("falls back to the parallel courses for a missing or unknown value", () => {
    expect(comparisonScope(undefined)).toBe(defaultComparisonScope);
    expect(comparisonScope(null)).toBe(defaultComparisonScope);
    expect(comparisonScope("")).toBe(defaultComparisonScope);
    expect(comparisonScope("nachbarjahrgang")).toBe(defaultComparisonScope);
  });

  it("names the parallel courses of the own study program as the default", () => {
    expect(defaultComparisonScope).toBe("program");
    expect(comparisonScopeLabel(defaultComparisonScope)).toBe("Studiengang");
  });
});

describe("coursePlanPath", () => {
  it("leaves the default comparison out of the address, so the plain plan address is the one that gets linked", () => {
    expect(coursePlanPath("course-1")).toBe("/intern/kurse/course-1/plan");
    expect(coursePlanPath("course-1", "program")).toBe("/intern/kurse/course-1/plan");
  });

  it("carries every other comparison as a parameter", () => {
    expect(coursePlanPath("course-1", "area")).toBe("/intern/kurse/course-1/plan?vergleich=bereich");
    expect(coursePlanPath("course-1", "year")).toBe("/intern/kurse/course-1/plan?vergleich=jahrgang");
    expect(coursePlanPath("course-1", "none")).toBe("/intern/kurse/course-1/plan?vergleich=keiner");
  });

  it("encodes the course id, because it reaches the path from a table row unchecked", () => {
    expect(coursePlanPath("kurs/mit slash")).toBe("/intern/kurse/kurs%2Fmit%20slash/plan");
  });
});
