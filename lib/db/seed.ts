import type Database from "better-sqlite3";

/**
 * One study program with the area it belongs to: area key, area name, program name, abbreviation, number of semesters.
 *
 * The area key names the area in its identifier and is written out rather than computed from the name: a slug derived
 * from the long designations below would let two areas that differ only in punctuation fall together, and the
 * resulting collision hits the primary key, which no `ON CONFLICT` clause of the seed catches. It is chosen once and
 * then stays, however the area comes to be called; the same key on two different areas fails the seed test.
 */
export type MasterDataRow = readonly [string, string, string, string, number];

const seedRows: readonly MasterDataRow[] = [
  ["szi", "Studienzentrum IT-Management und Informatik (SZI)", "Informatik", "TIF", 6], ["szi", "Studienzentrum IT-Management und Informatik (SZI)", "Wirtschaftsinformatik", "WWI", 6],
  ["gesundheit-tourismus", "Studienzentrum Gesundheit Tourismus", "BWL – Gesundheitsmanagement", "WHC", 6], ["gesundheit-tourismus", "Studienzentrum Gesundheit Tourismus", "BWL – Tourismus, Hotellerie und Gastronomie", "WTD", 6],
  ["technik", "Studienbereich Technik", "Elektrotechnik und Informationstechnik", "TEL", 6], ["technik", "Studienbereich Technik", "Maschinenbau", "TMB", 6], ["technik", "Studienbereich Technik", "Wirtschaftsingenieurwesen", "TWW", 6],
  ["bic", "Business Innovation Center (BIC)", "BWL – Digital Business Management", "WDB", 6], ["bic", "Business Innovation Center (BIC)", "BWL – Industrie / Industrial Business Management", "WIN", 6], ["bic", "Business Innovation Center (BIC)", "Data Science und Künstliche Intelligenz", "WDS", 6],
  ["architektur", "Architektur", "Architektur", "TAR", 7], ["mechatronik-trinational", "Mechatronik Trinational", "Mechatronik Trinational", "TTR", 7], ["finanzdienstleistungen", "BWL – Finanzdienstleistungen", "BWL – Finanzdienstleistungen", "WFD", 6],
  ["handelsmanagement", "BWL – Handelsmanagement", "BWL – Handelsmanagement", "WHD", 6], ["personalmanagement", "BWL – Personalmanagement", "BWL – Personalmanagement", "WPM", 6], ["spedition", "BWL – Spedition, Transport und Logistik", "BWL – Spedition, Transport und Logistik", "WSP", 6],
  ["ibm-trinational", "International Business Management Trinational", "International Business Management Trinational", "WTR", 7], ["gesundheitsversorgung", "Interprofessionelle Gesundheitsversorgung (Physiotherapie, Ergotherapie, Logopädie, Pflege)", "Interprofessionelle Gesundheitsversorgung (Physiotherapie, Ergotherapie, Logopädie, Pflege)", "GIV", 6],
];

/**
 * Writes the master data the application ships with, on every start.
 *
 * A row is addressed by its natural key — the normalised area name, the abbreviation of the study program — and never
 * by its position in the list: a list that gains an entry anywhere but at the end reaches an existing database just as
 * it reaches a fresh one, and a changed designation corrects the stored row instead of being dropped as a conflict.
 *
 * The identifier reads as the row it belongs to, so a join in the database shell says what it joins. It is assigned
 * with the insert and never touched again, because courses and area assignments point at it: after a rename it keeps
 * the wording it was born with, which is a stale reading of a stable value and not a reason to mint a new one.
 * Everything that references master data does so by identifier, so nothing outside these two tables reads it.
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
    for (const [areaKey, areaName, programName, abbreviation, semesters] of rows) {
      const { id: areaId } = upsertArea.get(`area-${areaKey}`, areaName, areaName.toLocaleLowerCase("de-DE")) as { id: string };
      upsertProgram.run(`program-${abbreviation.toLocaleLowerCase("de-DE")}`, areaId, programName, abbreviation, semesters);
    }
  }).immediate();
}
