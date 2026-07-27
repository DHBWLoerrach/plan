/**
 * How the sign-in address of an internal account is normalised and checked. The application
 * (`lib/services/account-admin.ts`) and the operational commands (`lib/services/admin-command.mjs`)
 * both address accounts by e-mail and have to agree on it: a command that accepted an address the
 * application rejects would create an account nobody can edit afterwards, and one that normalised
 * differently would look up a different row than the one the administration sees.
 *
 * JavaScript rather than TypeScript because the operational commands run through `node` without a
 * build step, the same reason `lib/db/migration-order.mjs` gives.
 */

const maximumEmailLength = 254;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * @param {unknown} value
 * @returns {string} The trimmed, lower-cased address.
 */
export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!emailPattern.test(email)) throw new Error("Eine gültige dienstliche E-Mail-Adresse ist erforderlich.");
  if ([...email].length > maximumEmailLength) throw new Error("Die dienstliche E-Mail-Adresse ist zu lang.");
  return email;
}
