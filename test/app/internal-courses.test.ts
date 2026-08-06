import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { coursePlanData, courseListData, findInternalCourse, overviewPrograms, programOptions, type CourseListFilters } from "@/app/intern/kurse/data";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

const editor = { id: "editor", role: "AREA_EDITOR" as const, systemAdmin: false };
const admin = { id: "admin", role: "NONE" as const, systemAdmin: true };
const noFilters: CourseListFilters = { program: null, year: null, code: null, responsibility: "all" };

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
    INSERT INTO users VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO users VALUES ('admin', 'Admin', 'admin@test', 0, NULL, 'NONE', 1, 'ACTIVE', 0, 0);
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

  /* The list has no column of its own for the area: it names it below the study program, so a row has to carry both. */
  it("carries the study program and its area with every row", () => {
    const sqlite = database();
    const { courses } = courseListData(sqlite, editor, noFilters, "code");
    expect(courses.map((course) => [course.program, course.areaName]))
      .toEqual([["Informatik", "Technik"], ["Wirtschaftsinformatik", "Wirtschaft"]]);
  });

  it("keeps system administration writing in every area", () => {
    const sqlite = database();
    const { courses } = courseListData(sqlite, admin, noFilters, "code");
    expect(courses.every((course) => course.editable)).toBe(true);
  });

  it("offers the study programs and years of foreign courses as filter values", () => {
    const sqlite = database();
    const { programs, years } = courseListData(sqlite, editor, noFilters, "code");
    expect(programs.map((program) => program.id)).toEqual(["prog-tif", "prog-wwi"]);
    expect(years.map((entry) => entry.year)).toEqual(["2027", "2026"]);
  });

  it("filters foreign courses by study program, year and course code alike", () => {
    const sqlite = database();
    const codes = (filters: Partial<CourseListFilters>) => courseListData(sqlite, editor, { ...noFilters, ...filters }, "code").courses.map((course) => course.code);
    expect(codes({ program: "prog-wwi" })).toEqual(["WWI27A"]);
    expect(codes({ year: "2027" })).toEqual(["WWI27A"]);
    expect(codes({ code: "wwi" })).toEqual(["WWI27A"]);
  });

  it("sorts directly by the visible table values in both directions", () => {
    const sqlite = database();
    publish(sqlite, "course-wwi", "2026-06-01T00:00:00.000Z");
    const codes = (sort: Parameters<typeof courseListData>[3], direction: Parameters<typeof courseListData>[4]) =>
      courseListData(sqlite, editor, noFilters, sort, direction).courses.map((course) => course.code);
    expect(codes("studyPeriod", "desc")).toEqual(["WWI27A", "TIF26A"]);
    expect(codes("publication", "asc")).toEqual(["TIF26A", "WWI27A"]);
  });

  /* The list opens on the courses this account is responsible for, and the wider view is asked for explicitly. The
     narrowing follows the same marking the rows carry, so it cannot disagree with them (ADR 0011). */
  it("stands on the own areas unless every area is asked for", () => {
    const sqlite = database();
    const codes = (responsibility: CourseListFilters["responsibility"]) =>
      courseListData(sqlite, editor, { ...noFilters, responsibility }, "code").courses.map((course) => course.code);
    expect(codes("own")).toEqual(["TIF26A"]);
    expect(codes("all")).toEqual(["TIF26A", "WWI27A"]);
    // System administration writes everywhere, so its own areas are all of them.
    expect(courseListData(sqlite, admin, { ...noFilters, responsibility: "own" }, "code").courses.map((course) => course.code))
      .toEqual(["TIF26A", "WWI27A"]);
  });

  /* The number the list shows itself against is the whole of the chosen responsibility, never of the database: a
     narrowing filter shortens the list and leaves that whole standing, while widening the responsibility raises it. */
  it("counts the courses of the chosen responsibility beside the filtered ones", () => {
    const sqlite = database();
    const counted = (filters: Partial<CourseListFilters>) => {
      const { courses, totalInScope } = courseListData(sqlite, editor, { ...noFilters, ...filters }, "code");
      return [courses.length, totalInScope];
    };
    expect(counted({ responsibility: "own" })).toEqual([1, 1]);
    expect(counted({ responsibility: "all" })).toEqual([2, 2]);
    expect(counted({ program: "prog-wwi" })).toEqual([1, 2]);
    // A filter that matches nothing still names the whole it found nothing in.
    expect(counted({ code: "xyz" })).toEqual([0, 2]);
  });

  it("marks a course with its publication state, which is its whole state", () => {
    const sqlite = database();
    publish(sqlite, "course-wwi", "2026-06-01T00:00:00.000Z");
    const states = () => Object.fromEntries(courseListData(sqlite, editor, noFilters, "code").courses.map((course) => [course.code, course.state]));
    expect(states()).toEqual({ TIF26A: "UNPUBLISHED", WWI27A: "PUBLISHED" });
    // A published course stays published while its current data is corrected: there is no second data stand (ADR 0012).
    sqlite.prepare("UPDATE courses SET updated_at = '2026-07-01T00:00:00.000Z' WHERE id = 'course-wwi'").run();
    expect(states()).toEqual({ TIF26A: "UNPUBLISHED", WWI27A: "PUBLISHED" });
  });
});

