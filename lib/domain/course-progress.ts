/**
 * Where a course stands on a given day. The internal overview reads it for every course at once, so it is derived
 * here rather than in the view: the planning state of a course may hold gaps — that its phases meet without one is a
 * Veröffentlichungsregel, not a Strukturregel — and a day may therefore fall into no phase at
 * all, before the first or after the last.
 */
import { formatCalendarDay } from "@/lib/domain/calendar-format";
import { phaseTypeLabel, type PhaseType } from "@/lib/domain/phase-type";

/** A course phase reduced to what standing is read from: when it runs, in which semester and of which type. */
export type StandingPhase = { semester: number; type: PhaseType; startDate: string; endDate: string };

export type CourseStanding = {
  /** Where the course stands today, always named — a course out of every phase says so rather than staying blank. */
  currentPhase: string;
  /** The phase that follows, `null` once none does. */
  nextPhase: string | null;
};

/** A phase as the overview names it: „Theorie im 3. Semester“. */
export function phaseSemesterLabel(phase: StandingPhase): string {
  return `${phaseTypeLabel(phase.type)} im ${phase.semester}. Semester`;
}

export function courseStanding(course: { studyStart: string; studyEnd: string }, phases: StandingPhase[], today: string): CourseStanding {
  const ordered = [...phases].sort((left, right) => left.startDate.localeCompare(right.startDate));
  const next = ordered.find((phase) => phase.startDate > today) ?? null;
  return { currentPhase: currentPhaseLabel(course, ordered, today), nextPhase: next && `ab ${formatCalendarDay(next.startDate)} ${phaseSemesterLabel(next)}` };
}

/**
 * The study period decides „not yet begun“ and „finished“ rather than the phases, because an incomplete planning
 * state whose phases stop short of the study end would otherwise report a course as over while it still runs.
 */
function currentPhaseLabel(course: { studyStart: string; studyEnd: string }, ordered: StandingPhase[], today: string): string {
  if (today < course.studyStart) return "Noch nicht begonnen";
  if (today > course.studyEnd) return "Studium beendet";
  const current = ordered.find((phase) => phase.startDate <= today && today <= phase.endDate);
  return current ? phaseSemesterLabel(current) : "Zurzeit keine Kursphase";
}
