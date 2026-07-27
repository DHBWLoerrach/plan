import { normalizeEmail } from "../domain/account-email.mjs";
import { assertAuthSecret, issuePasswordLink, normalizeBaseUrl, openOperationalDatabase } from "./admin-command.mjs";

/**
 * @typedef {object} EmergencyAdminResetInput
 * @property {string} databasePath
 * @property {string} email
 * @property {string} baseUrl
 * @property {string} authSecret
 */

/**
 * Resets the password of an existing system administration account when the only administrative
 * access is lost. Unlike the application, this command may leave the last active system
 * administration account waiting for password assignment. It creates no account and grants no
 * permission, so a locked account has to be unlocked in the application instead.
 *
 * @param {EmergencyAdminResetInput} input
 * @returns {string} A one-time password link whose token is only in the URL fragment.
 */
export function resetSystemAdminPassword(input) {
  const email = normalizeEmail(input.email);
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  assertAuthSecret(input.authSecret);

  const sqlite = openOperationalDatabase(input.databasePath);
  try {
    const now = new Date();
    return sqlite.transaction(() => {
      const account = sqlite.prepare("SELECT id, system_admin AS systemAdmin, status FROM user WHERE email = ?").get(email);
      if (!account) throw new Error("Für diese E-Mail-Adresse existiert kein internes Konto.");
      if (!account.systemAdmin) throw new Error("Das Konto besitzt keine Systemadministration. Der Notfallbefehl vergibt keine Rechte.");
      if (account.status === "LOCKED") throw new Error("Ein gesperrtes Konto muss in der Anwendung freigegeben werden.");

      sqlite.prepare("DELETE FROM account WHERE userId = ? AND providerId = 'credential'").run(account.id);
      sqlite.prepare("DELETE FROM session WHERE userId = ?").run(account.id);
      sqlite.prepare("UPDATE user SET status = 'PASSWORD_PENDING', updatedAt = ? WHERE id = ?").run(now.getTime(), account.id);
      return issuePasswordLink(sqlite, account.id, baseUrl, now);
    })();
  } finally {
    sqlite.close();
  }
}
