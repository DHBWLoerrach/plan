import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { courseCutData, courseListData, findInternalCourse, programOptions, type CourseListFilters } from "@/app/intern/kurse/data";
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
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, has_ever_been_published, draft_updated_at, draft_updated_by_account_id) VALUES
      ('course-tif', 'prog-tif', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', 0, '2026-01-01T00:00:00.000Z', 'editor'),
      ('course-wwi', 'prog-wwi', 'WWI27A', 'wwi27a', '2027-10-01', '2030-09-30', 0, '2026-01-01T00:00:00.000Z', 'editor');`);
  return sqlite;
}

/** Gives the course a published version, as publication would, without running the whole publication service. */
function publish(sqlite: Database.Database, courseId: string, publishedAt: string) {
  sqlite.prepare(`INSERT INTO published_courses (id, course_id, published_at, area_name, program_name, program_abbreviation, code, study_start, study_end, semesters)
    SELECT 'published-' || course.id, course.id, ?, area.name, program.name, program.abbreviation, course.code, course.study_start, course.study_end, program.semesters
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id WHERE course.id = ?`).run(publishedAt, courseId);
  sqlite.prepare("UPDATE courses SET has_ever_been_published = 1 WHERE id = ?").run(courseId);
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
    const codes = (state: "NEVER_PUBLISHED" | "PUBLISHED" | "WITHDRAWN") => courseListData(sqlite, editor, { ...noFilters, state }, "code").courses.map((course) => course.code);
    expect(codes("PUBLISHED")).toEqual(["WWI27A"]);
    expect(codes("NEVER_PUBLISHED")).toEqual(["TIF26A"]);
    expect(codes("WITHDRAWN")).toEqual([]);
  });

  it("marks a foreign course as in progress while its planning state differs from its published version", () => {
    const sqlite = database();
    publish(sqlite, "course-wwi", "2026-06-01T00:00:00.000Z");
    const inProgress = () => Object.fromEntries(courseListData(sqlite, editor, noFilters, "code").courses.map((course) => [course.code, course.workInProgress]));
    expect(inProgress()).toEqual({ TIF26A: true, WWI27A: false });
    sqlite.prepare("UPDATE courses SET draft_updated_at = '2026-07-01T00:00:00.000Z' WHERE id = 'course-wwi'").run();
    expect(inProgress()).toEqual({ TIF26A: true, WWI27A: true });
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

describe("courseCutData", () => {
  it("puts a foreign course beside an own one and marks it as read only", () => {
    const sqlite = database();
    sqlite.prepare("UPDATE courses SET study_start = '2026-10-01', study_end = '2029-09-30' WHERE id = 'course-wwi'").run();
    const cut = courseCutData(sqlite, editor, { year: "2026", courseIds: ["course-tif", "course-wwi"] });
    expect(cut?.courses.map((course) => [course.code, course.editable])).toEqual([["TIF26A", true], ["WWI27A", false]]);
  });
});
