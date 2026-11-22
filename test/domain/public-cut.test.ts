import { describe, expect, it } from "vitest";

import { areaCut, programCut, publicCutPath, publicCutTitle, relatedCuts, yearCut, routeSegment } from "@/lib/domain/public-cut";

describe("publicCutPath", () => {
  it("addresses a course by its course code", () => {
    expect(publicCutPath({ kind: "course", code: "TIF24A" })).toBe("/TIF24A");
  });

  it("addresses every other cut through its year", () => {
    expect(publicCutPath({ kind: "year", year: 2024 })).toBe("/jahrgang/2024");
    expect(publicCutPath({ kind: "area", year: 2024, name: "Technik" })).toBe("/jahrgang/2024/bereich/Technik");
    expect(publicCutPath({ kind: "program", year: 2024, abbreviation: "TIF", name: "Informatik" })).toBe("/jahrgang/2024/studiengang/TIF");
  });

  it("encodes a designation that carries spaces or slashes", () => {
    expect(publicCutPath({ kind: "area", year: 2024, name: "IT-Management und Informatik" }))
      .toBe("/jahrgang/2024/bereich/IT-Management%20und%20Informatik");
    expect(publicCutPath({ kind: "program", year: 2024, abbreviation: "WI/T" }))
      .toBe("/jahrgang/2024/studiengang/WI%2FT");
  });
});

describe("publicCutTitle", () => {
  it("names a cut by its course code or by its year and the designation restricting it", () => {
    expect(publicCutTitle({ kind: "course", code: "TIF24A" })).toBe("TIF24A");
    expect(publicCutTitle({ kind: "year", year: 2024 })).toBe("Jahrgang 2024");
    expect(publicCutTitle({ kind: "area", year: 2024, name: "Technik" })).toBe("Technik · Jahrgang 2024");
    expect(publicCutTitle({ kind: "program", year: 2024, abbreviation: "TIF", name: "Informatik" })).toBe("Informatik · Jahrgang 2024");
    expect(publicCutTitle({ kind: "program", year: 2024, abbreviation: "TIF" })).toBe("TIF · Jahrgang 2024");
  });
});

describe("cuts read from an address", () => {
  it("reads a four-digit calendar year", () => {
    expect(yearCut("2024")).toEqual({ kind: "year", year: 2024 });
    expect(areaCut("2024", "Technik")).toEqual({ kind: "area", year: 2024, name: "Technik" });
    expect(programCut("2024", "tif")).toEqual({ kind: "program", year: 2024, abbreviation: "tif" });
  });

  it("reads nothing where the address carries no calendar year, so the cut is not silently widened", () => {
    expect(yearCut("2024x")).toBeNull();
    expect(yearCut("24")).toBeNull();
    expect(yearCut(" 2024")).toBeNull();
    expect(yearCut("")).toBeNull();
    expect(areaCut("zwanzig", "Technik")).toBeNull();
    expect(programCut("2024", "")).toBeNull();
  });
});

describe("relatedCuts", () => {
  const course = { program: "Informatik", programAbbreviation: "TIF", area: "Technik", year: 2024 };

  it("leads from one course to its year, its program and its area", () => {
    expect(relatedCuts({ kind: "course", code: "TIF24A" }, course)).toEqual([
      { kind: "year", year: 2024 },
      { kind: "program", year: 2024, abbreviation: "TIF", name: "Informatik" },
      { kind: "area", year: 2024, name: "Technik" },
    ]);
  });

  it("leads from a program or an area back to the whole year", () => {
    expect(relatedCuts({ kind: "program", year: 2024, abbreviation: "TIF", name: "Informatik" }, course)).toEqual([{ kind: "year", year: 2024 }]);
    expect(relatedCuts({ kind: "area", year: 2024, name: "Technik" }, course)).toEqual([{ kind: "year", year: 2024 }]);
  });

  it("leads nowhere further from a whole year", () => {
    expect(relatedCuts({ kind: "year", year: 2024 }, course)).toEqual([]);
  });
});

describe("routeSegment", () => {
  it("decodes what the router hands on encoded, so codes and names with spaces find their plan", () => {
    expect(routeSegment("FRM22%20ALT")).toBe("FRM22 ALT");
    expect(routeSegment("Studienbereich%20Technik")).toBe("Studienbereich Technik");
    expect(routeSegment("TIF25A")).toBe("TIF25A");
  });

  it("keeps a segment that is no valid encoding as it came", () => {
    expect(routeSegment("100%")).toBe("100%");
  });
});
