import { resetSystemAdminPassword } from "../lib/services/emergency-admin-reset.mjs";

function parseEmailArgument(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--email" || !argumentsList[1]) {
    throw new Error("Aufruf: npm run reset:admin-password -- --email <dienstliche-e-mail>");
  }
  return argumentsList[1];
}

try {
  const passwordLink = resetSystemAdminPassword({
    databasePath: process.env.DATABASE_URL ?? "",
    email: parseEmailArgument(process.argv.slice(2)),
    baseUrl: process.env.BETTER_AUTH_URL ?? "",
    authSecret: process.env.BETTER_AUTH_SECRET ?? "",
  });
  process.stdout.write(`${passwordLink}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  process.stderr.write(`Das Passwort des Systemadministrationskontos wurde nicht zurückgesetzt: ${message}\n`);
  process.exitCode = 1;
}