describe("findInternalCourse", () => {
  it("reads a course of a foreign area but does not report it as writable", () => {
    const sqlite = database();
    expect(findInternalCourse(sqlite, "course-wwi", editor)).toMatchObject({ code: "WWI27A", areaName: "Wirtschaft", editable: false, state: "UNPUBLISHED" });
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

  it("marks every course with its publication state", () => {
    const sqlite = database();
    addEarlierCourse(sqlite);
    publish(sqlite, "course-tif25", "2026-06-01T00:00:00.000Z");
    const [program] = overviewPrograms(sqlite, editor, today);
    expect(program.years.flatMap((year) => year.courses).map((course) => [course.code, course.state]))
      .toEqual([["TIF25A", "PUBLISHED"], ["TIF26A", "UNPUBLISHED"]]);
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

describe("coursePlanData", () => {
  /**
   * Around `course-tif`: a parallel course of its own study program, a second study program inside its own area, a
   * course of a foreign area and one of the following year. Only the second study program tells the area scope from
   * the study program scope — the base fixture has one study program per area, where both would agree.
   */
  function withParallelCourses(sqlite: Database.Database) {
    sqlite.prepare("UPDATE courses SET code = 'WWI26A', normalized_code = 'wwi26a', study_start = '2026-10-01', study_end = '2029-09-30' WHERE id = 'course-wwi'").run();
    sqlite.exec(`
      INSERT INTO programs VALUES ('prog-mb', 'area-technik', 'Maschinenbau', 'MB', 6);
      INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
        ('course-tif-b', 'prog-tif', 'TIF26B', 'tif26b', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
        ('course-mb', 'prog-mb', 'MB26A', 'mb26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
        ('course-tif-later', 'prog-tif', 'TIF27A', 'tif27a', '2027-10-01', '2030-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);
    return sqlite;
  }

  it("compares a course with the parallel courses of its own study program by default", () => {
    const sqlite = withParallelCourses(database());
    const plan = coursePlanData(sqlite, editor, "course-tif", "program");
    expect(plan?.course.code).toBe("TIF26A");
    expect(plan?.comparison.map((course) => course.code)).toEqual(["TIF26B"]);
  });

  it("widens to the other study programs of the area without leaving it", () => {
    const sqlite = withParallelCourses(database());
    const plan = coursePlanData(sqlite, editor, "course-tif", "area");
    expect(plan?.comparison.map((course) => course.code)).toEqual(["MB26A", "TIF26B"]);
  });

  it("widens to the year across areas and marks the foreign course as read only", () => {
    const sqlite = withParallelCourses(database());
    const plan = coursePlanData(sqlite, editor, "course-tif", "year");
    expect(plan?.comparison.map((course) => [course.code, course.editable])).toEqual([["MB26A", true], ["TIF26B", true], ["WWI26A", false]]);
  });

  /* The editor decides from `course.editable` whether it shows forms or the read-only notice, so the marking of the
     edited course matters as much as that of the courses it is compared with (ADR 0011). */
  it("reads a course of a foreign area but does not report it as writable", () => {
    const sqlite = withParallelCourses(database());
    const plan = coursePlanData(sqlite, editor, "course-wwi", "program");
    expect(plan?.course.code).toBe("WWI26A");
    expect(plan?.course.editable).toBe(false);
    expect(coursePlanData(sqlite, editor, "course-tif", "program")?.course.editable).toBe(true);
  });

  it("never leaves the year of the edited course, whatever the scope", () => {
    const sqlite = withParallelCourses(database());
    for (const scope of ["program", "area", "year"] as const) {
      expect(coursePlanData(sqlite, editor, "course-tif", scope)?.comparison.map((course) => course.code)).not.toContain("TIF27A");
    }
  });

  it("stands the course alone when no comparison is asked for", () => {
    const sqlite = withParallelCourses(database());
    const plan = coursePlanData(sqlite, editor, "course-tif", "none");
    expect(plan?.comparison).toEqual([]);
  });

  it("reads the plan of every shown course, so the matrix can draw all of its columns", () => {
    const sqlite = withParallelCourses(database());
    sqlite.exec(`INSERT INTO course_phases VALUES ('phase-a', 'course-tif', 1, 'THEORY', '2026-10-01', '2026-12-31'),
      ('phase-b', 'course-tif-b', 1, 'PRACTICE', '2026-10-01', '2026-12-31');`);
    const plan = coursePlanData(sqlite, editor, "course-tif", "program");
    expect(plan?.phases.map((phase) => [phase.code, phase.type])).toEqual([["TIF26A", "THEORY"], ["TIF26B", "PRACTICE"]]);
  });

  it("reports an unknown course rather than an empty plan", () => {
    expect(coursePlanData(database(), editor, "kurs-unbekannt", "program")).toBeNull();
  });
});
