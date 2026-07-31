/**
 * The generated course progression of a smartly created course: a study period proposed from the course code and a
 * course progression that fills it completely, alternating theory and practice with two course phases per semester
 * (FACHLICHE_REGELN.md). Everything here is pure — the form previews with it and the creation writes from it.
 */
import { inclusiveDays, plusDays, plusMonths, weekdayIndex } from "@/lib/domain/calendar-day";
import type { PhaseType } from "@/lib/domain/phase-type";

export type PlannedPhase = { semester: number; type: PhaseType; startDate: string; endDate: string };

const phasesPerSemester = 2;
const monthsPerPhase = 3;
const monthsPerSemester = phasesPerSemester * monthsPerPhase;
/** Sunday, the weekday every phase boundary is drawn to. */
const sunday = 0;

export function otherPhaseType(type: PhaseType): PhaseType {
  return type === "THEORY" ? "PRACTICE" : "THEORY";
}

/** The number of course phases a generated progression holds: two per semester of the study program. */
export function plannedPhaseCount(semesters: number): number {
  return semesters * phasesPerSemester;
}

const fourDigitYear = /(?<!\d)(20\d{2})(?!\d)/u;
const twoDigitYear = /(?<!\d)(\d{2})(?!\d)/u;
const plausibleYears = 10;

/**
 * The year a course code names, if it names one: „TIF2025A“ and „TIF25A“ both stand for 2025. A two-digit number is
 * only read as a year while it stays within ten years of today — a course code carries other numbers too, and a
 * proposal far outside the plannable range would be worse than none.
 */
export function courseCodeYear(code: string, today: string): number | undefined {
  const currentYear = Number(today.slice(0, 4));
  const fourDigit = fourDigitYear.exec(code);
  if (fourDigit) return Number(fourDigit[1]);
  const twoDigit = twoDigitYear.exec(code);
  if (!twoDigit) return undefined;
  const year = 2000 + Number(twoDigit[1]);
  return Math.abs(year - currentYear) <= plausibleYears ? year : undefined;
}

/**
 * The study start a smart creation proposes: the first of October of the year in the course code, and without one the
 * next first of October from today onwards. It is a proposal and stays editable.
 */
export function proposedStudyStart(code: string, today: string): string {
  const year = courseCodeYear(code, today);
  if (year !== undefined) return `${year}-10-01`;
  const thisYear = Number(today.slice(0, 4));
  const octoberFirst = `${thisYear}-10-01`;
  return today <= octoberFirst ? octoberFirst : `${thisYear + 1}-10-01`;
}

/**
 * The study end that belongs to a study start: six months per semester, ending the day before. Six semesters therefore
 * run from 1 October to 30 September three years later, seven to 31 March three and a half years later.
 */
export function proposedStudyEnd(studyStart: string, semesters: number): string {
  return plusDays(plusMonths(studyStart, semesters * monthsPerSemester), -1);
}

/** The Sunday closest to a day: Monday to Wednesday fall back, Thursday to Saturday move forward. */
function nearestSunday(day: string): string {
  const weekday = weekdayIndex(day);
  if (weekday === sunday) return day;
  return weekday <= 3 ? plusDays(day, -weekday) : plusDays(day, 7 - weekday);
}

function sundayBefore(day: string): string {
  const weekday = weekdayIndex(day);
  return plusDays(day, -(weekday === sunday ? 7 : weekday));
}

function sundayOnOrAfter(day: string): string {
  const weekday = weekdayIndex(day);
  return weekday === sunday ? day : plusDays(day, 7 - weekday);
}

/**
 * The boundary at the turn of the year, where the calendar decides instead of the quarter: a theory phase ends on the
 * Sunday before 24 December, so the holidays fall into the practice phase that follows; a practice phase runs on until
 * the Sunday on or after 6 January, so theory starts again after Epiphany. Only a boundary that falls near the turn of
 * the year is moved this way — the window is generous enough to catch an unevenly divided study period.
 */
function turnOfYearBoundary(day: string, type: PhaseType): string | undefined {
  const month = Number(day.slice(5, 7));
  const dayOfMonth = Number(day.slice(8, 10));
  const inWindow = (month === 12 && dayOfMonth >= 10) || (month === 1 && dayOfMonth <= 21);
  if (!inWindow) return undefined;
  const christmasYear = month === 1 ? Number(day.slice(0, 4)) - 1 : Number(day.slice(0, 4));
  return type === "THEORY" ? sundayBefore(`${christmasYear}-12-24`) : sundayOnOrAfter(`${christmasYear + 1}-01-06`);
}

/**
 * Where the phases would end without any regard for weekdays. A study period of the proposed length divides into
 * quarters, which is what puts the boundaries on the turn of a month; an edited period that no longer does is divided
 * into equal parts instead, so a generated progression always covers it completely.
 */
function nominalEnds(studyStart: string, studyEnd: string, count: number): string[] {
  const quarterly = plusDays(plusMonths(studyStart, count * monthsPerPhase), -1) === studyEnd;
  const totalDays = inclusiveDays(studyStart, studyEnd);
  const ends: string[] = [];
  for (let index = 1; index < count; index++) {
    ends.push(quarterly
      ? plusDays(plusMonths(studyStart, index * monthsPerPhase), -1)
      : plusDays(studyStart, Math.round((index * totalDays) / count) - 1));
  }
  return ends;
}

/**
 * The course progression a smart creation generates: it covers the study period without gap or overlap, alternates the
 * phase types starting from the chosen one and assigns two phases to each semester in turn. Every boundary inside the
 * period falls on a Sunday, so the following phase begins on a Monday; study start and study end stay untouched,
 * because they are anchored to dates rather than to weekdays.
 */
export function generateCoursePlan(input: { studyStart: string; studyEnd: string; semesters: number; startType: PhaseType }): PlannedPhase[] {
  const count = plannedPhaseCount(input.semesters);
  // Every phase needs a day of its own; a study period too short for that yields no progression rather than empty phases.
  if (inclusiveDays(input.studyStart, input.studyEnd) < count) return [];
  const nominal = nominalEnds(input.studyStart, input.studyEnd, count);
  const phases: PlannedPhase[] = [];
  let startDate = input.studyStart;
  for (let index = 0; index < count; index++) {
    const type = index % 2 === 0 ? input.startType : otherPhaseType(input.startType);
    const endDate = index === count - 1
      ? input.studyEnd
      : boundedEnd(turnOfYearBoundary(nominal[index], type) ?? nearestSunday(nominal[index]), startDate, input.studyEnd, count - index - 1);
    phases.push({ semester: Math.floor(index / phasesPerSemester) + 1, type, startDate, endDate });
    startDate = plusDays(endDate, 1);
  }
  return phases;
}

/** A boundary drawn to a weekday may leave its own period: it keeps at least one day here and one for every phase after it. */
function boundedEnd(endDate: string, startDate: string, studyEnd: string, phasesAfter: number): string {
  const latest = plusDays(studyEnd, -phasesAfter);
  if (endDate < startDate) return startDate;
  return endDate > latest ? latest : endDate;
}
