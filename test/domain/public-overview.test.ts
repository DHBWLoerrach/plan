import { describe, expect, it } from "vitest";

import {
  buildPublicOverview,
  normalizeSearch,
  selectPublicOverview,
  suggestPublicOverview,
  type OverviewCourse,
} from "@/lib/domain/public-overview";
import type { CoursePhase } from "@/lib/domain/publication";

const today = "2026-11-20";

function course(code: string, overrides: Partial<OverviewCourse> = {}): OverviewCourse {
  const year = 2000 + Number(code.slice(3, 5));
  const programs: Record<string, string> = {
    WWI: "Wirtschaftsinformatik",
    TIF: "Informatik",
    WHC: "BWL – Gesundheitsmanagement",
    WPM: "BWL – Personalmanagement",
  };
  const abbreviation = code.slice(0, 3);
  return {
    id: code,
    code,
    studyStart: `${year}-10-01`,
    studyEnd: `${year + 3}-09-30`,
    semesters: 6,
    programAbbreviation: abbreviation,
    program: programs[abbreviation],
    year,
    ...overrides,
  };
}

function phase(courseId: string, startDate: string): CoursePhase {
  return { courseId, semester: 1, type: "THEORY", startDate, endDate: "2026-12-20" };
}

const courses = [
  course("WWI24A"), course("WWI24B"), course("WWI25A"), course("WWI25B"),
  course("WHC25A"), course("WHC25B"),
  course("TIF24A"), course("TIF26A"),
  course("WPM24A"), course("WPM25A"), course("WPM26A"),
];
const phases = [
  phase("WWI24A", "2024-10-01"), phase("WWI24B", "2025-01-01"),
  phase("WWI25A", "2025-10-01"), phase("WWI25B", "2026-01-01"),
  phase("WHC25A", "2025-10-01"), phase("WHC25B", "2025-10-01"),
];
const overview = buildPublicOverview(courses, phases, today);
const program = (abbreviation: string) => overview.programs.find((candidate) => candidate.abbreviation === abbreviation)!;

