import { bootstrapInitialSystemAdmin } from "../lib/services/initial-admin.mjs";

function parseEmailArgument(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--email" || !argumentsList[1]) {
    throw new Error("Aufruf: npm run bootstrap:admin -- --email <dienstliche-e-mail>");
  }
  return argumentsList[1];
}

try {
  const passwordLink = bootstrapInitialSystemAdmin({
    databasePath: process.env.DATABASE_URL ?? "",
    email: parseEmailArgument(process.argv.slice(2)),
    baseUrl: process.env.BETTER_AUTH_URL ?? "",
    authSecret: process.env.BETTER_AUTH_SECRET ?? "",
  });
  process.stdout.write(`${passwordLink}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  process.stderr.write(`Initiales Systemadministrationskonto wurde nicht angelegt: ${message}\n`);
  process.exitCode = 1;
}
