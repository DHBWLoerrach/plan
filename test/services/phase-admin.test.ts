import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { FieldError } from "@/lib/domain/field-error";
import { createDraftPhases, deleteDraftPhase, updateDraftPhase } from "@/lib/services/phase-admin";
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
    INSERT INTO user VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, has_ever_been_published, draft_updated_at, draft_updated_by_account_id) VALUES
      ('course', 'program', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', 0, '2026-01-01T00:00:00.000Z', 'editor');`);
  return sqlite;
}

const valid = { semester: "1", type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" };

function create(sqlite: Database.Database, details: Partial<typeof valid> = {}, courseIds = ["course"]) {
  return createDraftPhases(sqlite, { accountId: "editor", courseIds, ...valid, ...details });
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

describe("createDraftPhases", () => {
  it("stores the phase and stamps the course with who changed it when", () => {
    const sqlite = database();

    const [id] = create(sqlite, {}, ["course"]);

    expect(sqlite.prepare("SELECT course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM course_phases WHERE id = ?").get(id))
      .toEqual({ courseId: "course", semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2026-12-31" });
  });

  it("records the moment of the change on the course", () => {
    const sqlite = database();

    createDraftPhases(sqlite, { accountId: "editor", courseIds: ["course"], ...valid, now: new Date("2026-07-30T09:00:00.000Z") });

    expect(sqlite.prepare("SELECT draft_updated_at AS at, draft_updated_by_account_id AS by FROM courses").get())
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

    expect(rejectedField(() => create(sqlite, {}, []))).toBe("courseIds");
    expect(rejectedField(() => create(sqlite, {}, ["  "]))).toBe("courseIds");
    expect(rejectedField(() => create(sqlite, {}, ["course", "kurs-unbekannt"]))).toBe("courseIds");
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
  });

  it("stores nothing at all when one course of the selection is refused", () => {
    const sqlite = database();
    sqlite.exec(`INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, has_ever_been_published, draft_updated_at, draft_updated_by_account_id) VALUES
      ('kurz', 'program', 'TIF26B', 'tif26b', '2026-10-01', '2026-11-30', 0, '2026-01-01T00:00:00.000Z', 'editor');`);

    // The period fits the first course but reaches past the study end of the second one.
    expect(() => create(sqlite, {}, ["course", "kurz"])).toThrow("Studienzeitraums von TIF26B");
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
  });
});

describe("updateDraftPhase", () => {
  it("checks the changed values against the course the phase belongs to", () => {
    const sqlite = database();
    const [phaseId] = create(sqlite);

    expect(rejectedField(() => updateDraftPhase(sqlite, { accountId: "editor", phaseId, ...valid, semester: "7" }))).toBe("semester");
    expect(rejectedField(() => updateDraftPhase(sqlite, { accountId: "editor", phaseId, ...valid, endDate: "2029-10-01" }))).toBe("endDate");
    expect(sqlite.prepare("SELECT semester, end_date AS endDate FROM course_phases WHERE id = ?").get(phaseId))
      .toEqual({ semester: 1, endDate: "2026-12-31" });
  });

  it("reports a phase it cannot find rather than changing nothing quietly", () => {
    const sqlite = database();

    expect(() => updateDraftPhase(sqlite, { accountId: "editor", phaseId: "phase-unbekannt", ...valid })).toThrow("nicht gefunden");
  });
});

describe("deleteDraftPhase", () => {
  it("removes the phase and stamps the course", () => {
    const sqlite = database();
    const [phaseId] = create(sqlite);

    deleteDraftPhase(sqlite, { accountId: "editor", phaseId, now: new Date("2026-07-30T10:00:00.000Z") });

    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT draft_updated_at AS at FROM courses").get()).toEqual({ at: "2026-07-30T10:00:00.000Z" });
  });

  it("reports a phase it cannot find", () => {
    const sqlite = database();

    expect(() => deleteDraftPhase(sqlite, { accountId: "editor", phaseId: "phase-unbekannt" })).toThrow("nicht gefunden");
  });
});
