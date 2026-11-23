import "server-only";

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

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Die Aktion konnte nicht ausgeführt werden.";
}
