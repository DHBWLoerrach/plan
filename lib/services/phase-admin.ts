import { randomUUID } from 'node:crypto';

import type Database from 'better-sqlite3';

import { normalizeCalendarDayField } from '@/lib/domain/calendar-day';
import { FieldError } from '@/lib/domain/field-error';
import { type PhaseType, isPhaseType } from '@/lib/domain/phase-type';
import { assertAreaEditPermission } from '@/lib/services/authorization';
import {
  requireCoursesOfBlockPlan,
  touchDraft,
} from '@/lib/services/draft-changes';

export type PhaseField =
  | 'courseIds'
  | 'semester'
  | 'type'
  | 'startDate'
  | 'endDate';

export type PhaseDetails = {
  semester: string;
  type: string;
  startDate: string;
  endDate: string;
};

export type PhaseInput = PhaseDetails & { courseIds: string[] };

type NormalizedPhase = {
  semester: number;
  type: PhaseType;
  startDate: string;
  endDate: string;
};
type PlanRow = { id: string; areaId: string; semesters: number };
type CourseStudyPeriod = { studyStart: string; studyEnd: string };

/**
 * Creates one course phase per selected course. The phases start out with equal details but stay independent: they
 * share no identity, so a later change affects only the phase being edited (FACHLICHE_REGELN.md).
 */
