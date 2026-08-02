import { inclusiveDays, plusDays } from "@/lib/domain/calendar-day";
import type { EventCategory } from "@/lib/domain/event-category";
import type { PhaseType } from "@/lib/domain/phase-type";

const daysPerWeek = 7;

export type TemplatePhase = { semester: number; type: PhaseType; startDate: string; endDate: string };
export type TemplateEvent = { title: string; description: string | null; category: EventCategory; startDate: string; endDate: string | null; provisional: boolean };
export type AdoptionTemplate = { studyStart: string; studyEnd: string; phases: TemplatePhase[]; events: TemplateEvent[] };
export type AdoptionTarget = { studyStart: string; studyEnd: string; withPhases: boolean; withEvents: boolean };
export type AdoptedPhase = TemplatePhase & { truncated: boolean };
export type CourseAdoption = {
  shiftDays: number;
  shiftWeeks: number;
  phases: AdoptedPhase[];
  events: TemplateEvent[];
  /** Phases the study period of the new course leaves no day for. They are not adopted, and the preview names them. */
  droppedPhases: TemplatePhase[];
};

/**
 * The shift of an adoption: the difference of the two study starts, rounded to the nearest multiple of seven days.
 *
 * The rounding settles a conflict of two anchors. A study period is anchored to dates — 1 October to 30 September —
 * while course phases are anchored to weekdays, because theory blocks start on a Monday and end on a Friday or Sunday.
 * A shift cannot preserve both. Rounding keeps the weekdays and lets the borders of the study period miss by up to
 * three days; those few phases are cut, which is two corrections instead of forty.
 */
export function adoptionShiftDays(templateStudyStart: string, studyStart: string): number {
  const difference = inclusiveDays(templateStudyStart, studyStart) - 1;
  const weeks = Math.round(difference / daysPerWeek);
  // Rounding a small negative difference down to no week at all yields -0, and a shift of no days has no direction.
  return weeks === 0 ? 0 : weeks * daysPerWeek;
}

/** The study end an adoption proposes: the study period of the template, in days, measured from the new study start. */
export function proposedStudyEnd(template: { studyStart: string; studyEnd: string }, studyStart: string): string {
  return plusDays(studyStart, inclusiveDays(template.studyStart, template.studyEnd) - 1);
}

/**
 * What an adoption would produce, without touching any store: the shift, the adopted course progression and the
 * adopted events. Both the preview shown before saving and the creation itself read it, so what a person confirms is
 * what is written.
 */
export function planAdoption(template: AdoptionTemplate, target: AdoptionTarget): CourseAdoption {
  const shiftDays = adoptionShiftDays(template.studyStart, target.studyStart);
  const phases: AdoptedPhase[] = [];
  const droppedPhases: TemplatePhase[] = [];
  for (const phase of target.withPhases ? template.phases : []) {
    const shifted = { ...phase, startDate: plusDays(phase.startDate, shiftDays), endDate: plusDays(phase.endDate, shiftDays) };
    const startDate = shifted.startDate < target.studyStart ? target.studyStart : shifted.startDate;
    const endDate = shifted.endDate > target.studyEnd ? target.studyEnd : shifted.endDate;
    // A phase whose shifted period misses the study period entirely cannot be cut to a boundary it never reaches.
    if (startDate > endDate) droppedPhases.push(shifted);
    else phases.push({ ...shifted, startDate, endDate, truncated: startDate !== shifted.startDate || endDate !== shifted.endDate });
  }
  // Events are shifted but never cut: one outside the study period is a publication rule and stays allowed in the
  // planning state until publication names it.
  const events = (target.withEvents ? template.events : []).map((event) => ({
    ...event,
    startDate: plusDays(event.startDate, shiftDays),
    endDate: event.endDate && plusDays(event.endDate, shiftDays),
  }));
  return { shiftDays, shiftWeeks: shiftDays / daysPerWeek, phases, events, droppedPhases };
}
