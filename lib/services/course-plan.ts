import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { normalizeCalendarDay, plusDays } from "@/lib/domain/calendar-day";
import { isPhaseType, type PhaseType } from "@/lib/domain/phase-type";

/** A course phase of a generated progression as it arrives from the creation form, still unchecked. */
export type CoursePlanInput = { semester: unknown; type: unknown; startDate: unknown; endDate: unknown };
type CheckedPhase = { semester: number; type: PhaseType; startDate: string; endDate: string };

/**
 * Writes the generated course progression of a smart creation. It runs inside the transaction of the creation, so a
 * course and its progression are written together or not at all (FACHLICHE_REGELN.md).
 *
 * The form may adjust the generated phases before saving, so what arrives is checked here rather than trusted: a smart
 * creation promises a gapless progression over the whole study period, and that promise is kept by the server.
 */
export function writeCoursePlan(sqlite: Database.Database, input: {
  courseId: string;
  studyStart: string;
  studyEnd: string;
  semesters: number;
  phases: CoursePlanInput[];
}): void {
  const phases = checkPlan(input);
  const add = sqlite.prepare("INSERT INTO course_phases (id, course_id, semester, phase_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)");
  for (const phase of phases) add.run(randomUUID(), input.courseId, phase.semester, phase.type, phase.startDate, phase.endDate);
}

/** The generated progression, checked against the study period it belongs to. */
export function checkPlan(input: { studyStart: string; studyEnd: string; semesters: number; phases: CoursePlanInput[] }): CheckedPhase[] {
  if (!Array.isArray(input.phases) || !input.phases.length) throw new Error("Der Studienplan enthält keine Kursphasen.");
  const phases = input.phases.map((phase) => checkPhase(phase, input.semesters));
  if (phases[0].startDate !== input.studyStart) throw new Error("Die erste Kursphase muss am Studienbeginn beginnen.");
  if (phases[phases.length - 1].endDate !== input.studyEnd) throw new Error("Die letzte Kursphase muss am Studienende enden.");
  for (let index = 1; index < phases.length; index++) {
    const previous = phases[index - 1];
    const phase = phases[index];
    if (phase.startDate !== plusDays(previous.endDate, 1)) throw new Error("Die Kursphasen müssen lückenlos aneinander anschließen und dürfen sich nicht überlappen.");
    if (phase.semester < previous.semester) throw new Error("Die Semester müssen entlang der Zeitachse aufsteigen.");
  }
  return phases;
}

function checkPhase(phase: CoursePlanInput, semesters: number): CheckedPhase {
  const semester = Number(phase.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > semesters) throw new Error(`Das Semester muss eine ganze Zahl von 1 bis ${semesters} sein.`);
  if (typeof phase.type !== "string" || !isPhaseType(phase.type)) throw new Error("Der Phasentyp muss Theorie oder Praxis sein.");
  const startDate = normalizeCalendarDay(String(phase.startDate ?? ""), "Das Startdatum einer Kursphase");
  const endDate = normalizeCalendarDay(String(phase.endDate ?? ""), "Das Enddatum einer Kursphase");
  if (endDate < startDate) throw new Error("Das Enddatum einer Kursphase darf nicht vor ihrem Startdatum liegen.");
  return { semester, type: phase.type, startDate, endDate };
}
