import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { seedMasterData, type MasterDataRow } from "@/lib/db/seed";
import { applySchema } from "@/test/schema";

/**
 * The seed runs on every application start, against databases that already carry courses. What it must not do is
 * depend on where an entry stands in its list: the shipped master data grows and gets corrected over time, and a
 * database that silently kept the old state would differ from a fresh installation without anything failing.
 */
const own: MasterDataRow = ["Studienbereich Technik", "Informatik", "TIF", 6];
const second: MasterDataRow = ["Studienbereich Technik", "Maschinenbau", "TMB", 6];
const third: MasterDataRow = ["Wirtschaft", "Handelsmanagement", "WHD", 6];

function seededDatabase(rows?: readonly MasterDataRow[]) {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
  if (rows) seedMasterData(sqlite, rows);
  else seedMasterData(sqlite);
  return sqlite;
}

function programs(sqlite: Database.Database) {
  return sqlite.prepare(`SELECT program.abbreviation, program.name, area.name AS areaName
    FROM programs program JOIN areas area ON area.id = program.area_id ORDER BY program.abbreviation`).all();
}

describe("seedMasterData", () => {
  it("adds an entry that was inserted before the existing ones", () => {
    const sqlite = seededDatabase([second, third]);

    seedMasterData(sqlite, [own, second, third]);

    expect(programs(sqlite)).toEqual([
      { abbreviation: "TIF", name: "Informatik", areaName: "Studienbereich Technik" },
      { abbreviation: "TMB", name: "Maschinenbau", areaName: "Studienbereich Technik" },
      { abbreviation: "WHD", name: "Handelsmanagement", areaName: "Wirtschaft" },
    ]);
  });

  it("corrects a changed designation on the stored row instead of adding a second one", () => {
    const sqlite = seededDatabase([own]);
    const areaId = sqlite.prepare("SELECT id FROM areas").pluck().get() as string;
    const programId = sqlite.prepare("SELECT id FROM programs").pluck().get() as string;

    seedMasterData(sqlite, [["Studienbereich Technik", "Angewandte Informatik", "TIF", 6]]);

    expect(programs(sqlite)).toEqual([{ abbreviation: "TIF", name: "Angewandte Informatik", areaName: "Studienbereich Technik" }]);
    // The identifiers are what courses and area assignments point at, so a correction must not mint new ones.
    expect(sqlite.prepare("SELECT id FROM areas").pluck().get()).toBe(areaId);
    expect(sqlite.prepare("SELECT id FROM programs").pluck().get()).toBe(programId);
  });

  it("moves a study program that changed its area, keeping one row for it", () => {
    const sqlite = seededDatabase([own]);

    seedMasterData(sqlite, [["Wirtschaft", "Informatik", "TIF", 6]]);

    expect(programs(sqlite)).toEqual([{ abbreviation: "TIF", name: "Informatik", areaName: "Wirtschaft" }]);
  });

  /* Course phases are counted against `semesters`, so the start must not move that number under courses that already
     exist. Changing it is a data migration that decides what happens to those phases. */
  it("leaves a changed number of semesters to a migration", () => {
    const sqlite = seededDatabase([own]);

    seedMasterData(sqlite, [["Studienbereich Technik", "Informatik", "TIF", 7]]);

    expect(sqlite.prepare("SELECT semesters FROM programs").pluck().get()).toBe(6);
  });

  it("leaves the shipped master data unchanged when the application starts again", () => {
    const sqlite = seededDatabase();
    const before = { areas: sqlite.prepare("SELECT * FROM areas ORDER BY id").all(), programs: sqlite.prepare("SELECT * FROM programs ORDER BY id").all() };

    seedMasterData(sqlite);

    expect(before.areas.length).toBeGreaterThan(0);
    expect(sqlite.prepare("SELECT * FROM areas ORDER BY id").all()).toEqual(before.areas);
    expect(sqlite.prepare("SELECT * FROM programs ORDER BY id").all()).toEqual(before.programs);
  });
});
