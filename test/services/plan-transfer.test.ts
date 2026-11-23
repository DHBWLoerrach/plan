import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { FieldError } from "@/lib/domain/field-error";
import { createCourseEvent } from "@/lib/services/event-admin";
import { createCoursePhases } from "@/lib/services/phase-admin";
import { requirePlanEntryCourses } from "@/lib/services/plan-transfer";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

/**
 * Around `course-a`: a parallel course, one of the following year whose study period still overlaps by two years, a
 * published one, one of a study program of another length and one of another study period at the same length.
 */
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area', 'Technik', 'technik');
    INSERT INTO programs VALUES ('prog', 'area', 'Informatik', 'TIF', 6), ('prog-lang', 'area', 'Technik', 'TEC', 7);
    INSERT INTO users VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id) VALUES
      ('course-a', 'prog', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
      ('course-b', 'prog', 'TIF26B', 'tif26b', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
      ('course-next-year', 'prog', 'TIF27A', 'tif27a', '2027-10-01', '2030-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
      ('course-published', 'prog', 'TIF26C', 'tif26c', '2026-10-01', '2029-09-30', '2026-02-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'editor'),
      ('course-longer', 'prog-lang', 'TEC26A', 'tec26a', '2026-10-01', '2029-09-30', NULL, '2026-01-01T00:00:00.000Z', 'editor'),
      ('course-shifted', 'prog', 'TIF26D', 'tif26d', '2026-11-01', '2029-10-31', NULL, '2026-01-01T00:00:00.000Z', 'editor');`);
  return sqlite;
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

function refusal(sourceCourseId: string, targetCourseIds: string[], kind: "phase" | "event") {
  try {
    const sqlite = database();
    sqlite.transaction(() => requirePlanEntryCourses(sqlite, { sourceCourseId, targetCourseIds, accountId: "editor" }, kind)).immediate();
  } catch (error) {
    return error instanceof FieldError ? error.message : `${error}`;
  }
  return "accepted";
}

describe("requirePlanEntryCourses", () => {
  it("accepts a parallel course of the same year, and the empty selection of a plain creation", () => {
    expect(refusal("course-a", ["course-b"], "phase")).toBe("accepted");
    expect(refusal("course-a", ["course-b"], "event")).toBe("accepted");
    expect(refusal("course-a", [], "phase")).toBe("accepted");
    expect(refusal("course-a", ["course-a", "  "], "phase")).toBe("accepted");
  });

  /* The study periods of two consecutive years overlap by two years, so a date valid for both would pass every check
     the domain makes per course. Only the year of the comparison rules the target out. */
  it("refuses a course of another year, for phases and events alike", () => {
    expect(refusal("course-a", ["course-next-year"], "phase")).toContain("Jahrgang 2027");
    expect(refusal("course-a", ["course-next-year"], "event")).toContain("Jahrgang 2027");
  });

  it("refuses a phase target that could not take every phase of the edited course", () => {
    expect(refusal("course-a", ["course-published"], "phase")).toContain("veröffentlicht");
    expect(refusal("course-a", ["course-longer"], "phase")).toContain("andere Anzahl Semester");
    expect(refusal("course-a", ["course-shifted"], "phase")).toContain("anderen Studienzeitraum");
  });

  /* An event hangs on no semester structure, so within the year those same courses are legitimate targets. That an
     event may fall outside a target's study period is caught by the completeness check of that course. */
  it("keeps those courses as event targets", () => {
    expect(refusal("course-a", ["course-published"], "event")).toBe("accepted");
    expect(refusal("course-a", ["course-longer"], "event")).toBe("accepted");
    expect(refusal("course-a", ["course-shifted"], "event")).toBe("accepted");
  });

  it("refuses the whole selection when one target of several is refused", () => {
    expect(refusal("course-a", ["course-b", "course-next-year"], "phase")).toContain("Es wurde nichts gespeichert");
  });

  it("refuses a target or an edited course that does not exist", () => {
    expect(refusal("course-a", ["kurs-unbekannt"], "event")).toContain("nicht gefunden");
    expect(refusal("kurs-unbekannt", ["course-b"], "event")).toContain("nicht gefunden");
  });
});

it("creates independent entries on the source and target and ignores repeated selections", () => {
  const sqlite = database();
  const selection = { accountId: "editor", sourceCourseId: " course-a ", targetCourseIds: ["course-b", "course-a", " course-b ", ""] };
  const phases = createCoursePhases(sqlite, { ...selection, semester: "3", type: "THEORY", startDate: "2027-10-01", endDate: "2027-12-31" });
  const events = createCourseEvent(sqlite, {
    ...selection, title: "Prüfung", description: "", category: "EXAM", startDate: "2027-12-01", endDate: "", provisional: false,
  });
  expect(new Set(phases).size).toBe(2);
  expect(new Set(events).size).toBe(2);
  expect(sqlite.prepare("SELECT course_id FROM course_phases ORDER BY course_id").pluck().all()).toEqual(["course-a", "course-b"]);
  expect(sqlite.prepare("SELECT course_id FROM course_events ORDER BY course_id").pluck().all()).toEqual(["course-a", "course-b"]);
});

it("enforces the year in the write services and leaves all courses untouched on refusal", () => {
  const sqlite = database();
  const selection = { accountId: "editor", sourceCourseId: "course-a", targetCourseIds: ["course-b", "course-next-year"] };
  expect(() => createCoursePhases(sqlite, {
    ...selection, semester: "3", type: "THEORY", startDate: "2027-10-01", endDate: "2027-12-31",
  })).toThrow("Jahrgang 2027");
  expect(() => createCourseEvent(sqlite, {
    ...selection, title: "Prüfung", description: "", category: "EXAM", startDate: "2027-12-01", endDate: "", provisional: false,
  })).toThrow("Jahrgang 2027");
  expect(sqlite.prepare("SELECT count(*) FROM course_phases").pluck().get()).toBe(0);
  expect(sqlite.prepare("SELECT count(*) FROM course_events").pluck().get()).toBe(0);
  expect(sqlite.prepare("SELECT DISTINCT updated_at FROM courses").pluck().all()).toEqual(["2026-01-01T00:00:00.000Z"]);
});