describe("buildPublicOverview", () => {
  it("forms one row per program, sorted by name, and one column per year", () => {
    expect(overview.programs.map((candidate) => candidate.name))
      .toEqual(["BWL – Gesundheitsmanagement", "BWL – Personalmanagement", "Informatik", "Wirtschaftsinformatik"]);
    expect(overview.years).toEqual([
      { year: 2024, label: "Start Okt. 2024", detail: "3. Studienjahr" },
      { year: 2025, label: "Start Okt. 2025", detail: "2. Studienjahr" },
      { year: 2026, label: "Start Okt. 2026", detail: "1. Studienjahr" },
    ]);
    expect(overview.nextYear).toBe(2027);
    expect(overview.exampleCode).toBe("TIF26");
    expect(buildPublicOverview([course("TIF26A", { code: "TIF2026A" })], [], today).exampleCode).toBe("TIF2026");
  });

  it("joins parallel courses with the same progression into one link to the program cut", () => {
    expect(program("WHC").cells[2025]).toEqual([{
      label: "WHC25A + B", href: "/jahrgang/2025/studiengang/WHC", codes: ["WHC25A", "WHC25B"], status: { type: "THEORY", text: "An der DHBW bis 20.12." },
    }]);
  });

  it("links every course of a year on its own where its courses form more than one group", () => {
    const four = ["WHC25A", "WHC25B", "WHC25C", "WHC25D"].map((code) => course(code));
    const split = buildPublicOverview(four, [
      phase("WHC25A", "2025-10-01"), phase("WHC25B", "2025-10-01"), phase("WHC25C", "2026-01-01"), phase("WHC25D", "2026-01-01"),
    ], today);

    expect(split.programs[0].cells[2025].map((chip) => chip.href)).toEqual(["/WHC25A", "/WHC25B", "/WHC25C", "/WHC25D"]);
  });

  it("links the courses of a year singly where the program cut would also show an ended course", () => {
    const withEnded = buildPublicOverview(courses, phases, today, new Map([["whc 2025", 3]]));

    expect(withEnded.programs.find((candidate) => candidate.abbreviation === "WHC")!.cells[2025].map((chip) => chip.href))
      .toEqual(["/WHC25A", "/WHC25B"]);
  });

  it("tells for each link the phase its course is in, or the next one", () => {
    const status = (start: string, end: string, type: "THEORY" | "PRACTICE" = "PRACTICE") => buildPublicOverview(
      [course("TIF26A")], [{ courseId: "TIF26A", semester: 1, type, startDate: start, endDate: end }], today,
    ).programs[0].cells[2026][0].status;

    expect(status("2026-10-01", "2026-12-31")).toEqual({ type: "PRACTICE", text: "Im Unternehmen bis 31.12." });
    expect(status("2027-01-04", "2027-03-28", "THEORY")).toEqual({ type: "THEORY", text: "An der DHBW ab 04.01." });
    expect(status("2026-01-01", "2026-03-31")).toBeNull();
  });

  it("joins phases of one type that follow each other into one stay, like practice across a semester boundary", () => {
    const stay = buildPublicOverview([course("TIF26A")], [
      { courseId: "TIF26A", semester: 1, type: "PRACTICE", startDate: "2026-10-01", endDate: "2027-03-31" },
      { courseId: "TIF26A", semester: 2, type: "PRACTICE", startDate: "2027-04-01", endDate: "2027-06-30" },
      { courseId: "TIF26A", semester: 2, type: "THEORY", startDate: "2027-07-01", endDate: "2027-09-30" },
    ], today).programs[0].cells[2026][0].status;

    expect(stay).toEqual({ type: "PRACTICE", text: "Im Unternehmen bis 30.06." });
  });

  it("keeps parallel courses with different progressions apart", () => {
    expect(program("WWI").cells[2024].map((chip) => [chip.label, chip.href])).toEqual([["WWI24A", "/WWI24A"], ["WWI24B", "/WWI24B"]]);
  });

  it("marks a year that has not started and keeps it out of the next study start", () => {
    const early = buildPublicOverview(courses, phases, "2026-07-26");

    expect(early.years.at(-1)).toEqual({ year: 2026, label: "Start Okt. 2026", detail: "noch nicht begonnen" });
    expect(early.nextYear).toBe(2026);
  });

  it("counts a study start as begun from October even without a published plan of it", () => {
    const olderOnly = buildPublicOverview([course("WWI24A")], [], today);

    expect(olderOnly.nextYear).toBe(2027);
    expect(selectPublicOverview(olderOnly, { query: "WWI25", year: "all" }).emptyReason).toBe("not-published");
    expect(buildPublicOverview([course("WWI24A")], [], "2026-09-30").nextYear).toBe(2026);
  });

  it("leaves out the progress of a column whose courses have not all begun", () => {
    const mixed = buildPublicOverview([course("TIF26A"), course("WPM26A", { studyStart: "2026-12-01" })], [], today);

    expect(mixed.years[0]).toEqual({ year: 2026, label: "Start 2026", detail: null });
  });

  it("counts a year as running for as long as the program lasts", () => {
    const architecture = buildPublicOverview([course("WWI24A", { semesters: 7 })], [], today);
    const reason = (query: string) => selectPublicOverview(architecture, { query, year: "all" }).emptyReason;

    expect(reason("WWI23")).toBe("not-published");
    expect(reason("WWI22")).toBe("no-match");
    expect(reason("WWI23")).not.toBe(selectPublicOverview(overview, { query: "WWI23", year: "all" }).emptyReason);
  });

  it("drops the month from a column whose courses start in different months", () => {
    const mixed = buildPublicOverview([course("TIF26A"), course("WPM26A", { studyStart: "2026-09-01" })], [], today);

    expect(mixed.years[0].label).toBe("Start 2026");
  });
});

describe("selectPublicOverview", () => {
  const codes = (query: string, year = "all") => selectPublicOverview(overview, { query, year }).programs.map((candidate) => candidate.abbreviation);

  it("finds programs by a part of their name, ignoring case, accents and punctuation", () => {
    expect(codes("pers")).toEqual(["WPM"]);
    expect(codes("bwl gesundheit")).toEqual(["WHC"]);
    expect(normalizeSearch("Künstliche  Intelligenz")).toBe("kunstliche intelligenz");
  });

  it("finds programs by abbreviation and by the start of a course code", () => {
    expect(codes("wwi")).toEqual(["WWI"]);
    expect(codes("TIF26")).toEqual(["TIF"]);
    expect(codes("if26")).toEqual([]);
  });

  it("compares course codes alike on both sides, hyphens included", () => {
    const withHyphen = buildPublicOverview([course("WWI25A-A")], [], today);

    expect(selectPublicOverview(withHyphen, { query: "WWI25A-A", year: "all" }).programs.map((candidate) => candidate.abbreviation)).toEqual(["WWI"]);
    expect(selectPublicOverview(withHyphen, { query: "wwi25a a", year: "all" }).programs).toHaveLength(1);
    expect(suggestPublicOverview(withHyphen, "WWI25A-A").courses.map((suggestion) => suggestion.code)).toEqual(["WWI25A-A"]);
  });

  it("finds only the program a query names exactly", () => {
    expect(codes("Informatik")).toEqual(["TIF"]);
    expect(codes("forma")).toEqual(["TIF", "WWI"]);
  });

  it("narrows the columns to one year and leaves out programs without a course in it", () => {
    const selection = selectPublicOverview(overview, { query: "", year: "2026" });

    expect(selection.years.map((year) => year.year)).toEqual([2026]);
    expect(selection.programs.map((candidate) => candidate.abbreviation)).toEqual(["WPM", "TIF"]);
  });

  it("applies the year to the course a code names, not to the rest of its program", () => {
    const programsFor = (query: string, year: string) => selectPublicOverview(overview, { query, year }).programs.map((candidate) => candidate.abbreviation);

    expect(programsFor("TIF24A", "2026")).toEqual([]);
    expect(selectPublicOverview(overview, { query: "TIF24A", year: "2026" }).emptyReason).toBe("not-in-year");
    expect(programsFor("TIF24A", "2024")).toEqual(["TIF"]);
    expect(programsFor("Informatik", "2026")).toEqual(["TIF"]);
  });

  it("shows every year for a year it does not know", () => {
    expect(selectPublicOverview(overview, { query: "", year: "2019" }).years).toHaveLength(3);
  });

  it("tells why nothing was found", () => {
    const reason = (query: string, year = "all") => selectPublicOverview(overview, { query, year }).emptyReason;

    expect(reason("")).toBeNull();
    expect(reason("Logistik")).toBe("no-match");
    expect(reason("WWI27")).toBe("not-yet-published");
    expect(reason("WWI2027A")).toBe("not-yet-published");
    expect(reason("WWI26")).toBe("not-published");
    expect(reason("WWI23")).toBe("no-match");
    expect(reason("WHC", "2024")).toBe("not-in-year");
    expect(selectPublicOverview(buildPublicOverview([], [], today), { query: "", year: "all" }).emptyReason).toBe("nothing-published");
  });
});