export function createDraftPhases(
  sqlite: Database.Database,
  input: { accountId: string; blockPlanId: string; now?: Date } & PhaseInput,
): string[] {
  const now = input.now ?? new Date();
  return sqlite.transaction(() => {
    const plan = requirePlan(sqlite, input.blockPlanId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    const courseIds = requireCoursesOfBlockPlan(sqlite, {
      blockPlanId: plan.id,
      courseIds: input.courseIds,
      field: 'courseIds' satisfies PhaseField,
      emptyMessage: 'Wählen Sie mindestens einen Kurs für die Kursphase.',
      foreignMessage: 'Ein ausgewählter Kurs gehört nicht zu diesem Blockplan.',
    });
    const phase = normalizePhaseDetails(input, plan.semesters);
    const periods = readCourseStudyPeriods(sqlite, courseIds);
    assertPhaseWithinStudyPeriod(phase, periods);
    const ids: string[] = [];
    const addPhase =
      sqlite.prepare(`INSERT INTO draft_phases (id, block_plan_id, course_id, semester, phase_type, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const courseId of courseIds) {
      const id = randomUUID();
      ids.push(id);
      addPhase.run(
        id,
        plan.id,
        courseId,
        phase.semester,
        phase.type,
        phase.startDate,
        phase.endDate,
      );
    }
    touchDraft(sqlite, plan.id, input.accountId, now);
    return ids;
  })();
}

/** Changes one saved course phase. Its course stays; only the edited phase changes, never a jointly created sibling. */
export function updateDraftPhase(
  sqlite: Database.Database,
  input: { accountId: string; phaseId: string; now?: Date } & PhaseDetails,
): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const plan = requirePlanOfPhase(sqlite, input.phaseId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    const phase = normalizePhaseDetails(input, plan.semesters);
    const period = readPhaseCourseStudyPeriod(sqlite, input.phaseId);
    assertPhaseWithinStudyPeriod(phase, [period]);
    sqlite
      .prepare(
        'UPDATE draft_phases SET semester = ?, phase_type = ?, start_date = ?, end_date = ? WHERE id = ?',
      )
      .run(
        phase.semester,
        phase.type,
        phase.startDate,
        phase.endDate,
        input.phaseId,
      );
    touchDraft(sqlite, plan.id, input.accountId, now);
  })();
}

/** Deletes one course phase from the draft; the published version stays untouched until the next publication. */
export function deleteDraftPhase(
  sqlite: Database.Database,
  input: { accountId: string; phaseId: string; now?: Date },
): void {
  const now = input.now ?? new Date();
  sqlite.transaction(() => {
    const plan = requirePlanOfPhase(sqlite, input.phaseId);
    assertAreaEditPermission(sqlite, input.accountId, plan.areaId);
    sqlite.prepare('DELETE FROM draft_phases WHERE id = ?').run(input.phaseId);
    touchDraft(sqlite, plan.id, input.accountId, now);
  })();
}

/**
 * The block plan with the number of semesters derived from its courses. Every assigned course shares that number
 * (FACHLICHE_REGELN.md), so any of them answers for the block plan.
 */
function requirePlan(sqlite: Database.Database, blockPlanId: string): PlanRow {
  const plan = sqlite
    .prepare(
      `SELECT plan.id, plan.area_id AS areaId,
      (SELECT program.semesters FROM courses course JOIN programs program ON program.id = course.program_id
        WHERE course.block_plan_id = plan.id LIMIT 1) AS semesters
    FROM block_plans plan WHERE plan.id = ?`,
    )
    .get(blockPlanId) as PlanRow | undefined;
  if (!plan) throw new Error('Der Blockplan wurde nicht gefunden.');
  return plan;
}

function requirePlanOfPhase(
  sqlite: Database.Database,
  phaseId: string,
): PlanRow {
  const plan = sqlite
    .prepare(
      `SELECT plan.id, plan.area_id AS areaId,
      (SELECT program.semesters FROM courses course JOIN programs program ON program.id = course.program_id
        WHERE course.block_plan_id = plan.id LIMIT 1) AS semesters
    FROM draft_phases phase JOIN block_plans plan ON plan.id = phase.block_plan_id WHERE phase.id = ?`,
    )
    .get(phaseId) as PlanRow | undefined;
  if (!plan) throw new Error('Die Kursphase wurde nicht gefunden.');
  return plan;
}

function normalizePhaseDetails(
  input: PhaseDetails,
  semesters: number,
): NormalizedPhase {
  const semester = Number(input.semester.trim());
  if (!Number.isInteger(semester) || semester < 1 || semester > semesters) {
    throw new FieldError(
      'semester',
      `Das Semester muss eine ganze Zahl von 1 bis ${semesters} sein.`,
    );
  }
  if (!isPhaseType(input.type))
    throw new FieldError(
      'type',
      'Der Phasentyp muss Theorie oder Praxis sein.',
    );
  const startDate = normalizeCalendarDayField(
    input.startDate,
    'startDate',
    'Das Startdatum',
  );
  const endDate = normalizeCalendarDayField(
    input.endDate,
    'endDate',
    'Das Enddatum',
  );
  if (endDate < startDate)
    throw new FieldError(
      'endDate',
      'Das Enddatum darf nicht vor dem Startdatum liegen.',
    );
  return { semester, type: input.type, startDate, endDate };
}

function assertPhaseWithinStudyPeriod(
  phase: NormalizedPhase,
  periods: CourseStudyPeriod[],
): void {
  for (const period of periods) {
    if (phase.startDate < period.studyStart) {
      throw new FieldError(
        'startDate',
        'Der Zeitraum muss innerhalb des Studienzeitraums des Kurses liegen.',
      );
    }
    if (phase.endDate > period.studyEnd) {
      throw new FieldError(
        'endDate',
        'Der Zeitraum muss innerhalb des Studienzeitraums des Kurses liegen.',
      );
    }
  }
}

function readCourseStudyPeriods(
  sqlite: Database.Database,
  courseIds: string[],
): CourseStudyPeriod[] {
  const readPeriod = sqlite.prepare(
    'SELECT study_start AS studyStart, study_end AS studyEnd FROM courses WHERE id = ?',
  );
  return courseIds.map(
    (courseId) => readPeriod.get(courseId) as CourseStudyPeriod,
  );
}

function readPhaseCourseStudyPeriod(
  sqlite: Database.Database,
  phaseId: string,
): CourseStudyPeriod {
  return sqlite
    .prepare(
      `SELECT course.study_start AS studyStart, course.study_end AS studyEnd
      FROM draft_phases phase JOIN courses course ON course.id = phase.course_id WHERE phase.id = ?`,
    )
    .get(phaseId) as CourseStudyPeriod;
}
