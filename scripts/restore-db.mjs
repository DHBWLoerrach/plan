import path from "node:path";

import { restoreDatabase } from "../lib/services/database-maintenance.mjs";

function parseSnapshotArgument(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--from" || !argumentsList[1]) {
    throw new Error("Aufruf: npm run restore:db -- --from <snapshot>");
  }
  return argumentsList[1];
}

try {
  const report = restoreDatabase({
    snapshotPath: parseSnapshotArgument(process.argv.slice(2)),
    databasePath: process.env.DATABASE_URL ?? "",
    migrationsDirectory: path.join(process.cwd(), "migrations"),
  });
  process.stdout.write(`Wiederhergestellter Migrationsstand: ${report.migrations.join(", ")}\n`);
  process.stdout.write(report.replacedPath === null
    ? "Es war keine Datenbank vorhanden; es wurde keine ersetzt.\n"
    : `Ersetzte Datenbank liegt unter: ${path.resolve(report.replacedPath)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  process.stderr.write(`Die Wiederherstellung wurde abgebrochen: ${message}\n`);
  process.exitCode = 1;
}