describe("suggestPublicOverview", () => {
  it("suggests the matching programs and their newest courses", () => {
    const suggestions = suggestPublicOverview(overview, "pers");

    expect(suggestions.programs).toEqual([{ abbreviation: "WPM", name: "BWL – Personalmanagement", label: "BWL – Personalmanagement", detail: "3 Jahrgänge" }]);
    expect(suggestions.courses.map((candidate) => [candidate.code, candidate.href, candidate.detail])).toEqual([
      ["WPM26A", "/WPM26A", "Start Okt. 2026 · 1. Studienjahr"],
      ["WPM25A", "/WPM25A", "Start Okt. 2025 · 2. Studienjahr"],
      ["WPM24A", "/WPM24A", "Start Okt. 2024 · 3. Studienjahr"],
    ]);
  });

  it("describes a course by its own study start, not by the earliest of its year", () => {
    const late = buildPublicOverview([course("TIF26A"), course("WPM26A", { studyStart: "2026-12-01" })], [], today);

    expect(suggestPublicOverview(late, "WPM26A").courses[0].detail).toBe("Start Dez. 2026 · noch nicht begonnen");
    expect(suggestPublicOverview(late, "TIF26A").courses[0].detail).toBe("Start Okt. 2026 · 1. Studienjahr");
  });

  it("suggests courses by the start of their code", () => {
    expect(suggestPublicOverview(overview, "wwi25").courses.map((candidate) => candidate.code)).toEqual(["WWI25A", "WWI25B"]);
  });

  it("suggests only programs and courses of a chosen study start", () => {
    const suggestions = suggestPublicOverview(overview, "pers", "2024");

    expect(suggestions.courses.map((candidate) => candidate.code)).toEqual(["WPM24A"]);
    expect(suggestPublicOverview(overview, "wwi", "2026")).toEqual({ programs: [], courses: [] });
    expect(suggestPublicOverview(overview, "TIF24A", "2026")).toEqual({ programs: [], courses: [] });
    expect(suggestPublicOverview(overview, "TIF24A", "2024").programs.map((candidate) => candidate.abbreviation)).toEqual(["TIF"]);
  });

  it("tells programs of the same name apart by their abbreviation, which then finds the one alone", () => {
    const twins = buildPublicOverview([course("TIF26A"), course("TIF26A", { id: "INF26A", code: "INF26A", programAbbreviation: "INF" })], [], today);

    expect(suggestPublicOverview(twins, "Informatik").programs.map((candidate) => [candidate.label, candidate.detail]))
      .toEqual([["INF", "INF · 1 Jahrgang"], ["TIF", "TIF · 1 Jahrgang"]]);
    expect(selectPublicOverview(twins, { query: "TIF", year: "all" }).programs.map((candidate) => candidate.abbreviation)).toEqual(["TIF"]);

    const overlapping = buildPublicOverview([course("TIF26A"), course("TIF26A", { id: "TIFX26A", code: "TIFX26A", programAbbreviation: "TIFX" })], [], today);
    expect(suggestPublicOverview(overlapping, "TIF").courses.map((candidate) => candidate.code)).toEqual(["TIF26A"]);
  });

  it("suggests nothing for an empty field", () => {
    expect(suggestPublicOverview(overview, "  ")).toEqual({ programs: [], courses: [] });
  });
});
