import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

/** One study program with the area it belongs to: area name, program name, abbreviation, number of semesters. */
export type MasterDataRow = readonly [string, string, string, number];

const seedRows: readonly MasterDataRow[] = [
  ["Studienzentrum IT-Management und Informatik (SZI)", "Informatik", "TIF", 6], ["Studienzentrum IT-Management und Informatik (SZI)", "Wirtschaftsinformatik", "WWI", 6],
  ["Studienzentrum Gesundheit Tourismus", "BWL – Gesundheitsmanagement", "WHC", 6], ["Studienzentrum Gesundheit Tourismus", "BWL – Tourismus, Hotellerie und Gastronomie", "WTD", 6],
  ["Studienbereich Technik", "Elektrotechnik und Informationstechnik", "TEL", 6], ["Studienbereich Technik", "Maschinenbau", "TMB", 6], ["Studienbereich Technik", "Wirtschaftsingenieurwesen", "TWW", 6],
  ["Business Innovation Center (BIC)", "BWL – Digital Business Management", "WDB", 6], ["Business Innovation Center (BIC)", "BWL – Industrie / Industrial Business Management", "WIN", 6], ["Business Innovation Center (BIC)", "Data Science und Künstliche Intelligenz", "WDS", 6],
  ["Architektur", "Architektur", "TAR", 7], ["Mechatronik Trinational", "Mechatronik Trinational", "TTR", 7], ["BWL – Finanzdienstleistungen", "BWL – Finanzdienstleistungen", "WFD", 6],
  ["BWL – Handelsmanagement", "BWL – Handelsmanagement", "WHD", 6], ["BWL – Personalmanagement", "BWL – Personalmanagement", "WPM", 6], ["BWL – Spedition, Transport und Logistik", "BWL – Spedition, Transport und Logistik", "WSP", 6],
  ["International Business Management Trinational", "International Business Management Trinational", "WTR", 7], ["Interprofessionelle Gesundheitsversorgung (Physiotherapie, Ergotherapie, Logopädie, Pflege)", "Interprofessionelle Gesundheitsversorgung (Physiotherapie, Ergotherapie, Logopädie, Pflege)", "GIV", 6],
];

/**
 * Writes the master data the application ships with, on every start.
 *
 * A row is addressed by its natural key — the normalised area name, the abbreviation of the study program — and never
 * by its position in the list. Identifiers are generated once and then belong to the row: a list that gains an entry
 * anywhere but at the end reaches an existing database just as it reaches a fresh one, and a changed designation
 * corrects the stored row instead of being dropped as a conflict. Everything that references master data does so by
 * identifier, so nothing outside these two tables depends on how they read.
 *
 * What the seed does not do is take anything back: a row removed from the list stays in the database, because courses
 * may already point at it. The same holds for `semesters` — course phases are counted against it, so a different
 * number is a data migration that has to decide what happens to those phases, not a value the start may overwrite.
 */
export function seedMasterData(sqlite: Database.Database, rows: readonly MasterDataRow[] = seedRows) {
  const upsertArea = sqlite.prepare(`INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)
    ON CONFLICT(normalized_name) DO UPDATE SET name = excluded.name RETURNING id`);
  const upsertProgram = sqlite.prepare(`INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(abbreviation COLLATE NOCASE) DO UPDATE SET area_id = excluded.area_id, name = excluded.name`);
  sqlite.transaction(() => {
    for (const [areaName, programName, abbreviation, semesters] of rows) {
      const { id: areaId } = upsertArea.get(randomUUID(), areaName, areaName.toLocaleLowerCase("de-DE")) as { id: string };
      upsertProgram.run(randomUUID(), areaId, programName, abbreviation, semesters);
    }
  })();
}
