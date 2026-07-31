import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { courseCutData, courseListData, findInternalCourse, overviewPrograms, programOptions, type CourseListFilters } from "@/app/intern/kurse/data";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

const editor = { id: "editor", role: "AREA_EDITOR" as const, systemAdmin: false };
const admin = { id: "admin", role: "NONE" as const, systemAdmin: true };
const noFilters: CourseListFilters = { area: null, program: null, year: null, code: null, state: null };

/**
 * Two areas with one study program each. The editor is assigned to Technik only, so every read of `course-wwi` is a
 * read across area boundaries.
 */
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-technik', 'Technik', 'technik'), ('area-wirtschaft', 'Wirtschaft', 'wirtschaft');
    INSERT INTO programs VALUES ('prog-tif', 'area-technik', 'Informatik', 'TIF', 6), ('prog-wwi', 'area-wirtschaft', 'Wirtschaftsinformatik', 'WWI', 6);
    INSERT INTO user VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO user VALUES ('admin', 'Admin', 'admin@test', 0, NULL, 'NONE', 1, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area-technik');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
      ('course-tif', 'prog-tif', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
      ('course-wwi', 'prog-wwi', 'WWI27A', 'wwi27a', '2027-10-01', '2030-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);
  return sqlite;
}

/** Marks the current course data as published without running the whole publication service. */
function publish(sqlite: Database.Database, courseId: string, publishedAt: string) {
  sqlite.prepare("UPDATE courses SET published_at = ? WHERE id = ?").run(publishedAt, courseId);
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("courseListData", () => {
  it("lists the courses of every area and marks which of them the account may write to", () => {
    const sqlite = database();
    const { courses } = courseListData(sqlite, editor, noFilters, "code");
    expect(courses.map((course) => [course.code, course.editable])).toEqual([["TIF26A", true], ["WWI27A", false]]);
  });

  it("keeps system administration writing in every area", () => {
    const sqlite = database();
    const { courses } = courseListData(sqlite, admin, noFilters, "code");
    expect(courses.every((course) => course.editable)).toBe(true);
  });

  it("offers the areas, study programs and years of foreign courses as filter values", () => {
    const sqlite = database();
    const { areas, programs, years } = courseListData(sqlite, editor, noFilters, "code");
    expect(areas.map((area) => area.id)).toEqual(["area-technik", "area-wirtschaft"]);
    expect(programs.map((program) => program.id)).toEqual(["prog-tif", "prog-wwi"]);
    expect(years.map((entry) => entry.year)).toEqual(["2027", "2026"]);
  });

  it("filters foreign courses by area, study program, year and course code alike", () => {
    const sqlite = database();
    const codes = (filters: Partial<CourseListFilters>) => courseListData(sqlite, editor, { ...noFilters, ...filters }, "code").courses.map((course) => course.code);
    expect(codes({ area: "area-wirtschaft" })).toEqual(["WWI27A"]);
    expect(codes({ program: "prog-wwi" })).toEqual(["WWI27A"]);
    expect(codes({ year: "2027" })).toEqual(["WWI27A"]);
    expect(codes({ code: "wwi" })).toEqual(["WWI27A"]);
  });

  it("filters by publication state across areas", () => {
    const sqlite = database();
    publish(sqlite, "course-wwi", "2026-06-01T00:00:00.000Z");
    const codes = (state: "UNPUBLISHED" | "PUBLISHED") => courseListData(sqlite, editor, { ...noFilters, state }, "code").courses.map((course) => course.code);
    expect(codes("PUBLISHED")).toEqual(["WWI27A"]);
    expect(codes("UNPUBLISHED")).toEqual(["TIF26A"]);
  });

  it("keeps a published course settled while current data is corrected", () => {
    const sqlite = database();
    publish(sqlite, "course-wwi", "2026-06-01T00:00:00.000Z");
    const inProgress = () => Object.fromEntries(courseListData(sqlite, editor, noFilters, "code").courses.map((course) => [course.code, course.workInProgress]));
    expect(inProgress()).toEqual({ TIF26A: true, WWI27A: false });
    sqlite.prepare("UPDATE courses SET updated_at = '2026-07-01T00:00:00.000Z' WHERE id = 'course-wwi'").run();
    expect(inProgress()).toEqual({ TIF26A: true, WWI27A: false });
  });
});

describe("findInternalCourse", () => {
  it("reads a course of a foreign area but does not report it as writable", () => {
    const sqlite = database();
    expect(findInternalCourse(sqlite, "course-wwi", editor)).toMatchObject({ code: "WWI27A", areaName: "Wirtschaft", editable: false, workInProgress: true });
    expect(findInternalCourse(sqlite, "course-tif", editor)).toMatchObject({ code: "TIF26A", editable: true });
    expect(findInternalCourse(sqlite, "course-unbekannt", editor)).toBeUndefined();
  });
});

describe("programOptions", () => {
  it("offers only the study programs the account may write to, because it feeds the course forms", () => {
    const sqlite = database();
    expect(programOptions(sqlite, editor).map((program) => program.id)).toEqual(["prog-tif"]);
    expect(programOptions(sqlite, admin).map((program) => program.id)).toEqual(["prog-tif", "prog-wwi"]);
  });

  it("narrows to a number of semesters, so an adoption cannot be aimed at a study program it would be refused for", () => {
    const sqlite = database();
    sqlite.prepare("INSERT INTO programs VALUES ('prog-tif7', 'area-technik', 'Informatik sieben', 'TIF7', 7)").run();
    expect(programOptions(sqlite, admin, 7).map((program) => program.id)).toEqual(["prog-tif7"]);
    expect(programOptions(sqlite, admin, 6).map((program) => program.id)).toEqual(["prog-tif", "prog-wwi"]);
  });
});

describe("overviewPrograms", () => {
  /** A day inside the first semester of the seeded 2026 course. */
  const today = "2026-11-15";

  /** A second course in the study program of the editor, in a year before the seeded one. */
  function addEarlierCourse(sqlite: Database.Database) {
    sqlite.prepare(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
      VALUES ('course-tif25', 'prog-tif', 'TIF25A', 'tif25a', '2025-10-01', '2028-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor')`).run();
  }

  it("keeps the overview inside the own areas, unlike the course list", () => {
    const sqlite = database();
    expect(overviewPrograms(sqlite, editor, today).map((program) => program.id)).toEqual(["prog-tif"]);
    expect(overviewPrograms(sqlite, admin, today).map((program) => program.id)).toEqual(["prog-tif", "prog-wwi"]);
  });

  it("groups the courses of a study program by year, ascending", () => {
    const sqlite = database();
    addEarlierCourse(sqlite);
    sqlite.prepare(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
      VALUES ('course-tif26b', 'prog-tif', 'TIF26B', 'tif26b', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor')`).run();
    const [program] = overviewPrograms(sqlite, editor, today);
    expect(program.years.map((year) => [year.year, year.courses.map((course) => course.code)]))
      .toEqual([["2025", ["TIF25A"]], ["2026", ["TIF26A", "TIF26B"]]]);
  });

  it("orders the study programs by area and names both, since the same name may occur in two areas", () => {
    const sqlite = database();
    sqlite.prepare("INSERT INTO programs VALUES ('prog-wti', 'area-wirtschaft', 'Informatik', 'WTI', 6)").run();
    sqlite.prepare(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
      VALUES ('course-wti', 'prog-wti', 'WTI26A', 'wti26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'admin')`).run();
    expect(overviewPrograms(sqlite, admin, today).map((program) => [program.id, program.abbreviation, program.name, program.areaName]))
      .toEqual([["prog-tif", "TIF", "Informatik", "Technik"], ["prog-wti", "WTI", "Informatik", "Wirtschaft"], ["prog-wwi", "WWI", "Wirtschaftsinformatik", "Wirtschaft"]]);
  });

  it("marks every course with its publication state and whether it is in progress", () => {
    const sqlite = database();
    addEarlierCourse(sqlite);
    publish(sqlite, "course-tif25", "2026-06-01T00:00:00.000Z");
    const [program] = overviewPrograms(sqlite, editor, today);
    expect(program.years.flatMap((year) => year.courses).map((course) => [course.code, course.state, course.workInProgress]))
      .toEqual([["TIF25A", "PUBLISHED", false], ["TIF26A", "UNPUBLISHED", true]]);
  });

  it("reads the standing of every course from its own phases, not from those of the course beside it", () => {
    const sqlite = database();
    addEarlierCourse(sqlite);
    sqlite.prepare(`INSERT INTO course_phases (id, course_id, semester, phase_type, start_date, end_date) VALUES
      ('phase-tif26-1', 'course-tif', 1, 'THEORY', '2026-10-01', '2027-03-31'),
      ('phase-tif26-2', 'course-tif', 2, 'PRACTICE', '2027-04-01', '2027-09-30'),
      ('phase-tif25-3', 'course-tif25', 3, 'PRACTICE', '2026-10-01', '2027-03-31')`).run();
    const [program] = overviewPrograms(sqlite, editor, today);
    expect(program.years.flatMap((year) => year.courses).map((course) => [course.code, course.currentPhase, course.nextPhase])).toEqual([
      ["TIF25A", "Praxis im 3. Semester", null],
      ["TIF26A", "Theorie im 1. Semester", "ab 01.04.2027 Praxis im 2. Semester"],
    ]);
  });

  it("stays empty for an account without an assigned area", () => {
    const sqlite = database();
    sqlite.prepare("DELETE FROM area_assignments WHERE user_id = 'editor'").run();
    expect(overviewPrograms(sqlite, editor, today)).toEqual([]);
  });
});

describe("courseCutData", () => {
  it("puts a foreign course beside an own one and marks it as read only", () => {
    const sqlite = database();
    sqlite.prepare("UPDATE courses SET study_start = '2026-10-01', study_end = '2029-09-30' WHERE id = 'course-wwi'").run();
    const cut = courseCutData(sqlite, editor, { year: "2026", courseIds: ["course-tif", "course-wwi"] });
    expect(cut?.courses.map((course) => [course.code, course.editable])).toEqual([["TIF26A", true], ["WWI27A", false]]);
  });
});
