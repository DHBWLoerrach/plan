import "server-only";

import Database from "better-sqlite3";

import { getActiveAccount } from "@/lib/internal-auth";

/**
 * The first statement of every attempt, before anything is read from the database. A server action is a public
 * endpoint: whoever holds its identifier reaches it without ever passing the page, whose permission check therefore
 * guards nothing here. A refusal that reported on stored data before the session was established would answer
 * questions about the course inventory to a caller who is not signed in at all.
 */
export async function requireAccountId() {
  const account = await getActiveAccount();
  if (!account) throw new Error("Ihre Sitzung ist nicht mehr gültig.");
  return account.id;
}

const genericFailure = "Die Aktion konnte nicht ausgeführt werden.";

// SQLite's own wording names locks, tables and constraints, none of which a person can act on. The log keeps it, so
// recurring busy errors stay visible to operations (ARCHITEKTUR_UND_BETRIEB.md).
export function databaseErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof Database.SqliteError)) return undefined;
  console.error(error);
  return error.code.startsWith("SQLITE_BUSY")
    ? "Die Daten werden gerade an anderer Stelle geändert. Bitte versuchen Sie es in einem Moment erneut."
    : genericFailure;
}

export function errorMessage(error: unknown) {
  return databaseErrorMessage(error) ?? (error instanceof Error ? error.message : genericFailure);
}
