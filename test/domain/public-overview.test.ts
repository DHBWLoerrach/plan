import { describe, expect, it } from "vitest";

import {
  buildPublicOverview,
  highlightPieces,
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

  it("leaves out the names of the plans and takes the remaining words in any order", () => {
    expect(codes("Semesterplan Personal")).toEqual(["WPM"]);
    expect(codes("personal bwl")).toEqual(["WPM"]);
    expect(codes("Blockpläne für Gesundheit")).toEqual(["WHC"]);
    expect(codes("Studienzeitplan wwi25")).toEqual(["WWI"]);
    expect(codes("Blockplan")).toEqual(["WHC", "WPM", "TIF", "WWI"]);
    expect(selectPublicOverview(overview, { query: "Semesterplan WWI27", year: "all" }).emptyReason).toBe("not-yet-published");
    expect(suggestPublicOverview(overview, "Vorlesungsplan wwi25").courses.map((candidate) => candidate.code)).toEqual(["WWI25A", "WWI25B"]);
  });

  it("finds a program whose whole name holds a plan word before leaving the plan words out", () => {
    const planning = buildPublicOverview([
      course("TIF26A", { id: "PFR26A", code: "PFR26A", programAbbreviation: "PFR", program: "Planung für Räume" }),
      course("TIF26A", { id: "PRA26A", code: "PRA26A", programAbbreviation: "PRA", program: "Planung Räume" }),
    ], [], today);

    expect(selectPublicOverview(planning, { query: "Planung für Räume", year: "all" }).programs.map((candidate) => candidate.abbreviation)).toEqual(["PFR"]);
  });

  it("shows only the courses a course code begins, not the program's other years", () => {
    const selection = selectPublicOverview(overview, { query: "WWI25", year: "all" });

    expect(selection.programs.map((candidate) => Object.keys(candidate.cells))).toEqual([["2025"]]);
    expect(selectPublicOverview(overview, { query: "wwi", year: "all" }).programs[0].cells[2024]).toHaveLength(2);
  });

  it("leaves out only the plan words around a query, not those inside a name", () => {
    const planning = buildPublicOverview([
      course("TIF26A", { id: "PFR26A", code: "PFR26A", programAbbreviation: "PFR", program: "Planung für Räume" }),
      course("TIF26A", { id: "PRA26A", code: "PRA26A", programAbbreviation: "PRA", program: "Planung Räume" }),
    ], [], today);

    expect(selectPublicOverview(planning, { query: "Semesterplan für Planung für Räume", year: "all" }).programs.map((candidate) => candidate.abbreviation))
      .toEqual(["PFR"]);
    expect(selectPublicOverview(planning, { query: "Planung Räume Blockplan", year: "all" }).programs.map((candidate) => candidate.abbreviation))
      .toEqual(["PRA"]);
  });

  it("shows the years a search found something in and names the years a course code left out", () => {
    const selection = selectPublicOverview(overview, { query: "WWI25", year: "all" });

    expect(selection.years.map((candidate) => candidate.year)).toEqual([2025]);
    expect(selection.programs[0].omitted).toEqual([2024]);
    expect(selectPublicOverview(overview, { query: "", year: "all" }).years).toHaveLength(3);
  });

  it("passes over lone punctuation among the plan words around a query", () => {
    expect(codes("Semesterplan – für Personalmanagement")).toEqual(["WPM"]);
  });

  it("reads a course code only from a query of one word", () => {
    const withEnded = buildPublicOverview(courses, phases, today, new Map([["wwi 2023", 1]]), [{ code: "WWI23A", year: 2023 }]);

    expect(selectPublicOverview(withEnded, { query: "WWI23 irgendwas", year: "all" }).emptyReason).toBe("no-match");
    expect(selectPublicOverview(withEnded, { query: "Semesterplan WWI23A", year: "all" }).emptyReason).toBe("ended");
    expect(selectPublicOverview(overview, { query: "WWI27 irgendwas", year: "all" }).emptyReason).toBe("no-match");
  });

  it("parts a plan word from a program at a hyphen, but not from a course code", () => {
    expect(codes("Semesterplan-Personal")).toEqual(["WPM"]);
    expect(codes("Gesundheit-Blockplan")).toEqual(["WHC"]);
  });

  it("tells a page without running years from one without any published plan", () => {
    const ended = buildPublicOverview([], [], today, new Map([["wwi 2022", 1]]), [{ code: "WWI22A", year: 2022 }]);

    expect(selectPublicOverview(ended, { query: "", year: "all" }).emptyReason).toBe("nothing-running");
    expect(selectPublicOverview(ended, { query: "WWI22A", year: "all" }).emptyReason).toBe("ended");
    expect(selectPublicOverview(ended, { query: "Blockplan", year: "all" }).emptyReason).toBe("nothing-running");
    expect(selectPublicOverview(buildPublicOverview([], [], today), { query: "", year: "all" }).emptyReason).toBe("nothing-published");
  });

  it("keeps a plan word that is part of a course code", () => {
    const planned = buildPublicOverview([course("WWI26A", { code: "WWI26-PLAN" }), course("WWI26A", { id: "WWI26-A", code: "WWI26-A" })], [], today);

    expect(suggestPublicOverview(planned, "WWI26-PLAN").courses.map((candidate) => candidate.code)).toEqual(["WWI26-PLAN"]);
    expect(suggestPublicOverview(planned, "Semesterplan WWI26-PLAN").courses.map((candidate) => candidate.code)).toEqual(["WWI26-PLAN"]);
  });

  it("leads an ended course to its plan and a year whose courses have all ended to the year's plan", () => {
    const withEnded = buildPublicOverview(courses, phases, today, new Map([["wwi 2023", 1], ["wwi 2024", 2], ["wwi 2025", 2]]),
      [{ code: "WWI23A", year: 2023 }]);
    const plan = (query: string) => selectPublicOverview(withEnded, { query, year: "all" });

    expect(plan("WWI23A")).toMatchObject({ emptyReason: "ended", endedPlan: "/WWI23A" });
    expect(plan("WWI23")).toMatchObject({ emptyReason: "ended", endedPlan: "/jahrgang/2023/studiengang/WWI" });
    expect(plan("WWI23Z")).toMatchObject({ emptyReason: "no-match" });
    expect(plan("WWI23Z").endedPlan).toBeUndefined();
    expect(plan("WWI26").emptyReason).toBe("not-published");
  });

  it("keeps an ended course reachable by its whole code while running courses begin with it", () => {
    const beside = buildPublicOverview([course("WWI24A", { id: "WWI24A-IT", code: "WWI24A-IT" })], [], today, undefined,
      [{ code: "WWI24A", year: 2024 }]);
    const selection = selectPublicOverview(beside, { query: "WWI24A", year: "all" });

    expect(selection.programs.map((candidate) => candidate.abbreviation)).toEqual(["WWI"]);
    expect(selection.archivedPlan).toEqual({ code: "WWI24A", href: "/WWI24A" });
  });

  it("answers with an archive hit of the chosen year though running courses of another year begin with it", () => {
    const dual = buildPublicOverview([course("WWI26A", { id: "WWI26-B", code: "WWI26-B" }), course("TIF24A")], [], today, undefined,
      [{ code: "WWI2", year: 2024 }]);

    expect(selectPublicOverview(dual, { query: "WWI2", year: "2024" })).toMatchObject({ emptyReason: "ended", endedPlan: "/WWI2" });
    const plain = buildPublicOverview([course("WWI26A", { id: "DUAL-B", code: "DUAL-B", programAbbreviation: "DUAL" }), course("TIF24A")], [], today, undefined,
      [{ code: "DUAL", year: 2024 }]);
    expect(selectPublicOverview(plain, { query: "Blockplan-DUAL", year: "2024" })).toMatchObject({ emptyReason: "ended", endedPlan: "/DUAL" });
    expect(selectPublicOverview(dual, { query: "WWI2", year: "all" }).archivedPlan).toEqual({ code: "WWI2", href: "/WWI2" });
    expect(selectPublicOverview(dual, { query: "WWI2", year: "2026" }).archivedPlan).toBeUndefined();
  });

  it("finds an ended course by a code with hyphens and without digits", () => {
    const campus = buildPublicOverview(courses, phases, today, undefined, [{ code: "CAMPUS-WEST", year: 2023 }]);

    expect(selectPublicOverview(campus, { query: "CAMPUS-WEST", year: "all" })).toMatchObject({ emptyReason: "ended", endedPlan: "/CAMPUS-WEST" });
    expect(selectPublicOverview(campus, { query: "Blockplan CAMPUS-WEST", year: "all" }).endedPlan).toBe("/CAMPUS-WEST");
    expect(selectPublicOverview(campus, { query: "Blockplan-CAMPUS-WEST", year: "all" }).endedPlan).toBe("/CAMPUS-WEST");
  });

  it("takes the query as typed before leaving out plan words, so a code holding one finds itself", () => {
    const plans = buildPublicOverview(courses, phases, today, undefined,
      [{ code: "FRM22", year: 2022 }, { code: "FRM22 PLAN", year: 2022 }, { code: "FRM22 ALT", year: 2022 }, { code: "FRM22  ALT", year: 2022 }]);
    const plan = (query: string) => selectPublicOverview(plans, { query, year: "all" }).endedPlan;

    expect(plan("FRM22 PLAN")).toBe("/FRM22%20PLAN");
    expect(plan("Semesterplan für FRM22 PLAN")).toBe("/FRM22%20PLAN");
    expect(plan("Semesterplan FRM22")).toBe("/FRM22");
    expect(plan("FRM22  ALT")).toBe("/FRM22%20%20ALT");
    expect(plan("FRM22 ALT")).toBe("/FRM22%20ALT");
  });

  it("finds an ended course by a code with a space", () => {
    const spaced = buildPublicOverview(courses, phases, today, undefined, [{ code: "FRM22 ALT", year: 2022 }]);

    expect(selectPublicOverview(spaced, { query: "FRM22 ALT", year: "all" })).toMatchObject({ emptyReason: "ended", endedPlan: "/FRM22%20ALT" });
    expect(selectPublicOverview(spaced, { query: "Semesterplan FRM22 ALT", year: "all" }).endedPlan).toBe("/FRM22%20ALT");
  });

  it("finds a program by its abbreviation typed exactly, before one that reads the same once normalized", () => {
    const twins = buildPublicOverview([
      course("TIF26A", { id: "ABC26A", code: "ABC26A", programAbbreviation: "ABC", program: "Informatik" }),
      course("TIF26A", { id: "AB-C26A", code: "AB-C26A", programAbbreviation: "AB-C", program: "Informatik" }),
    ], [], today);
    const found = (query: string) => selectPublicOverview(twins, { query, year: "all" }).programs.map((candidate) => candidate.abbreviation);

    expect(found("ABC")).toEqual(["ABC"]);
    expect(found("AB-C")).toEqual(["AB-C"]);

    const withOlder = buildPublicOverview([
      course("TIF26A", { id: "AB-C26Q", code: "AB-C26Q", programAbbreviation: "AB-C", program: "Informatik" }),
      course("TIF25A", { id: "ALT25WEST", code: "ALT25WEST", programAbbreviation: "AB-C", program: "Informatik" }),
      course("TIF26A", { id: "ABC26A", code: "ABC26A", programAbbreviation: "ABC", program: "Informatik" }),
    ], [], today);
    const chosen = selectPublicOverview(withOlder, { query: "AB-C", year: "all" });
    expect(chosen.programs.map((candidate) => Object.values(candidate.cells).flat().map((chip) => chip.label))).toEqual([["ALT25WEST", "AB-C26Q"]]);
    expect(selectPublicOverview(withOlder, { query: "AB-C", year: "2025" }).programs[0].cells[2025].map((chip) => chip.label)).toEqual(["ALT25WEST"]);
    expect(suggestPublicOverview(twins, "Informatik").programs.map((candidate) => candidate.label).toSorted()).toEqual(["AB-C", "ABC"]);
  });

  it("offers an archive hit only for the chosen study start", () => {
    const withEnded = buildPublicOverview(courses, phases, today, new Map([["wwi 2023", 1]]), [{ code: "WWI23A", year: 2023 }]);

    expect(selectPublicOverview(withEnded, { query: "WWI23A", year: "2026" })).toMatchObject({ emptyReason: "not-in-year" });
    expect(selectPublicOverview(withEnded, { query: "WWI23A", year: "2026" }).endedPlan).toBeUndefined();
    expect(selectPublicOverview(withEnded, { query: "WWI23", year: "2026" }).endedPlan).toBeUndefined();
    expect(selectPublicOverview(withEnded, { query: "WWI23A", year: "all" }).endedPlan).toBe("/WWI23A");
  });

  it("leads an ended course to its plan while a parallel course of its year still runs", () => {
    const parallel = buildPublicOverview([course("WWI24B")], [], today, new Map([["wwi 2024", 2]]), [{ code: "WWI24A", year: 2024 }]);

    expect(selectPublicOverview(parallel, { query: "WWI24A", year: "all" })).toMatchObject({ emptyReason: "ended", endedPlan: "/WWI24A" });
  });

  it("prefers the abbreviation typed exactly over one that only reads the same once normalized", () => {
    const similar = buildPublicOverview([], [], today, new Map([["ab-c 2023", 1], ["abc 2023", 1]]));

    expect(selectPublicOverview(similar, { query: "ABC23", year: "all" }).endedPlan).toBe("/jahrgang/2023/studiengang/ABC");
    expect(selectPublicOverview(similar, { query: "AB-C23", year: "all" }).endedPlan).toBe("/jahrgang/2023/studiengang/AB-C");
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

  it("counts all years of a program a course code found, and does not take its narrowed copy for a namesake", () => {
    const [suggestion] = suggestPublicOverview(overview, "WWI25").programs;

    expect(suggestion).toEqual({ abbreviation: "WWI", name: "Wirtschaftsinformatik", label: "Wirtschaftsinformatik", detail: "2 Jahrgänge" });
  });

  it("puts the abbreviation into the field where the name would find another program", () => {
    const clash = buildPublicOverview([
      course("TIF26A", { id: "WBA26X", code: "WBA26X", programAbbreviation: "WBA", program: "BWL" }),
      course("TIF26A", { id: "BWL26X", code: "BWL26X", programAbbreviation: "BWL", program: "Betriebswirtschaft" }),
    ], [], today);

    expect(suggestPublicOverview(clash, "WBA").programs).toEqual([{ abbreviation: "WBA", name: "BWL", label: "WBA", detail: "WBA · 1 Jahrgang" }]);
    expect(suggestPublicOverview(clash, "Betriebs").programs[0].label).toBe("Betriebswirtschaft");
  });

  it("suggests nothing for an empty field", () => {
    expect(suggestPublicOverview(overview, "  ")).toEqual({ programs: [], courses: [] });
  });
});

describe("highlightPieces", () => {
  const marks = (text: string, query: string) => highlightPieces(text, query).filter((piece) => piece.marked).map((piece) => piece.text);

  it("marks each word of the query wherever it stands, accents and plan words aside", () => {
    expect(marks("BWL – Personalmanagement", "personal bwl")).toEqual(["BWL", "Personal"]);
    expect(marks("Data Science und Künstliche Intelligenz", "kunstl")).toEqual(["Künstl"]);
    expect(marks("BWL – Personalmanagement", "Semesterplan")).toEqual([]);
  });

  it("keeps the marks in place after a letter of two units, like an emoji", () => {
    expect(marks("🌱 Umwelttechnik", "umwelt")).toEqual(["Umwelt"]);
  });

  it("marks a name that arrives decomposed as it would composed", () => {
    expect(marks("Ku\u0308nstliche Intelligenz", "kunst")).toEqual(["Künst"]);
  });

  it("keeps the whole text in its pieces, each with where it starts", () => {
    expect(highlightPieces("BWL – Personal", "pers")).toEqual([
      { text: "BWL – ", marked: false, start: 0 }, { text: "Pers", marked: true, start: 6 }, { text: "onal", marked: false, start: 10 },
    ]);
  });
});
