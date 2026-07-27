import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { readPublicCourseBlockPlan } from "@/lib/services/public-course-api";
import { applySchema } from "@/test/schema";

function databaseWithPublishedCourse() {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-1', 'Technik', 'technik');
    INSERT INTO block_plans VALUES ('plan-1', 'area-1', NULL, NULL, 1, '2026-01-01T00:00:00.000Z', NULL);
    INSERT INTO published_versions VALUES ('version-1', 'plan-1', '2026-01-01T00:00:00.000Z', '2025 · TIF25A', 'Technik');
    INSERT INTO published_course_snapshots VALUES ('snapshot-1', 'version-1', 'course-1', 'TIF25A', 'Informatik', 'TIF', '2025-10-01', '2028-09-30', 3);
    INSERT INTO published_phases VALUES ('phase-1', 'version-1', 'snapshot-1', 1, 'THEORY', '2025-10-01', '2025-12-19');
    INSERT INTO published_phases VALUES ('phase-2', 'version-1', 'snapshot-1', 1, 'PRACTICE', '2025-12-20', '2026-03-31');
    INSERT INTO published_phases VALUES ('phase-3', 'version-1', 'snapshot-1', 2, 'THEORY', '2026-04-01', '2026-09-30');
    INSERT INTO published_phases VALUES ('phase-4', 'version-1', 'snapshot-1', 3, 'PRACTICE', '2026-10-01', '2028-09-30');
    INSERT INTO published_course_search_keys VALUES ('snapshot-1', 'tif25a');
  `);
  return sqlite;
}

describe("readPublicCourseBlockPlan", () => {
  it("returns only the requested published course, structured by semester", () => {
    const result = readPublicCourseBlockPlan(databaseWithPublishedCourse(), " tif25a ");

    expect(result).toEqual({
      kind: "found",
      data: {
        course: {
          code: "TIF25A",
          program: { name: "Informatik", abbreviation: "TIF" },
          studyPeriod: { startDate: "2025-10-01", endDate: "2028-09-30" },
        },
        semesters: [
          {
            number: 1,
            phases: [
              { type: "THEORY", startDate: "2025-10-01", endDate: "2025-12-19" },
              { type: "PRACTICE", startDate: "2025-12-20", endDate: "2026-03-31" },
            ],
          },
          { number: 2, phases: [{ type: "THEORY", startDate: "2026-04-01", endDate: "2026-09-30" }] },
          { number: 3, phases: [{ type: "PRACTICE", startDate: "2026-10-01", endDate: "2028-09-30" }] },
        ],
      },
    });
  });

  it("finds a course through its stored normalized search key", () => {
    const sqlite = databaseWithPublishedCourse();

    expect(readPublicCourseBlockPlan(sqlite, " tif25a ")).toMatchObject({
      kind: "found",
      data: { course: { code: "TIF25A" } },
    });
  });

  it("does not reveal a draft-only or unknown course", () => {
    const sqlite = databaseWithPublishedCourse();
    sqlite.exec(`
      INSERT INTO programs VALUES ('program-1', 'area-1', 'Informatik', 'TIF', 6);
      INSERT INTO courses VALUES ('course-2', 'program-1', NULL, 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30');
    `);

    expect(readPublicCourseBlockPlan(sqlite, "TIF26A")).toEqual({ kind: "not-found" });
    expect(readPublicCourseBlockPlan(sqlite, "TIF99A")).toEqual({ kind: "not-found" });
  });

  // What lets the API answer with one course instead of a choice: no second published version can hold the code.
  it("cannot be asked for a code that two published versions share", () => {
    const sqlite = databaseWithPublishedCourse();
    sqlite.exec(`
      INSERT INTO block_plans VALUES ('plan-2', 'area-1', NULL, NULL, 1, '2026-01-01T00:00:00.000Z', NULL);
      INSERT INTO published_versions VALUES ('version-2', 'plan-2', '2026-01-01T00:00:00.000Z', 'Zweiter Plan', 'Technik');
      INSERT INTO published_course_snapshots VALUES ('snapshot-2', 'version-2', 'course-2', 'tIf25a', 'Informatik', 'TIF', '2025-10-01', '2028-09-30', 3);
    `);

    expect(() => sqlite.exec("INSERT INTO published_course_search_keys VALUES ('snapshot-2', 'tif25a')"))
      .toThrow("UNIQUE constraint failed");
  });
});
