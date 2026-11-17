import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { programOptions } from "@/app/intern/kurse/data";
import { createCourse } from "@/lib/services/course-admin";
import { adoptionTemplateChoices, readAdoptionTemplate } from "@/lib/services/course-adoption";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

/**
 * A template course in Wirtschaft with one study year of phases and events, and an editor assigned to Technik alone:
 * the adoption worth having is exactly the one across areas (ADR 0011).
 */
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-technik', 'Technik', 'technik'), ('area-wirtschaft', 'Wirtschaft', 'wirtschaft');
    INSERT INTO programs VALUES ('prog-tif', 'area-technik', 'Informatik', 'TIF', 6),
      ('prog-tif7', 'area-technik', 'Informatik sieben', 'TIF7', 7),
      ('prog-wwi', 'area-wirtschaft', 'Wirtschaftsinformatik', 'WWI', 6);
    INSERT INTO users VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area-technik');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
      VALUES ('template', 'prog-wwi', 'WWI25A', 'wwi25a', '2025-10-01', '2026-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');
    INSERT INTO course_phases (id, course_id, semester, phase_type, start_date, end_date) VALUES
      ('phase-1', 'template', 1, 'THEORY', '2025-10-01', '2025-12-31'),
      ('phase-2', 'template', 2, 'PRACTICE', '2026-01-01', '2026-09-30');
    INSERT INTO course_events (id, course_id, title, description, category, start_date, end_date, provisional) VALUES
      ('event-1', 'template', 'Klausur', NULL, 'EXAM', '2026-03-15', NULL, 0);`);
  return sqlite;
}

const newCourse = { accountId: "editor", code: "TIF26A", programId: "prog-tif", studyStart: "2026-10-01", studyEnd: "2027-09-30" };
const adoptAll = { templateCourseId: "template", withPhases: true, withEvents: true };

function phasesOf(sqlite: Database.Database, courseId: string) {
  return sqlite.prepare("SELECT semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM course_phases WHERE course_id = ? ORDER BY start_date").all(courseId);
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createCourse with an adoption", () => {
  it("copies the course progression of a template of another area, shifted by whole weeks and kept on the borders of the study period", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { ...newCourse, adoption: adoptAll });
    expect(phasesOf(sqlite, id)).toEqual([
      { semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-30" },
      { semester: 2, type: "PRACTICE", startDate: "2026-12-31", endDate: "2027-09-30" },
    ]);
  });

  it("copies events shifted but never cut", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { ...newCourse, studyEnd: "2027-01-31", adoption: adoptAll });
    expect(sqlite.prepare("SELECT title, category, start_date AS startDate, end_date AS endDate, provisional FROM course_events WHERE course_id = ?").all(id))
      .toEqual([{ title: "Klausur", category: "EXAM", startDate: "2027-03-14", endDate: null, provisional: 0 }]);
  });

  it("adopts course progression and events separately", () => {
    const sqlite = database();
    const withoutEvents = createCourse(sqlite, { ...newCourse, adoption: { ...adoptAll, withEvents: false } });
    expect(phasesOf(sqlite, withoutEvents)).toHaveLength(2);
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_events WHERE course_id = ?").get(withoutEvents)).toEqual({ count: 0 });
    const withoutPhases = createCourse(sqlite, { ...newCourse, code: "TIF26B", adoption: { ...adoptAll, withPhases: false } });
    expect(phasesOf(sqlite, withoutPhases)).toHaveLength(0);
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_events WHERE course_id = ?").get(withoutPhases)).toEqual({ count: 1 });
  });

  it("creates a course that is entirely its own: later changes to the template do not reach it", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { ...newCourse, adoption: adoptAll });
    sqlite.prepare("UPDATE course_phases SET end_date = '2025-11-30' WHERE id = 'phase-1'").run();
    sqlite.prepare("DELETE FROM course_events WHERE id = 'event-1'").run();
    expect(phasesOf(sqlite, id)[0]).toMatchObject({ endDate: "2026-12-30" });
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_events WHERE course_id = ?").get(id)).toEqual({ count: 1 });
  });

  it("refuses a template whose study program has a different number of semesters", () => {
    const sqlite = database();
    expect(() => createCourse(sqlite, { ...newCourse, programId: "prog-tif7", adoption: adoptAll })).toThrow("Semester");
    expect(sqlite.prepare("SELECT count(*) AS count FROM courses").get()).toEqual({ count: 1 });
  });

  it("refuses a template that does not exist and leaves nothing behind", () => {
    const sqlite = database();
    expect(() => createCourse(sqlite, { ...newCourse, adoption: { ...adoptAll, templateCourseId: "unbekannt" } })).toThrow("Vorlage");
    expect(sqlite.prepare("SELECT count(*) AS count FROM courses").get()).toEqual({ count: 1 });
  });

  it("decides the permission on the area of the new course, not on the area of the template", () => {
    const sqlite = database();
    // The editor may write in Technik and reads the template of Wirtschaft — that adoption passes.
    expect(() => createCourse(sqlite, { ...newCourse, adoption: adoptAll })).not.toThrow();
    // Creating in Wirtschaft is refused even though the template lives there.
    expect(() => createCourse(sqlite, { ...newCourse, code: "WWI26A", programId: "prog-wwi", adoption: adoptAll })).toThrow("nicht zur Bearbeitung dieses Bereichs berechtigt");
  });

  it("writes creation and adoption in one transaction: a rejected course leaves no phases behind", () => {
    const sqlite = database();
    expect(() => createCourse(sqlite, { ...newCourse, code: "WWI25A", adoption: adoptAll })).toThrow("Kurskennung ist bereits vergeben");
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 2 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM courses").get()).toEqual({ count: 1 });
  });
});

describe("readAdoptionTemplate", () => {
  it("reads a template of any area with its course progression and its events", () => {
    const sqlite = database();
    const found = readAdoptionTemplate(sqlite, "template");
    expect(found).toMatchObject({ code: "WWI25A", areaName: "Wirtschaft", semesters: 6, studyStart: "2025-10-01", studyEnd: "2026-09-30" });
    expect(found?.phases).toHaveLength(2);
    expect(found?.events).toEqual([{ title: "Klausur", description: null, category: "EXAM", startDate: "2026-03-15", endDate: null, provisional: false }]);
  });

  it("reports an unknown template rather than an empty one", () => {
    expect(readAdoptionTemplate(database(), "unbekannt")).toBeUndefined();
  });
});

describe("adoptionTemplateChoices", () => {
  const editor = { id: "editor", systemAdmin: false };

  /**
   * A course over seven semesters, and an editor whose only study program has six: the one constellation in which a
   * template exists that this account can never adopt from.
   */
  function withSevenSemesterCourse(sqlite: Database.Database) {
    sqlite.exec(`
      INSERT INTO users VALUES ('editor-w', 'Editor Wirtschaft', 'editor-w@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
      INSERT INTO area_assignments VALUES ('editor-w', 'area-wirtschaft');
      INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
        VALUES ('seven', 'prog-tif7', 'TIF7-25A', 'tif7-25a', '2025-10-01', '2029-03-31', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);
  }

  it("offers courses of every area, named by what decides the choice", () => {
    const sqlite = database();
    createCourse(sqlite, newCourse);
    expect(adoptionTemplateChoices(sqlite, editor)).toEqual([
      { id: expect.any(String), label: "TIF26A — TIF, Jahrgang 2026, 6 Semester (Technik)" },
      { id: "template", label: "WWI25A — WWI, Jahrgang 2025, 6 Semester (Wirtschaft)" },
    ]);
  });

  /* Being assigned an area is not the same as having a study program in it. The choice page reads both counts, and it
     relies on this: without a study program to write into, no template can be offered either. */
  it("offers nothing to an account whose areas carry no study program", () => {
    const sqlite = database();
    sqlite.exec(`
      INSERT INTO areas VALUES ('area-leer', 'Leerer Bereich', 'leerer bereich');
      INSERT INTO users VALUES ('editor-leer', 'Editor Leer', 'editor-leer@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
      INSERT INTO area_assignments VALUES ('editor-leer', 'area-leer');`);
    const account = { id: "editor-leer", systemAdmin: false };
    expect(programOptions(sqlite, account)).toEqual([]);
    expect(adoptionTemplateChoices(sqlite, account)).toEqual([]);
  });

  it("leaves out a template no study program of the account could match", () => {
    const sqlite = database();
    withSevenSemesterCourse(sqlite);
    expect(adoptionTemplateChoices(sqlite, { id: "editor-w", systemAdmin: false }).map((choice) => choice.id)).toEqual(["template"]);
  });

  it("offers a template matching any one of the study programs of the account, not only the first", () => {
    const sqlite = database();
    withSevenSemesterCourse(sqlite);
    expect(adoptionTemplateChoices(sqlite, editor).map((choice) => choice.id)).toEqual(["seven", "template"]);
  });

  it("offers every course to the system administration, whose study programs are all of them", () => {
    const sqlite = database();
    withSevenSemesterCourse(sqlite);
    expect(adoptionTemplateChoices(sqlite, { id: "admin", systemAdmin: true }).map((choice) => choice.id)).toEqual(["seven", "template"]);
  });

  /**
   * The two sides of the choice are read by two queries that repeat the same permission rule. What holds them together
   * is not that repetition but this: every offered template must leave a study program to adopt it into. Should one
   * query ever narrow without the other, the choice would lead back into the refusal it was meant to prevent.
   */
  it.each([
    ["an editor of six-semester study programs", { id: "editor", systemAdmin: false }],
    ["an editor of another area", { id: "editor-w", systemAdmin: false }],
    ["the system administration", { id: "admin", systemAdmin: true }],
  ])("leaves every template it offers %s a study program to adopt it into", (_name, account) => {
    const sqlite = database();
    withSevenSemesterCourse(sqlite);
    const offered = adoptionTemplateChoices(sqlite, account);
    expect(offered.length).toBeGreaterThan(0);
    for (const choice of offered) {
      const template = readAdoptionTemplate(sqlite, choice.id);
      if (!template) throw new Error(`offered template ${choice.label} cannot be read`);
      expect(programOptions(sqlite, account, template.semesters).length,
        `template ${choice.label} is offered but no study program has ${template.semesters} semesters`).toBeGreaterThan(0);
    }
  });
});
