import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { assertAreaEditPermission } from "@/lib/services/authorization";
import { assertCourseFitsBlockPlan } from "@/lib/services/course-assignment";
import { clearCourseFromDraft, touchDraft } from "@/lib/services/draft-changes";

export const maximumCoursesPerBlockPlan = 20;
const maximumNameLength = 160;

type CourseRow = { id: string; code: string; blockPlanId: string | null; areaId: string; semesters: number; studyStart: string };
type PlanRow = { id: string; areaId: string };

export type AttachableCourse = { id: string; code: string; program: string; studyStart: string; studyEnd: string };

/** Creates a block plan and assigns its first course in one transaction (FACHLICHE_REGELN.md: both are a single operation). */
export function createBlockPlanFromCourse(sqlite: Database.Database, input: { accountId: string; courseId: string; now?: Date }): string {
  const now = input.now ?? new Date();
  return sqlite.transaction(() => {
    const course = requireCourse(sqlite, input.courseId);
    assertAreaEditPermission(sqlite, input.accountId, course.areaId);
    if (course.blockPlanId) throw new Error("Der Kurs ist bereits einem Blockplan zugeordnet. Lösen Sie ihn zuerst.");
    const blockPlanId = randomUUID();
    sqlite.prepare(`INSERT INTO block_plans (id, area_id, name, normalized_name, has_ever_been_published, draft_updated_at, draft_updated_by_account_id)
      VALUES (?, ?, NULL, NULL, 0, ?, ?)`).run(blockPlanId, course.areaId, now.toISOString(), input.accountId);
    sqlite.prepare("UPDATE courses SET block_plan_id = ? WHERE id = ?").run(blockPlanId, input.courseId);
    return blockPlanId;
  })();
}

/** Assigns a further course to an existing block plan; area, year, study duration and the maximum number of courses are enforced. */
export function attachCourse(sqlite: Database.Database, input: { accountId: string; blockPlanId: string; courseId: string; now?: Date }): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const plan = requirePlan(sqlite, input.blockPlanId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    const course = requireCourse(sqlite, input.courseId);
    if (course.blockPlanId) throw new Error("Der Kurs ist bereits einem Blockplan zugeordnet. Lösen Sie ihn zuerst.");
    assertBelowMaximum(sqlite, plan.id);
    assertCourseFitsBlockPlan(sqlite, plan.id, course);
    sqlite.prepare("UPDATE courses SET block_plan_id = ? WHERE id = ?").run(input.blockPlanId, input.courseId);
    touchDraft(sqlite, input.blockPlanId, input.accountId, now);
  })();
}

/** Sets or clears the optional designation of a block plan; an empty designation falls back to the derived name. */
export function renameBlockPlan(sqlite: Database.Database, input: { accountId: string; blockPlanId: string; name: string; now?: Date }): void {
  const now = input.now ?? new Date();
  const name = normalizeName(input.name);
  sqlite.transaction(() => {
    const plan = requirePlan(sqlite, input.blockPlanId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    const normalizedName = name?.toLocaleLowerCase("de-DE") ?? null;
    if (normalizedName) {
      const existing = sqlite.prepare("SELECT id FROM block_plans WHERE area_id = ? AND normalized_name = ?").get(plan.areaId, normalizedName) as { id: string } | undefined;
      if (existing && existing.id !== plan.id) throw new Error("Diese Blockplanbezeichnung ist im Bereich bereits vergeben.");
    }
    sqlite.prepare("UPDATE block_plans SET name = ?, normalized_name = ? WHERE id = ?").run(name, normalizedName, plan.id);
    touchDraft(sqlite, plan.id, input.accountId, now);
  })();
}

/** Detaches a course from its block plan; the last course of a block plan stays assigned (delete the block plan instead). */
export function detachCourse(sqlite: Database.Database, input: { accountId: string; blockPlanId: string; courseId: string; now?: Date }): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const plan = requirePlan(sqlite, input.blockPlanId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    const course = requireCourse(sqlite, input.courseId);
    if (course.blockPlanId !== plan.id) throw new Error("Der Kurs gehört nicht diesem Blockplan an.");
    const assigned = (sqlite.prepare("SELECT COUNT(*) AS count FROM courses WHERE block_plan_id = ?").get(plan.id) as { count: number }).count;
    if (assigned <= 1) throw new Error("Der letzte Kurs eines Blockplans kann nicht gelöst werden. Löschen Sie stattdessen den Blockplan.");
    clearCourseFromDraft(sqlite, plan.id, course.id);
    sqlite.prepare("UPDATE courses SET block_plan_id = NULL WHERE id = ?").run(course.id);
    touchDraft(sqlite, plan.id, input.accountId, now);
  })();
}

