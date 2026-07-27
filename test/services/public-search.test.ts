import { applySchema } from "@/test/schema";

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import {
  berlinCalendarDay,
  plansPerPage,
  readPublicFilterOptions,
  readPublicPlan,
  searchPublicPlans,
} from "@/lib/services/public-search";

const today = "2026-07-26";

function emptyDatabase() {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-1', 'Technik', 'technik');
    INSERT INTO areas VALUES ('area-2', 'Wirtschaft', 'wirtschaft');
    INSERT INTO programs VALUES ('program-1', 'area-1', 'Informatik', 'TIF', 6);
    INSERT INTO programs VALUES ('program-2', 'area-2', 'BWL', 'WWI', 6);
  `);
  return sqlite;
}

type CourseInput = { code: string; program?: string; studyStart: string; studyEnd?: string; semesters?: number };

/** Publishes a block plan directly through its snapshot tables — the only data the public views may read. */
function publish(
  sqlite: Database.Database,
  plan: { id: string; name: string; area?: string; areaId?: string; courses: CourseInput[] },
) {
  sqlite
    .prepare("INSERT INTO block_plans VALUES (?, ?, NULL, NULL, 1, '2026-01-01T00:00:00.000Z', NULL)")
    .run(plan.id, plan.areaId ?? "area-1");
  sqlite
    .prepare("INSERT INTO published_versions VALUES (?, ?, '2026-01-01T00:00:00.000Z', ?, ?)")
    .run(`version-${plan.id}`, plan.id, plan.name, plan.area ?? "Technik");
  for (const course of plan.courses) {
    const studyStartYear = Number(course.studyStart.slice(0, 4));
    sqlite
      .prepare("INSERT INTO published_course_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        `snapshot-${plan.id}-${course.code}`,
        `version-${plan.id}`,
        `course-${plan.id}-${course.code}`,
        course.code,
        course.program ?? "Informatik",
        "TIF",
        course.studyStart,
        course.studyEnd ?? `${studyStartYear + 3}-09-30`,
        course.semesters ?? 6,
      );
    sqlite
      .prepare("INSERT INTO published_course_search_keys VALUES (?, ?)")
      .run(`snapshot-${plan.id}-${course.code}`, course.code.toLocaleLowerCase("de-DE"));
  }
}

/** A draft-only block plan: it exists internally but has never been published. */
function draftOnlyPlan(sqlite: Database.Database, id: string) {
  sqlite.prepare("INSERT INTO block_plans VALUES (?, 'area-2', NULL, NULL, 0, '2026-01-01T00:00:00.000Z', NULL)").run(id);
  sqlite
    .prepare("INSERT INTO courses VALUES (?, 'program-2', ?, 'WWI99A', 'wwi99a', '2099-10-01', '2102-09-30')")
    .run(`course-${id}`, id);
}

describe("berlinCalendarDay", () => {
  it("uses the Berlin calendar day, not the UTC one", () => {
    expect(berlinCalendarDay(new Date("2026-07-25T23:30:00.000Z"))).toBe("2026-07-26");
    expect(berlinCalendarDay(new Date("2026-01-01T00:30:00.000Z"))).toBe("2026-01-01");
    expect(berlinCalendarDay(new Date("2025-12-31T23:30:00.000Z"))).toBe("2026-01-01");
  });
});

describe("readPublicFilterOptions", () => {
  it("offers only values that published versions actually carry", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "2024 · TIF24A", area: "Technik", courses: [{ code: "TIF24A", studyStart: "2024-10-01" }] });
    publish(sqlite, {
      id: "plan-2",
      name: "2026 · WWI26A",
      area: "Wirtschaft",
      areaId: "area-2",
      courses: [{ code: "WWI26A", program: "BWL", studyStart: "2026-10-01" }],
    });
    draftOnlyPlan(sqlite, "plan-3");

    expect(readPublicFilterOptions(sqlite)).toEqual({
      areas: ["Technik", "Wirtschaft"],
      programs: ["BWL", "Informatik"],
      years: [2026, 2024],
    });
  });

  it("keeps the published designation even after the master data was renamed", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "2024 · TIF24A", area: "Technik", courses: [{ code: "TIF24A", studyStart: "2024-10-01" }] });
    sqlite.exec("UPDATE areas SET name = 'Ingenieurwesen' WHERE id = 'area-1'; UPDATE programs SET name = 'Angewandte Informatik' WHERE id = 'program-1'");

    expect(readPublicFilterOptions(sqlite)).toMatchObject({ areas: ["Technik"], programs: ["Informatik"] });
  });

  it("offers nothing without a published version", () => {
    const sqlite = emptyDatabase();
    draftOnlyPlan(sqlite, "plan-1");

    expect(readPublicFilterOptions(sqlite)).toEqual({ areas: [], programs: [], years: [] });
  });
});

describe("searchPublicPlans grouping", () => {
  it("groups a plan as future when every course starts after the reference day", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "Zukunft", courses: [{ code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2029-09-30" }] });

    expect(groupOf(sqlite, "plan-1")).toBe("future");
  });

  it("groups a plan as past when every course has ended", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "Vergangen", courses: [{ code: "TIF22A", studyStart: "2022-10-01", studyEnd: "2025-09-30" }] });

    expect(groupOf(sqlite, "plan-1")).toBe("past");
  });

  it("groups a plan as current in every other case", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "Laufend", courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    publish(sqlite, {
      id: "plan-2",
      name: "Gemischt",
      courses: [
        { code: "TIF23A", studyStart: "2023-10-01", studyEnd: "2026-09-30" },
        { code: "TIF26B", studyStart: "2026-10-01", studyEnd: "2029-09-30" },
      ],
    });

    expect(groupOf(sqlite, "plan-1")).toBe("current");
    expect(groupOf(sqlite, "plan-2")).toBe("current");
  });

  it("counts the reference day itself as running", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "Beginnt heute", courses: [{ code: "TIF26A", studyStart: today, studyEnd: "2029-09-30" }] });
    publish(sqlite, { id: "plan-2", name: "Endet heute", courses: [{ code: "TIF23A", studyStart: "2023-10-01", studyEnd: today }] });

    expect(groupOf(sqlite, "plan-1")).toBe("current");
    expect(groupOf(sqlite, "plan-2")).toBe("current");
  });

  it("returns the groups in the order running, future, past", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "Vergangen", courses: [{ code: "TIF22A", studyStart: "2022-10-01", studyEnd: "2025-09-30" }] });
    publish(sqlite, { id: "plan-2", name: "Zukunft", courses: [{ code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2029-09-30" }] });
    publish(sqlite, { id: "plan-3", name: "Laufend", courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });

    const result = searchPublicPlans(sqlite, {}, today);

    expect(result.groups.map((group) => group.key)).toEqual(["current", "future", "past"]);
    expect(result.groups.map((group) => group.plans.map((plan) => plan.id))).toEqual([["plan-3"], ["plan-2"], ["plan-1"]]);
  });
});

/** The group a single published plan lands in for the fixed reference day. */
function groupOf(sqlite: Database.Database, blockPlanId: string) {
  return searchPublicPlans(sqlite, {}, today).groups.find((group) => group.plans.some((plan) => plan.id === blockPlanId))?.key;
}

describe("searchPublicPlans sorting", () => {
  it("sorts running plans by descending year and future plans by ascending year", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "current-old", name: "A", courses: [{ code: "TIF23A", studyStart: "2023-10-01", studyEnd: "2026-09-30" }] });
    publish(sqlite, { id: "current-new", name: "B", courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    publish(sqlite, { id: "future-late", name: "C", courses: [{ code: "TIF27A", studyStart: "2027-10-01", studyEnd: "2030-09-30" }] });
    publish(sqlite, { id: "future-early", name: "D", courses: [{ code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2029-09-30" }] });

    const result = searchPublicPlans(sqlite, {}, today);

    expect(planIds(result, "current")).toEqual(["current-new", "current-old"]);
    expect(planIds(result, "future")).toEqual(["future-early", "future-late"]);
  });

  it("sorts past plans by descending year", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "past-old", name: "A", courses: [{ code: "TIF20A", studyStart: "2020-10-01", studyEnd: "2023-09-30" }] });
    publish(sqlite, { id: "past-new", name: "B", courses: [{ code: "TIF22A", studyStart: "2022-10-01", studyEnd: "2025-09-30" }] });

    expect(planIds(searchPublicPlans(sqlite, {}, today), "past")).toEqual(["past-new", "past-old"]);
  });

  it("breaks an equal year by display name and an equal name by block plan id", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-b", name: "Ökonomie", courses: [{ code: "TIF24C", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    publish(sqlite, { id: "plan-c", name: "Automatisierung", courses: [{ code: "TIF24D", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    publish(sqlite, { id: "plan-a", name: "Ökonomie", courses: [{ code: "TIF24E", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });

    expect(planIds(searchPublicPlans(sqlite, {}, today), "current")).toEqual(["plan-c", "plan-a", "plan-b"]);
  });
});

function planIds(result: ReturnType<typeof searchPublicPlans>, key: string) {
  return result.groups.find((group) => group.key === key)?.plans.map((plan) => plan.id) ?? [];
}

describe("searchPublicPlans filters", () => {
  function databaseWithMixedPlans() {
    const sqlite = emptyDatabase();
    publish(sqlite, {
      id: "plan-technik",
      name: "Technik 2024",
      area: "Technik",
      courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }],
    });
    publish(sqlite, {
      id: "plan-wirtschaft",
      name: "Wirtschaft 2024",
      area: "Wirtschaft",
      areaId: "area-2",
      courses: [{ code: "WWI24A", program: "BWL", studyStart: "2024-10-01", studyEnd: "2027-09-30" }],
    });
    publish(sqlite, {
      id: "plan-gemischt",
      name: "Gemischt 2026",
      area: "Technik",
      courses: [
        { code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2029-09-30" },
        { code: "WWI26B", program: "BWL", studyStart: "2026-10-01", studyEnd: "2029-09-30" },
      ],
    });
    return sqlite;
  }

  it("filters by the published area", () => {
    expect(allPlanIds(searchPublicPlans(databaseWithMixedPlans(), { area: "Wirtschaft" }, today))).toEqual(["plan-wirtschaft"]);
  });

  it("keeps a plan when at least one published course belongs to the program", () => {
    expect(allPlanIds(searchPublicPlans(databaseWithMixedPlans(), { program: "BWL" }, today))).toEqual([
      "plan-wirtschaft",
      "plan-gemischt",
    ]);
  });

  it("filters by the year the studies begin", () => {
    expect(allPlanIds(searchPublicPlans(databaseWithMixedPlans(), { year: "2026" }, today))).toEqual(["plan-gemischt"]);
  });

  it("matches the beginning of a course code regardless of case", () => {
    expect(allPlanIds(searchPublicPlans(databaseWithMixedPlans(), { course: "tif24" }, today))).toEqual(["plan-technik"]);
    expect(allPlanIds(searchPublicPlans(databaseWithMixedPlans(), { course: "TIF" }, today))).toEqual(["plan-technik", "plan-gemischt"]);
  });

  it("does not match a course code in the middle", () => {
    expect(allPlanIds(searchPublicPlans(databaseWithMixedPlans(), { course: "IF24" }, today))).toEqual([]);
  });

  it("combines several filters with AND", () => {
    const sqlite = databaseWithMixedPlans();

    expect(allPlanIds(searchPublicPlans(sqlite, { area: "Technik", program: "BWL" }, today))).toEqual(["plan-gemischt"]);
    expect(allPlanIds(searchPublicPlans(sqlite, { area: "Technik", program: "BWL", year: "2024" }, today))).toEqual([]);
  });

  it("keeps every published course of a matching plan", () => {
    const result = searchPublicPlans(databaseWithMixedPlans(), { program: "BWL" }, today);
    const mixedPlan = result.groups.flatMap((group) => group.plans).find((plan) => plan.id === "plan-gemischt");

    expect(mixedPlan?.courses.map((course) => course.code)).toEqual(["TIF26A", "WWI26B"]);
  });

  it("ignores blank filter values", () => {
    expect(allPlanIds(searchPublicPlans(databaseWithMixedPlans(), { area: "", course: "  " }, today))).toHaveLength(3);
  });

  it("reports the filters it applied, so view and links show the same state", () => {
    const result = searchPublicPlans(databaseWithMixedPlans(), { area: " Technik ", course: "", page: "1" }, today);

    expect(result.filters).toEqual({ area: "Technik" });
    expect(allPlanIds(result)).toEqual(["plan-technik", "plan-gemischt"]);
  });

  it("reports an unknown filter value as an empty result instead of dropping the filter", () => {
    const result = searchPublicPlans(databaseWithMixedPlans(), { area: "Gesundheit" }, today);

    expect(allPlanIds(result)).toEqual([]);
    expect(result.total).toBe(0);
  });
});

function allPlanIds(result: ReturnType<typeof searchPublicPlans>) {
  return result.groups.flatMap((group) => group.plans.map((plan) => plan.id));
}

describe("searchPublicPlans pagination", () => {
  function databaseWithManyPlans(count: number) {
    const sqlite = emptyDatabase();
    for (let index = 0; index < count; index += 1) {
      const code = `TIF24${String(index).padStart(3, "0")}`;
      publish(sqlite, {
        id: `plan-${String(index).padStart(3, "0")}`,
        name: `Plan ${String(index).padStart(3, "0")}`,
        courses: [{ code, studyStart: "2024-10-01", studyEnd: "2027-09-30" }],
      });
    }
    return sqlite;
  }

  it("shows at most one page of plans and counts all matches", () => {
    const result = searchPublicPlans(databaseWithManyPlans(60), {}, today);

    expect(allPlanIds(result)).toHaveLength(plansPerPage);
    expect(result).toMatchObject({ total: 60, page: 1, pages: 3 });
    expect(allPlanIds(result)[0]).toBe("plan-000");
  });

  it("continues the sorted order on the next page", () => {
    const sqlite = databaseWithManyPlans(60);

    expect(allPlanIds(searchPublicPlans(sqlite, { page: "2" }, today))[0]).toBe("plan-025");
    expect(allPlanIds(searchPublicPlans(sqlite, { page: "3" }, today))).toHaveLength(10);
  });

  it("clamps an out-of-range or unreadable page to an existing one", () => {
    const sqlite = databaseWithManyPlans(60);

    expect(searchPublicPlans(sqlite, { page: "9" }, today).page).toBe(3);
    expect(searchPublicPlans(sqlite, { page: "0" }, today).page).toBe(1);
    expect(searchPublicPlans(sqlite, { page: "zwei" }, today).page).toBe(1);
  });

  it("reports one page without any published version", () => {
    expect(searchPublicPlans(emptyDatabase(), {}, today)).toMatchObject({ total: 0, page: 1, pages: 1 });
  });

  it("keeps every group of a page in the order the groups have", () => {
    const sqlite = emptyDatabase();
    for (let index = 0; index < 30; index += 1) {
      publish(sqlite, {
        id: `future-${String(index).padStart(3, "0")}`,
        name: `Zukunft ${index}`,
        courses: [{ code: `TIF27${String(index).padStart(3, "0")}`, studyStart: "2027-10-01", studyEnd: "2030-09-30" }],
      });
    }
    publish(sqlite, { id: "current-1", name: "Laufend", courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });

    const result = searchPublicPlans(sqlite, {}, today);

    expect(result.groups.map((group) => group.plans.length)).toEqual([1, 24, 0]);
    expect(searchPublicPlans(sqlite, { page: "2" }, today).groups.map((group) => group.plans.length)).toEqual([0, 6, 0]);
  });
});

describe("readPublicPlan", () => {
  it("reads name, area, year and courses from the published snapshots", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, {
      id: "plan-1",
      name: "2024 · TIF24A, TIF24B",
      area: "Technik",
      courses: [
        { code: "TIF24B", studyStart: "2024-10-01", studyEnd: "2027-09-30" },
        { code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" },
      ],
    });
    sqlite.exec("UPDATE areas SET name = 'Ingenieurwesen' WHERE id = 'area-1'");

    const plan = readPublicPlan(sqlite, "plan-1");

    expect(plan).toMatchObject({ id: "plan-1", name: "2024 · TIF24A, TIF24B", area: "Technik", year: 2024 });
    expect(plan?.courses.map((course) => course.code)).toEqual(["TIF24A", "TIF24B"]);
  });

  it("reads course phases and events of the published version", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "2024 · TIF24A", courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    sqlite.exec(`
      INSERT INTO published_phases VALUES ('phase-1', 'version-plan-1', 'snapshot-plan-1-TIF24A', 1, 'THEORY', '2024-10-01', '2024-12-31');
      INSERT INTO published_events VALUES ('event-1', 'version-plan-1', 'Klausur', 'Am Campus', 'EXAM', '2024-11-04', NULL, 1);
      INSERT INTO published_event_courses VALUES ('event-1', 'snapshot-plan-1-TIF24A');
    `);

    const plan = readPublicPlan(sqlite, "plan-1");

    expect(plan?.phases).toEqual([
      { courseId: "snapshot-plan-1-TIF24A", semester: 1, type: "THEORY", startDate: "2024-10-01", endDate: "2024-12-31" },
    ]);
    expect(plan?.events).toEqual([
      {
        id: "event-1",
        title: "Klausur",
        description: "Am Campus",
        category: "EXAM",
        startDate: "2024-11-04",
        endDate: null,
        provisional: true,
        courseIds: ["snapshot-plan-1-TIF24A"],
      },
    ]);
  });

  it("reads nothing for an unknown block plan id", () => {
    expect(readPublicPlan(emptyDatabase(), "unbekannt")).toBeNull();
  });

  it("reads nothing for a block plan that was never published", () => {
    const sqlite = emptyDatabase();
    draftOnlyPlan(sqlite, "plan-1");

    expect(readPublicPlan(sqlite, "plan-1")).toBeNull();
  });

  it("reads nothing for a withdrawn block plan", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "2024 · TIF24A", courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    sqlite.exec("DELETE FROM published_versions WHERE block_plan_id = 'plan-1'");

    expect(readPublicPlan(sqlite, "plan-1")).toBeNull();
  });

  it("hides a withdrawn block plan from the search as well", () => {
    const sqlite = emptyDatabase();
    publish(sqlite, { id: "plan-1", name: "2024 · TIF24A", courses: [{ code: "TIF24A", studyStart: "2024-10-01", studyEnd: "2027-09-30" }] });
    sqlite.exec("DELETE FROM published_versions WHERE block_plan_id = 'plan-1'");

    expect(searchPublicPlans(sqlite, {}, today).total).toBe(0);
    expect(readPublicFilterOptions(sqlite)).toEqual({ areas: [], programs: [], years: [] });
  });
});
