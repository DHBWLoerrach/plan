import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { areaCut, programCut, yearCut } from "@/lib/domain/public-cut";
import { readPublicCourse, readPublicCut, readPublicOverview } from "@/lib/services/public-search";
import { databaseWithMasterData, unpublishedCourse, publish, courseIdForCode, withdraw } from "@/test/published-plans";
import { applySchema } from "@/test/schema";

const today = "2026-07-26";

describe("readPublicOverview", () => {
  it("reads published courses that have not ended, with their phases", () => {
    const sqlite = databaseWithMasterData();
    publish(sqlite, { id: "tif21a", courses: [{ code: "TIF21A", studyStart: "2021-10-01", studyEnd: "2024-09-30" }] });
    publish(sqlite, {
      id: "tif24a",
      courses: [{ code: "TIF24A", studyStart: "2024-10-01", phases: [{ semester: 1, startDate: "2024-10-01", endDate: "2024-12-20" }] }],
    });
    publish(sqlite, { id: "wwi26a", area: "Wirtschaft", areaId: "area-2", courses: [{ code: "WWI26A", studyStart: "2026-10-01" }] });
    unpublishedCourse(sqlite, "WWI99A");

    const { courses, phases } = readPublicOverview(sqlite, today);

    expect(courses.map((course) => [course.code, course.area, course.program, course.programAbbreviation, course.year])).toEqual([
      ["TIF24A", "Technik", "Informatik", "TIF", 2024],
      ["WWI26A", "Wirtschaft", "BWL", "WWI", 2026],
    ]);
    expect(phases.map((phase) => phase.courseId)).toEqual([courseIdForCode("TIF24A")]);
  });

  it("counts the published courses of each program and year, ended ones included, as their cut shows them", () => {
    const sqlite = databaseWithMasterData();
    publish(sqlite, { id: "tif23a", courses: [{ code: "TIF23A", studyStart: "2023-10-01" }] });
    publish(sqlite, { id: "tif23c", courses: [{ code: "TIF23C", studyStart: "2023-10-01", studyEnd: "2026-03-31" }] });

    const { courses, cutSizes, endedCourses } = readPublicOverview(sqlite, today);

    expect(courses.map((course) => course.code)).toEqual(["TIF23A"]);
    expect(cutSizes.get("tif 2023")).toBe(2);
    expect(endedCourses).toEqual([{ code: "TIF23C", year: 2023 }]);
  });

  it("keeps a course on its last day", () => {
    const sqlite = databaseWithMasterData();
    publish(sqlite, { id: "tif23a", courses: [{ code: "TIF23A", studyStart: "2023-10-01", studyEnd: today }] });

    expect(readPublicOverview(sqlite, today).courses.map((course) => course.code)).toEqual(["TIF23A"]);
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
    expect(cut?.events.map((event) => [event.title, event.courseId])).toEqual([["Klausur A", courseIdForCode("TIF24A")]]);
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

describe("readPublicCourse", () => {
  it("reads a course with its published parallel courses, their phases and events, and its last change", () => {
    const sqlite = databaseWithMasterData();
    publish(sqlite, {
      courses: [
        { code: "TIF25A", studyStart: "2025-10-01", phases: [{ semester: 1, startDate: "2025-10-01", endDate: "2025-12-31" }] },
        { code: "TIF25B", studyStart: "2025-10-01", phases: [{ semester: 1, type: "PRACTICE", startDate: "2025-10-01", endDate: "2025-12-31" }] },
        { code: "TIF24A", studyStart: "2024-10-01" },
      ],
      events: [{ title: "Abgabe", startDate: "2025-11-03", courses: ["TIF25B"] }],
    });
    sqlite.prepare("UPDATE courses SET updated_at = '2026-11-09T08:00:00.000Z' WHERE code = 'TIF25B'").run();

    const read = readPublicCourse(sqlite, "tif25b");

    expect(read?.course.code).toBe("TIF25B");
    expect(read?.updatedAt).toBe("2026-11-09T08:00:00.000Z");
    expect(read?.parallels.map((course) => course.code)).toEqual(["TIF25A"]);
    expect(read?.phases.map((phase) => [phase.courseId, phase.type])).toEqual([
      ["course-published-TIF25A", "THEORY"], ["course-published-TIF25B", "PRACTICE"],
    ]);
    expect(read?.events.map((event) => event.courseId)).toEqual(["course-published-TIF25B"]);
  });

  it("keeps reading one snapshot when another connection withdraws the course between its reads", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "plan-public-course-"));
    const file = path.join(directory, "app.sqlite");
    const setup = new Database(file);
    setup.pragma("journal_mode = WAL");
    setup.close();
    const app = new Database(file);
    const other = new Database(file);
    try {
      applySchema(app);
      app.exec(`INSERT INTO areas VALUES ('area-1', 'Technik', 'technik');
        INSERT INTO programs VALUES ('program-1', 'area-1', 'Informatik', 'TIF', 6);
        INSERT INTO users VALUES ('seed', 'Seed', 'seed@test', 0, NULL, 'NONE', 1, 'ACTIVE', 0, 0);`);
      publish(app, { courses: [{ code: "TIF25A", studyStart: "2025-10-01" }] });
      // The cut of the program is the second read; the withdrawal lands right before it.
      const connection = new Proxy(app, {
        get(target, property) {
          if (property === "prepare") {
            return (source: string) => {
              if (source.includes("program.abbreviation = ?")) other.prepare("UPDATE courses SET published_at = NULL").run();
              return target.prepare(source);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });

      expect(readPublicCourse(connection, "TIF25A")?.course.code).toBe("TIF25A");
      expect(readPublicCourse(app, "TIF25A")).toBeNull();
    } finally {
      app.close();
      other.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("finds no unpublished course", () => {
    const sqlite = databaseWithMasterData();
    unpublishedCourse(sqlite, "TIF25C");

    expect(readPublicCourse(sqlite, "TIF25C")).toBeNull();
  });
});