/** The unassigned courses a block plan may take on: same area, same year and same study duration as its current courses. */
export function listAttachableCourses(sqlite: Database.Database, blockPlanId: string): AttachableCourse[] {
  return sqlite.prepare(`SELECT course.id, course.code, program.name AS program, course.study_start AS studyStart, course.study_end AS studyEnd
    FROM courses course JOIN programs program ON program.id = course.program_id
    JOIN block_plans plan ON plan.id = ?
    WHERE course.block_plan_id IS NULL
      AND program.area_id = plan.area_id
      AND NOT EXISTS (SELECT 1 FROM courses assigned JOIN programs assignedProgram ON assignedProgram.id = assigned.program_id
        WHERE assigned.block_plan_id = plan.id
          AND (substr(assigned.study_start, 1, 4) <> substr(course.study_start, 1, 4)
            OR assignedProgram.semesters <> program.semesters))
    ORDER BY course.code COLLATE NOCASE`).all(blockPlanId) as AttachableCourse[];
}

/** Deletes a block plan without a published version; its courses stay and become unassigned. */
export function deleteBlockPlan(sqlite: Database.Database, input: { accountId: string; blockPlanId: string }): void {
  sqlite.transaction(() => {
    const plan = requirePlan(sqlite, input.blockPlanId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    const published = sqlite.prepare("SELECT id FROM published_versions WHERE block_plan_id = ?").get(plan.id);
    if (published) throw new Error("Ein Blockplan mit veröffentlichter Fassung kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung zuerst zurück.");
    sqlite.prepare("UPDATE courses SET block_plan_id = NULL WHERE block_plan_id = ?").run(plan.id);
    sqlite.prepare("DELETE FROM block_plans WHERE id = ?").run(plan.id);
  })();
}

function assertBelowMaximum(sqlite: Database.Database, blockPlanId: string): void {
  const assigned = (sqlite.prepare("SELECT COUNT(*) AS count FROM courses WHERE block_plan_id = ?").get(blockPlanId) as { count: number }).count;
  if (assigned >= maximumCoursesPerBlockPlan) throw new Error(`Ein Blockplan enthält höchstens ${maximumCoursesPerBlockPlan} Kurse.`);
}

function normalizeName(value: string): string | null {
  // Human-readable designations collapse interior whitespace for the displayed value (FACHLICHE_REGELN.md).
  const name = value.trim().replace(/\s+/gu, " ");
  if (!name) return null;
  if ([...name].length > maximumNameLength) throw new Error(`Die Blockplanbezeichnung darf höchstens ${maximumNameLength} Zeichen lang sein.`);
  return name;
}

function requirePlan(sqlite: Database.Database, blockPlanId: string): PlanRow {
  const plan = sqlite.prepare("SELECT id, area_id AS areaId FROM block_plans WHERE id = ?").get(blockPlanId) as PlanRow | undefined;
  if (!plan) throw new Error("Der Blockplan wurde nicht gefunden.");
  return plan;
}

function requireCourse(sqlite: Database.Database, courseId: string): CourseRow {
  const course = sqlite.prepare(`SELECT course.id, course.code, course.block_plan_id AS blockPlanId, course.study_start AS studyStart,
      program.area_id AS areaId, program.semesters
    FROM courses course JOIN programs program ON program.id = course.program_id WHERE course.id = ?`).get(courseId) as CourseRow | undefined;
  if (!course) throw new Error("Der Kurs wurde nicht gefunden.");
  return course;
}
