import { inclusiveDays, plusDays, plusMonths } from "@/lib/domain/calendar-day";
import { nextYearCourseCode } from "@/lib/domain/generated-course-plan";
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
  /** Whether the progression was put onto the start or the end of the new study period instead of merely shifted there. */
  movedToStudyStart: boolean;
  movedToStudyEnd: boolean;
};

/**
 * The shift of an adoption: the difference of the two study starts, rounded to the nearest multiple of seven days.
 *
 * The rounding settles a conflict of two anchors. A study period is anchored to dates — 1 October to 30 September —
 * while course phases are anchored to weekdays, because theory blocks start on a Monday and end on a Friday or Sunday.
 * A shift cannot preserve both. Rounding keeps the weekdays and lets the borders of the study period miss by up to
 * three days. `planAdoption` puts the two outer days of the progression back onto those borders, so neither needs
 * correcting where the template began and ended with its study period.
 */
export function adoptionShiftDays(templateStudyStart: string, studyStart: string): number {
  const difference = inclusiveDays(templateStudyStart, studyStart) - 1;
  const weeks = Math.round(difference / daysPerWeek);
  // Rounding a small negative difference down to no week at all yields -0, and a shift of no days has no direction.
  return weeks === 0 ? 0 : weeks * daysPerWeek;
}

/** What the adoption form is filled with before anyone has typed. Every value is a proposal and stays editable. */
export type AdoptionProposal = { code: string; studyStart: string; studyEnd: string };

/**
 * The same course for the following year, which is what most adoptions are: its code counted up by one year and its
 * study period moved by twelve months. The period is moved by the calendar rather than by its length in days, because
 * it is anchored to dates — 1 October to 30 September stays that across a leap year. The code is left empty where it
 * names no year to count up.
 */
export function nextYearProposal(template: { code: string; studyStart: string; studyEnd: string }, today: string): AdoptionProposal {
  return { code: nextYearCourseCode(template.code, today) ?? "", studyStart: plusMonths(template.studyStart, 12), studyEnd: plusMonths(template.studyEnd, 12) };
}

/** The study end an adoption proposes: the study period of the template, in days, measured from the new study start. */
export function proposedStudyEnd(template: { studyStart: string; studyEnd: string }, studyStart: string): string {
  return plusDays(studyStart, inclusiveDays(template.studyStart, template.studyEnd) - 1);
}

/**
 * Whether an edge of the adopted progression is moved onto the edge of the new study period. A study period is
 * anchored to dates — a study year begins on 1 October — while the shift keeps the weekdays, so a phase that began
 * with the study period of the template arrives up to a few days beside the new one. It is put back where it was
 * anchored: on the boundary. Only the remainder of the rounding is closed this way, which is always less than a week;
 * a boundary further off was set that way by whoever chose the study period, and stays a gap for them to see.
 */
function anchors(shifted: string, boundary: string): boolean {
  return Math.abs(inclusiveDays(shifted < boundary ? shifted : boundary, shifted < boundary ? boundary : shifted) - 1) < daysPerWeek;
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
  let movedToStudyStart = false;
  let movedToStudyEnd = false;
  for (const phase of target.withPhases ? template.phases : []) {
    const shifted = { ...phase, startDate: plusDays(phase.startDate, shiftDays), endDate: plusDays(phase.endDate, shiftDays) };
    // The inner days of a progression follow the weekdays; its two outer days follow the study period they were set on.
    const startsStudy = phase.startDate === template.studyStart && anchors(shifted.startDate, target.studyStart);
    const endsStudy = phase.endDate === template.studyEnd && anchors(shifted.endDate, target.studyEnd);
    const wantedStart = startsStudy ? target.studyStart : shifted.startDate;
    const wantedEnd = endsStudy ? target.studyEnd : shifted.endDate;
    const startDate = wantedStart < target.studyStart ? target.studyStart : wantedStart;
    const endDate = wantedEnd > target.studyEnd ? target.studyEnd : wantedEnd;
    // A phase whose shifted period misses the study period entirely cannot be cut to a boundary it never reaches.
    if (startDate > endDate) {
      droppedPhases.push(shifted);
      continue;
    }
    phases.push({ ...shifted, startDate, endDate, truncated: startDate !== wantedStart || endDate !== wantedEnd });
    movedToStudyStart ||= startsStudy && shifted.startDate !== target.studyStart;
    movedToStudyEnd ||= endsStudy && shifted.endDate !== target.studyEnd;
  }
  // Events are shifted but never cut: one outside the study period is a publication rule and stays allowed in the
  // planning state until publication names it.
  const events = (target.withEvents ? template.events : []).map((event) => ({
    ...event,
    startDate: plusDays(event.startDate, shiftDays),
    endDate: event.endDate && plusDays(event.endDate, shiftDays),
  }));
  return { shiftDays, shiftWeeks: shiftDays / daysPerWeek, phases, events, droppedPhases, movedToStudyStart, movedToStudyEnd };
}
