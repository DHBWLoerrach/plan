/**
 * How migrations are named and ordered. The running application (`lib/db/migrations.ts`) and the
 * operational command (`lib/services/database-maintenance.mjs`) read the migration directory
 * separately — the bundler can only trace file access whose directory it resolves statically — but
 * they must agree on the order. Otherwise the command applies migrations in one order while the
 * application reports them in another, and the operator logs a state that never existed.
 */

const migrationFileName = /^(\d+)_.+\.sql$/u;

/**
 * @param {string} fileName
 * @returns {boolean}
 */
export function isMigrationFileName(fileName) {
  return migrationFileName.test(fileName);
}

/**
 * Orders by version number, not as text: sorted as text, "10_" would come before "2_". Two
 * migrations sharing a number fall back to their full name, so the order does not depend on the
 * order the file system happens to return.
 *
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareMigrationIds(left, right) {
  const byVersion = Number.parseInt(left, 10) - Number.parseInt(right, 10);
  if (byVersion !== 0) return byVersion;
  return left < right ? -1 : left > right ? 1 : 0;
}
