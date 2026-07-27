import path from "node:path";

import { applyPendingMigrations } from "../lib/services/database-maintenance.mjs";

try {
  if (process.argv.length > 2) throw new Error("Aufruf: npm run migrate:db");
  const applied = applyPendingMigrations({
    databasePath: process.env.DATABASE_URL ?? "",
    migrationsDirectory: path.join(process.cwd(), "migrations"),
  });
  process.stdout.write(applied.length === 0
    ? "Keine ausstehenden Migrationen.\n"
    : `Ausgeführte Migrationen: ${applied.join(", ")}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  process.stderr.write(`Die Migration wurde abgebrochen: ${message}\n`);
  process.exitCode = 1;
}
