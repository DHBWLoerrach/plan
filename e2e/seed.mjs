import { createHash } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

import { hashPassword } from "better-auth/crypto";
import Database from "better-sqlite3";

import { applyPendingMigrations } from "../lib/services/database-maintenance.mjs";

const databasePath = path.join(process.cwd(), "data", "e2e.sqlite");
const now = Date.now();
const password = "Ein-sicheres-Testpasswort1!";

for (const suffix of ["", "-wal", "-shm"]) {
  const file = `${databasePath}${suffix}`;
  if (existsSync(file)) rmSync(file);
}
applyPendingMigrations({ databasePath, migrationsDirectory: path.join(process.cwd(), "migrations") });

const sqlite = new Database(databasePath);
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-own', 'Eigener Bereich', 'eigener bereich'), ('area-foreign', 'Fremder Bereich', 'fremder bereich');
    -- Abbreviations outside the shipped master data of lib/db/seed.ts: that seed addresses a study program by its
    -- abbreviation and would otherwise adopt one of these fixtures as its own row on the first application start.
    INSERT INTO programs VALUES ('program-own', 'area-own', 'Testinformatik', 'E2E', 6), ('program-foreign', 'area-foreign', 'Fremdinformatik', 'FRM', 6);
  `);
  const addUser = sqlite.prepare(`INSERT INTO users
    (id, name, email, email_verified, role, system_admin, status, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`);
  addUser.run("password-link-user", "Link User", "link@test.invalid", "NONE", 1, "PASSWORD_PENDING", now, now);
  addUser.run("system-admin", "System Admin", "admin@test.invalid", "NONE", 1, "ACTIVE", now, now);
  addUser.run("area-editor", "Area Editor", "editor@test.invalid", "AREA_EDITOR", 0, "ACTIVE", now, now);
  sqlite.prepare("INSERT INTO area_assignments VALUES ('area-editor', 'area-own')").run();
  const passwordHash = await hashPassword(password);
  const addCredential = sqlite.prepare(`INSERT INTO accounts
    (id, account_id, provider_id, user_id, password, created_at, updated_at)
    VALUES (?, ?, 'credential', ?, ?, ?, ?)`);
  addCredential.run("admin-credential", "system-admin", "system-admin", passwordHash, now, now);
  addCredential.run("editor-credential", "area-editor", "area-editor", passwordHash, now, now);
  const linkToken = "e2e-password-link-token";
  sqlite.prepare(`INSERT INTO password_links (id, user_id, token_hash, expires_at, created_at)
    VALUES ('e2e-password-link', 'password-link-user', ?, '2099-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`)
    .run(createHash("sha256").update(linkToken).digest("hex"));
  const insertCourse = sqlite.prepare(`INSERT INTO courses
    (id, program_id, code, normalized_code, study_start, study_end, published_at, updated_at, updated_by_account_id)
    VALUES (?, ?, ?, ?, ?, ?, NULL, '2026-01-01T00:00:00.000Z', 'system-admin')`);
  insertCourse.run("e2e-course", "program-own", "TIF26E2E", "tif26e2e", "2026-10-01", "2029-09-30");
  insertCourse.run("e2e-foreign-course", "program-foreign", "FRM26E2E", "frm26e2e", "2026-10-01", "2029-09-30");
  // Seed enough courses for both selectors, with earlier cohorts outside the 2026 comparisons.
  for (let number = 1; number <= 14; number++) {
    insertCourse.run(`e2e-running-${number}`, "program-foreign", `FRM25E2E${number}`, `frm25e2e${number}`, "2025-10-01", "2029-09-30");
  }
  for (let number = 1; number <= 4; number++) {
    insertCourse.run(`e2e-earlier-${number}`, "program-foreign", `FRM20E2E${number}`, `frm20e2e${number}`, "2020-10-01", "2023-09-30");
  }
  const addPhase = sqlite.prepare(`INSERT INTO course_phases
    (id, course_id, semester, phase_type, start_date, end_date) VALUES (?, 'e2e-course', ?, ?, ?, ?)`);
  [
    [1, "THEORY", "2026-10-01", "2027-03-31"], [2, "PRACTICE", "2027-04-01", "2027-09-30"],
    [3, "THEORY", "2027-10-01", "2028-03-31"], [4, "PRACTICE", "2028-04-01", "2028-09-30"],
    [5, "THEORY", "2028-10-01", "2029-03-31"], [6, "PRACTICE", "2029-04-01", "2029-09-30"],
  ].forEach(([semester, type, startDate, endDate]) => addPhase.run(`phase-${semester}`, semester, type, startDate, endDate));
} finally {
  sqlite.close();
}
