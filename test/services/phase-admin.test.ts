import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { FieldError } from "@/lib/domain/field-error";
import { createCoursePhases, deleteCoursePhase, moveCoursePhaseChange, updateCoursePhase } from "@/lib/services/phase-admin";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

/** One study program of six semesters and one course studying from 2026-10-01 to 2029-09-30. */
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area', 'Technik', 'technik');
    INSERT INTO programs VALUES ('program', 'area', 'Informatik', 'TIF', 6);
    INSERT INTO users VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
      ('course', 'program', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);
  return sqlite;
}

const valid = { semester: "1", type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" };

function create(sqlite: Database.Database, details: Partial<typeof valid> = {}, sourceCourseId = "course", targetCourseIds: string[] = []) {
  return createCoursePhases(sqlite, { accountId: "editor", sourceCourseId, targetCourseIds, ...valid, ...details });
}

/** The field a rejected value names, so the editor can point the message at the input it came from. */
function rejectedField(save: () => unknown) {
  try {
    save();
  } catch (error) {
    return error instanceof FieldError ? error.field : `${error}`;
  }
  return "accepted";
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

function publishCompleteCourse(sqlite: Database.Database) {
  sqlite.exec(`DELETE FROM course_phases; INSERT INTO course_phases VALUES
    ('phase-1', 'course', 1, 'THEORY', '2026-10-01', '2027-03-31'),
    ('phase-2', 'course', 2, 'PRACTICE', '2027-04-01', '2027-09-30'),
    ('phase-3', 'course', 3, 'THEORY', '2027-10-01', '2028-03-31'),
    ('phase-4', 'course', 4, 'PRACTICE', '2028-04-01', '2028-09-30'),
    ('phase-5', 'course', 5, 'THEORY', '2028-10-01', '2029-03-31'),
    ('phase-6', 'course', 6, 'PRACTICE', '2029-04-01', '2029-09-30');
    UPDATE courses SET published_at = '2026-07-01T00:00:00.000Z' WHERE id = 'course';`);
}

describe("createCoursePhases", () => {
  it("stores the phase and stamps the course with who changed it when", () => {
    const sqlite = database();

    const [id] = create(sqlite);

    expect(sqlite.prepare("SELECT course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM course_phases WHERE id = ?").get(id))
      .toEqual({ courseId: "course", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" });
  });

  it("records the moment of the change on the course", () => {
    const sqlite = database();

    createCoursePhases(sqlite, { accountId: "editor", sourceCourseId: "course", targetCourseIds: [], ...valid, now: new Date("2026-07-30T09:00:00.000Z") });

    expect(sqlite.prepare("SELECT updated_at AS at, updated_by_account_id AS by FROM courses").get())
      .toEqual({ at: "2026-07-30T09:00:00.000Z", by: "editor" });
  });

  it("refuses a semester outside the study duration of the study program", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, { semester: "0" }))).toBe("semester");
    expect(rejectedField(() => create(sqlite, { semester: "7" }))).toBe("semester");
    expect(rejectedField(() => create(sqlite, { semester: "1,5" }))).toBe("semester");
    expect(rejectedField(() => create(sqlite, { semester: "" }))).toBe("semester");
    expect(() => create(sqlite, { semester: "7" })).toThrow("von 1 bis 6");
  });

  it("refuses a phase type that is neither theory nor practice", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, { type: "URLAUB" }))).toBe("type");
    expect(rejectedField(() => create(sqlite, { type: "theory" }))).toBe("type");
  });

  it("refuses a day that is not a Gregorian calendar day", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, { startDate: "01.10.2026" }))).toBe("startDate");
    expect(rejectedField(() => create(sqlite, { endDate: "2027-02-29" }))).toBe("endDate");
  });

  it("refuses an end date before the start date", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, { startDate: "2026-12-31", endDate: "2026-10-01" }))).toBe("endDate");
    // A phase of a single day is a period like any other.
    expect(() => create(sqlite, { startDate: "2026-10-01", endDate: "2026-10-01" })).not.toThrow();
  });

  it("refuses a phase reaching beyond either end of the study period and names the course", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, { startDate: "2026-09-30", endDate: "2026-12-31" }))).toBe("startDate");
    expect(rejectedField(() => create(sqlite, { semester: "6", startDate: "2029-09-01", endDate: "2029-10-01" }))).toBe("endDate");
    expect(() => create(sqlite, { startDate: "2026-09-30" })).toThrow("Studienzeitraums von TIF26A");
  });

  it("refuses a selection that is empty or names a course that does not exist", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, {}, ""))).toBe("courseIds");
    expect(rejectedField(() => create(sqlite, {}, "  "))).toBe("courseIds");
    expect(rejectedField(() => create(sqlite, {}, "course", ["kurs-unbekannt"]))).toBe("courseIds");
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
  });

  it("stores nothing at all when one course of the selection is refused", () => {
    const sqlite = database();
    sqlite.exec(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
      ('kurz', 'program', 'TIF26B', 'tif26b', '2026-10-01', '2026-11-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);

    expect(() => create(sqlite, {}, "course", ["kurz"])).toThrow("TIF26B hat einen anderen Studienzeitraum");
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
  });

  /* A transfer sends the edited course first and its targets behind it, and a refusal names a course by its code. The
     selection is therefore walked in the order it arrived rather than in the one the table happens to return. */
  it("walks the selection in the order it was given, so a refusal names the first course it applies to", () => {
    const sqlite = database();
    sqlite.exec(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
      ('kurz-a', 'program', 'TIF26B', 'tif26b', '2026-10-01', '2026-11-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
      ('kurz-b', 'program', 'TIF26C', 'tif26c', '2026-10-01', '2026-11-30', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);

    expect(() => create(sqlite, {}, "course", ["kurz-a", "kurz-b"])).toThrow("TIF26B hat einen anderen Studienzeitraum");
    expect(() => create(sqlite, {}, "course", ["kurz-b", "kurz-a"])).toThrow("TIF26C hat einen anderen Studienzeitraum");
  });
});

describe("updateCoursePhase", () => {
  it("checks the changed values against the course the phase belongs to", () => {
    const sqlite = database();
    const [phaseId] = create(sqlite);

    expect(rejectedField(() => updateCoursePhase(sqlite, { accountId: "editor", phaseId, ...valid, semester: "7" }))).toBe("semester");
    expect(rejectedField(() => updateCoursePhase(sqlite, { accountId: "editor", phaseId, ...valid, endDate: "2029-10-01" }))).toBe("endDate");
    expect(sqlite.prepare("SELECT semester, end_date AS endDate FROM course_phases WHERE id = ?").get(phaseId))
      .toEqual({ semester: 1, endDate: "2026-12-31" });
  });

  it("reports a phase it cannot find rather than changing nothing quietly", () => {
    const sqlite = database();

    expect(() => updateCoursePhase(sqlite, { accountId: "editor", phaseId: "phase-unbekannt", ...valid })).toThrow("nicht gefunden");
  });
});

describe("deleteCoursePhase", () => {
  it("removes the phase and stamps the course", () => {
    const sqlite = database();
    const [phaseId] = create(sqlite);

    deleteCoursePhase(sqlite, { accountId: "editor", phaseId, now: new Date("2026-07-30T10:00:00.000Z") });

    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT updated_at AS at FROM courses").get()).toEqual({ at: "2026-07-30T10:00:00.000Z" });
  });

  it("reports a phase it cannot find", () => {
    const sqlite = database();

    expect(() => deleteCoursePhase(sqlite, { accountId: "editor", phaseId: "phase-unbekannt" })).toThrow("nicht gefunden");
  });
});

describe("changes to a published course", () => {
  it("moves the adjacent boundary in the same transaction", () => {
    const sqlite = database();
    publishCompleteCourse(sqlite);

    updateCoursePhase(sqlite, { accountId: "editor", phaseId: "phase-2", semester: "2", type: "PRACTICE", startDate: "2027-04-08", endDate: "2027-09-30" });

    expect(sqlite.prepare("SELECT id, start_date AS startDate, end_date AS endDate FROM course_phases WHERE id IN ('phase-1', 'phase-2') ORDER BY id").all())
      .toEqual([
        { id: "phase-1", startDate: "2026-10-01", endDate: "2027-04-07" },
        { id: "phase-2", startDate: "2027-04-08", endDate: "2027-09-30" },
      ]);
  });

  it("rejects adding or deleting a single phase and preserves the public plan", () => {
    const sqlite = database();
    publishCompleteCourse(sqlite);

    expect(() => create(sqlite, { startDate: "2027-01-01", endDate: "2027-01-02" })).toThrow("nicht unmittelbar veröffentlicht");
    expect(() => deleteCoursePhase(sqlite, { accountId: "editor", phaseId: "phase-2" })).toThrow("nicht unmittelbar veröffentlicht");

    expect(sqlite.prepare("SELECT count(*) FROM course_phases").pluck().get()).toBe(6);
    expect(sqlite.prepare("SELECT start_date FROM course_phases WHERE id = 'phase-2'").pluck().get()).toBe("2027-04-01");
  });
});

/* The day a course changes over is one fact carried by two phases. It is moved as that one fact — for an unpublished
   course too, where nothing else would keep the two rows together. */
describe("moveCoursePhaseChange", () => {
  function adjoining(sqlite: Database.Database) {
    sqlite.exec(`INSERT INTO course_phases VALUES
      ('phase-1', 'course', 1, 'THEORY', '2026-10-01', '2026-12-20'),
      ('phase-2', 'course', 1, 'PRACTICE', '2026-12-21', '2027-03-31');`);
  }
  const stored = (sqlite: Database.Database) => sqlite.prepare("SELECT id, start_date AS startDate, end_date AS endDate FROM course_phases ORDER BY id").all();
  const move = (sqlite: Database.Database, date: string, ids = { earlierPhaseId: "phase-1", laterPhaseId: "phase-2" }) =>
    moveCoursePhaseChange(sqlite, { accountId: "editor", ...ids, date, now: new Date("2026-05-05T10:00:00.000Z") });

  it("moves the end of the earlier and the start of the later phase together and stamps the course", () => {
    const sqlite = database();
    adjoining(sqlite);

    move(sqlite, "2027-01-04");

    expect(stored(sqlite)).toEqual([
      { id: "phase-1", startDate: "2026-10-01", endDate: "2027-01-03" },
      { id: "phase-2", startDate: "2027-01-04", endDate: "2027-03-31" },
    ]);
    expect(sqlite.prepare("SELECT updated_at FROM courses WHERE id = 'course'").pluck().get()).toBe("2026-05-05T10:00:00.000Z");
  });

  it("leaves each of the two phases at least one day", () => {
    const sqlite = database();
    adjoining(sqlite);

    expect(rejectedField(() => move(sqlite, "2026-10-01"))).toBe("date");
    expect(rejectedField(() => move(sqlite, "2027-04-01"))).toBe("date");
    move(sqlite, "2026-10-02");
    move(sqlite, "2027-03-31");
    expect(stored(sqlite)).toEqual([
      { id: "phase-1", startDate: "2026-10-01", endDate: "2027-03-30" },
      { id: "phase-2", startDate: "2027-03-31", endDate: "2027-03-31" },
    ]);
  });

  it("refuses a day that is not a calendar day and changes nothing", () => {
    const sqlite = database();
    adjoining(sqlite);

    expect(rejectedField(() => move(sqlite, "2027-02-30"))).toBe("date");
    expect(stored(sqlite)).toEqual([
      { id: "phase-1", startDate: "2026-10-01", endDate: "2026-12-20" },
      { id: "phase-2", startDate: "2026-12-21", endDate: "2027-03-31" },
    ]);
  });

  // The form was drawn from a state that someone else may have changed since.
  it("refuses two phases that do not adjoin, or that are not both phases of the course", () => {
    const sqlite = database();
    adjoining(sqlite);
    sqlite.exec("UPDATE course_phases SET start_date = '2026-12-28' WHERE id = 'phase-2'");

    expect(() => move(sqlite, "2027-01-04")).toThrow("grenzen nicht mehr aneinander");
    expect(() => move(sqlite, "2027-01-04", { earlierPhaseId: "fehlt", laterPhaseId: "phase-2" })).toThrow("nicht gefunden");
    expect(() => move(sqlite, "2027-01-04", { earlierPhaseId: "phase-1", laterPhaseId: "fehlt" })).toThrow("nicht gefunden");
  });

  it("moves the change of a published course as well and keeps its plan complete", () => {
    const sqlite = database();
    publishCompleteCourse(sqlite);

    move(sqlite, "2027-04-08");

    expect(sqlite.prepare("SELECT end_date FROM course_phases WHERE id = 'phase-1'").pluck().get()).toBe("2027-04-07");
    expect(sqlite.prepare("SELECT start_date FROM course_phases WHERE id = 'phase-2'").pluck().get()).toBe("2027-04-08");
  });
});
