import { describe, expect, it } from "vitest";

import { areaCut, programCut, yearCut } from "@/lib/domain/public-cut";
import {
  plansPerPage,
  readPublicCut,
  readPublicFilterOptions,
  searchPublicPlans,
} from "@/lib/services/public-search";
import { databaseWithMasterData, unpublishedCourse, publish, courseIdForCode, withdraw } from "@/test/published-plans";

const today = "2026-07-26";

function courses(result: ReturnType<typeof searchPublicPlans>) {
  return result.groups.flatMap((group) => group.courses);
}

function courseCodes(result: ReturnType<typeof searchPublicPlans>) {
  return courses(result).map((course) => course.code);
}

describe("readPublicFilterOptions", () => {
  it("forms every option from the current master data of published courses", () => {
    const sqlite = databaseWithMasterData();
    publish(sqlite, { id: "tech", courses: [{ code: "TIF24A", studyStart: "2024-10-01" }] });
    publish(sqlite, { id: "business", area: "Wirtschaft", areaId: "area-2", courses: [{ code: "WWI26A", program: "BWL", studyStart: "2026-10-01" }] });
    sqlite.exec("UPDATE areas SET name = 'Ingenieurwesen' WHERE id = 'area-1'; UPDATE programs SET name = 'Angewandte Informatik' WHERE id = 'program-1'");

    expect(readPublicFilterOptions(sqlite)).toEqual({
      areas: ["Ingenieurwesen", "Wirtschaft"],
      programs: [{ value: "TIF", label: "TIF — Angewandte Informatik" }, { value: "WWI", label: "WWI — BWL" }],
      years: [2026, 2024],
    });
  });

  it("omits unpublished courses", () => {
    const sqlite = databaseWithMasterData();
    unpublishedCourse(sqlite, "WWI99A");

    expect(readPublicFilterOptions(sqlite)).toEqual({ areas: [], programs: [], years: [] });
  });
});

