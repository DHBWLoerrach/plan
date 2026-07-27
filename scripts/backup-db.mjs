import path from "node:path";

import { backupDatabase } from "../lib/services/database-maintenance.mjs";

function parseTargetArgument(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--to" || !argumentsList[1]) {
    throw new Error("Aufruf: npm run backup:db -- --to <zieldatei>");
  }
  return argumentsList[1];
}

try {
  const report = await backupDatabase({
    databasePath: process.env.DATABASE_URL ?? "",
    targetPath: parseTargetArgument(process.argv.slice(2)),
  });
  process.stdout.write(`Geprüfte Sicherung: ${path.resolve(report.targetPath)}\n`);
  process.stdout.write(`Migrationsstand: ${report.migrations.join(", ")}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  process.stderr.write(`Die Sicherung wurde nicht erstellt: ${message}\n`);
  process.exitCode = 1;
}
