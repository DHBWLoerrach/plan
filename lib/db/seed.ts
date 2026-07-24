import type Database from "better-sqlite3";

const seedRows = [
  ["Studienzentrum IT-Management und Informatik (SZI)", "Informatik", "TIF", 6], ["Studienzentrum IT-Management und Informatik (SZI)", "Wirtschaftsinformatik", "WWI", 6],
  ["Studienzentrum Gesundheit Tourismus", "BWL – Gesundheitsmanagement", "WHC", 6], ["Studienzentrum Gesundheit Tourismus", "BWL – Tourismus, Hotellerie und Gastronomie", "WTD", 6],
  ["Studienbereich Technik", "Elektrotechnik und Informationstechnik", "TEL", 6], ["Studienbereich Technik", "Maschinenbau", "TMB", 6], ["Studienbereich Technik", "Wirtschaftsingenieurwesen", "TWW", 6],
  ["Business Innovation Center (BIC)", "BWL – Digital Business Management", "WDB", 6], ["Business Innovation Center (BIC)", "BWL – Industrie / Industrial Business Management", "WIN", 6], ["Business Innovation Center (BIC)", "Data Science und Künstliche Intelligenz", "WDS", 6],
  ["Architektur", "Architektur", "TAR", 7], ["Mechatronik Trinational", "Mechatronik Trinational", "TTR", 7], ["BWL – Finanzdienstleistungen", "BWL – Finanzdienstleistungen", "WFD", 6],
  ["BWL – Handelsmanagement", "BWL – Handelsmanagement", "WHD", 6], ["BWL – Personalmanagement", "BWL – Personalmanagement", "WPM", 6], ["BWL – Spedition, Transport und Logistik", "BWL – Spedition, Transport und Logistik", "WSP", 6],
  ["International Business Management Trinational", "International Business Management Trinational", "WTR", 7], ["Interprofessionelle Gesundheitsversorgung (Physiotherapie, Ergotherapie, Logopädie, Pflege)", "Interprofessionelle Gesundheitsversorgung (Physiotherapie, Ergotherapie, Logopädie, Pflege)", "GIV", 6],
] as const;

export function seedMasterData(sqlite: Database.Database) {
  const addArea = sqlite.prepare("INSERT OR IGNORE INTO areas (id, name, normalized_name) VALUES (?, ?, ?)");
  const addProgram = sqlite.prepare("INSERT OR IGNORE INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)");
  sqlite.transaction(() => {
    const areaIds = new Map<string, string>();
    for (const [index, [areaName, programName, abbreviation, semesters]] of seedRows.entries()) {
      const areaId = areaIds.get(areaName) ?? `area-${String(areaIds.size + 1).padStart(2, "0")}`;
      areaIds.set(areaName, areaId);
      addArea.run(areaId, areaName, areaName.toLocaleLowerCase("de-DE"));
      addProgram.run(`program-${String(index + 1).padStart(2, "0")}`, areaId, programName, abbreviation, semesters);
    }
  })();
}