describe("searchPublicPlans", () => {
  function databaseWithCourses() {
    const sqlite = databaseWithMasterData();
    publish(sqlite, { id: "tif24a", courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    publish(sqlite, { id: "tif24b", courses: [{ code: "TIF24B", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    publish(sqlite, { id: "wwi24a", area: "Wirtschaft", areaId: "area-2", courses: [{ code: "WWI24A", program: "BWL", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    publish(sqlite, { id: "tif26a", courses: [{ code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2029-09-30" }] });
    return sqlite;
  }

  it("returns published courses, grouped and sorted by their own study period", () => {
    const result = searchPublicPlans(databaseWithCourses(), {}, today);

    expect(result.groups.map((group) => group.key)).toEqual(["current", "future", "past"]);
    expect(result.groups[0].courses.map((course) => course.code)).toEqual(["TIF24A", "TIF24B", "WWI24A"]);
    expect(result.groups[1].courses.map((course) => course.code)).toEqual(["TIF26A"]);
    expect(result.total).toBe(4);
  });

  it("combines area, program, year and course-prefix filters on the same published course", () => {
    const sqlite = databaseWithCourses();

    expect(courseCodes(searchPublicPlans(sqlite, { area: "Technik", program: "tif", year: "2024", course: "tif24b" }, today))).toEqual(["TIF24B"]);
    expect(searchPublicPlans(sqlite, { program: "tif" }, today).filters.program).toBe("TIF");
    expect(courseCodes(searchPublicPlans(sqlite, { area: "Technik", program: "WWI" }, today))).toEqual([]);
    expect(courseCodes(searchPublicPlans(sqlite, { course: "IF24" }, today))).toEqual([]);
    expect(courseCodes(searchPublicPlans(sqlite, { course: "%" }, today))).toEqual([]);
  });

  it("keeps unknown filter values as an empty, shareable result", () => {
    const result = searchPublicPlans(databaseWithCourses(), { area: "Gesundheit", year: "2024x" }, today);

    expect(result).toMatchObject({ filters: { area: "Gesundheit", year: "2024x" }, total: 0, page: 1, pages: 1 });
  });

  it("paginates individual courses rather than their former block plans", () => {
    const sqlite = databaseWithMasterData();
    for (let index = 0; index < 27; index += 1) {
      publish(sqlite, { id: `course-${index}`, courses: [{ code: `TIF24${String(index).padStart(2, "0")}`, studyStart: "2024-10-01" }] });
    }

    expect(courseCodes(searchPublicPlans(sqlite, {}, today))).toHaveLength(plansPerPage);
    expect(searchPublicPlans(sqlite, { page: "2" }, today)).toMatchObject({ total: 27, page: 2, pages: 2 });
    expect(courseCodes(searchPublicPlans(sqlite, { page: "2" }, today))).toEqual(["TIF2425", "TIF2426"]);
  });
});

describe("readPublicCut", () => {
  function databaseWithCuts() {
    const sqlite = databaseWithMasterData();
    publish(sqlite, {
      id: "tif24a",
      courses: [{
        code: "TIF24A",
        studyStart: "2024-10-01",
        phases: [{ semester: 1, startDate: "2024-10-01", endDate: "2024-12-20" }],
      }],
      events: [{ title: "Klausur A", startDate: "2024-11-04" }],
    });
    publish(sqlite, {
      id: "tif24b",
      courses: [{
        code: "TIF24B",
        studyStart: "2024-10-01",
        phases: [{ semester: 1, type: "PRACTICE", startDate: "2025-01-01", endDate: "2025-03-31" }],
      }],
      events: [{ title: "Klausur B", startDate: "2025-02-04" }],
    });
    publish(sqlite, { id: "tif25a", courses: [{ code: "TIF25A", studyStart: "2025-10-01" }] });
    publish(sqlite, { id: "wwi24a", area: "Wirtschaft", areaId: "area-2", courses: [{ code: "WWI24A", program: "BWL", studyStart: "2024-10-01" }] });
    return sqlite;
  }

  it("reads one course by its current published code, including its current phases and events", () => {
    const cut = readPublicCut(databaseWithCuts(), { kind: "course", code: "tif24a" });

    expect(cut?.cut).toEqual({ kind: "course", code: "TIF24A" });
    expect(cut?.courses.map((course) => course.code)).toEqual(["TIF24A"]);
    expect(cut?.phases).toEqual([{ courseId: courseIdForCode("TIF24A"), semester: 1, type: "THEORY", startDate: "2024-10-01", endDate: "2024-12-20" }]);
    expect(cut?.events.map((event) => [event.title, event.courseIds])).toEqual([["Klausur A", [courseIdForCode("TIF24A")]]]);
  });

  it("forms year, area and program cuts only from matching published courses", () => {
    const sqlite = databaseWithCuts();

    expect(readPublicCut(sqlite, yearCut("2024")!)?.courses.map((course) => course.code)).toEqual(["TIF24A", "TIF24B", "WWI24A"]);
    expect(readPublicCut(sqlite, areaCut("2024", "Technik")!)?.courses.map((course) => course.code)).toEqual(["TIF24A", "TIF24B"]);
    const program = readPublicCut(sqlite, programCut("2024", "tif")!);
    expect(program?.courses.map((course) => course.code)).toEqual(["TIF24A", "TIF24B"]);
    expect(program?.cut).toEqual({ kind: "program", year: 2024, abbreviation: "TIF", name: "Informatik" });
  });

  it("keeps equally named programs separate through their unique abbreviations", () => {
    const sqlite = databaseWithCuts();
    sqlite.exec(`
      INSERT INTO programs VALUES ('program-3', 'area-2', 'Informatik', 'INF', 6);
      INSERT INTO courses
        (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
      VALUES
        ('course-inf24a', 'program-3', 'INF24A', 'inf24a', '2024-10-01', '2027-09-30',
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'seed');
    `);

    expect(readPublicCut(sqlite, programCut("2024", "TIF")!)?.courses.map((course) => course.code))
      .toEqual(["TIF24A", "TIF24B"]);
    expect(readPublicCut(sqlite, programCut("2024", "inf")!)?.courses.map((course) => course.code))
      .toEqual(["INF24A"]);
    expect(readPublicFilterOptions(sqlite).programs).toEqual([
      { value: "WWI", label: "WWI — BWL" },
      { value: "INF", label: "INF — Informatik" },
      { value: "TIF", label: "TIF — Informatik" },
    ]);
  });

  it("never widens a cut to another year", () => {
    const sqlite = databaseWithCuts();

    expect(readPublicCut(sqlite, areaCut("2025", "Technik")!)?.courses.map((course) => course.code)).toEqual(["TIF25A"]);
    expect(readPublicCut(sqlite, programCut("2025", "WWI")!)).toBeNull();
  });

  it("makes unknown, unpublished and withdrawn addresses indistinguishable", () => {
    const sqlite = databaseWithCuts();
    unpublishedCourse(sqlite, "TIF99A");
    withdraw(sqlite, "tif24a");

    expect(readPublicCut(sqlite, { kind: "course", code: "unbekannt" })).toBeNull();
    expect(readPublicCut(sqlite, { kind: "course", code: "TIF99A" })).toBeNull();
    expect(readPublicCut(sqlite, { kind: "course", code: "TIF24A" })).toBeNull();
    expect(readPublicCut(sqlite, areaCut("2024", "Kein Bereich")!)).toBeNull();
  });
});
