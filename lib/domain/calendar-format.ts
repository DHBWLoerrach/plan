/**
 * Presentation of timezone-free calendar days. The weekday is spelled out here instead of taken from `Intl`, because
 * the abbreviations differ between ICU builds while the editor compares them against printed block plans.
 */
import { inclusiveDays } from "@/lib/domain/calendar-day";

const abbreviatedWeekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const fullWeekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const dayFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function utcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** The full German name of the weekday a calendar day falls on. */
export function weekdayName(day: string): string {
  return fullWeekdays[utcDate(day).getUTCDay()];
}

/** A calendar day as `TT.MM.JJJJ`, optionally preceded by its abbreviated weekday. */
export function formatCalendarDay(day: string, options?: { weekday?: boolean }): string {
  const date = utcDate(day);
  const formatted = dayFormatter.format(date);
  return options?.weekday ? `${abbreviatedWeekdays[date.getUTCDay()]} ${formatted}` : formatted;
}

function weeksAndDays(startDate: string, endDate: string): { weeks: number; days: number } {
  const total = inclusiveDays(startDate, endDate);
  return { weeks: Math.floor(total / 7), days: total % 7 };
}

/**
 * The length of an inclusive period. Course phases are planned in whole weeks, so weeks are the unit the editor and
 * the published plan are read in; a period that does not divide into whole weeks names the remaining days instead of
 * rounding them away.
 */
export function formatPeriodDuration(startDate: string, endDate: string): string {
  const { weeks, days } = weeksAndDays(startDate, endDate);
  const parts: string[] = [];
  if (weeks) parts.push(weeks === 1 ? "1 Woche" : `${weeks} Wochen`);
  if (days || !weeks) parts.push(days === 1 ? "1 Tag" : `${days} Tage`);
  return parts.join(", ");
}

/**
 * The same length abbreviated, for the phase bars of the timeline: they are as wide as their phase is long, and the
 * spelled-out unit would not fit into a short one. Abbreviating rather than dropping the days keeps every bar of the
 * diagram in the same unit, and the matrix below states the length in full.
 */
export function formatCompactDuration(startDate: string, endDate: string): string {
  const { weeks, days } = weeksAndDays(startDate, endDate);
  const parts: string[] = [];
  if (weeks) parts.push(`${weeks} Wo.`);
  if (days || !weeks) parts.push(`${days} T.`);
  return parts.join(" + ");
}

/** An inclusive period; a period of a single day collapses to that day (FACHLICHE_REGELN.md). */
export function formatCalendarPeriod(startDate: string, endDate: string, options?: { weekday?: boolean }): string {
  const start = formatCalendarDay(startDate, options);
  const end = formatCalendarDay(endDate, options);
  return start === end ? start : `${start} – ${end}`;
}
