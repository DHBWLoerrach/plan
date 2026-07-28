/**
 * Presentation of timezone-free calendar days. The weekday is spelled out here instead of taken from `Intl`, because
 * the abbreviations differ between ICU builds while the editor compares them against printed block plans.
 */
import { daysBetween, plusDays } from "@/lib/domain/calendar-day";

const abbreviatedWeekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const fullWeekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const dayFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const timestampFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });

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

/**
 * A stored instant — unlike the timezone-free calendar days above, the moment of the last draft change is a point in
 * time. It is shown in Europe/Berlin, so every internal view names the same moment regardless of the server timezone.
 */
export function formatTimestamp(instant: string): string {
  return `${timestampFormatter.format(new Date(instant))} Uhr`;
}

/**
 * The length of an inclusive period. Course phases are planned in whole weeks, so weeks are the unit the editor and
 * the published plan are read in; a period that does not divide into whole weeks names the remaining days instead of
 * rounding them away.
 */
export function formatPeriodDuration(startDate: string, endDate: string): string {
  const days = daysBetween(plusDays(startDate, -1), plusDays(endDate, 1));
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  const parts: string[] = [];
  if (weeks) parts.push(weeks === 1 ? "1 Woche" : `${weeks} Wochen`);
  if (remainingDays || !weeks) parts.push(remainingDays === 1 ? "1 Tag" : `${remainingDays} Tage`);
  return parts.join(", ");
}

/** An inclusive period; a period of a single day collapses to that day (FACHLICHE_REGELN.md). */
export function formatCalendarPeriod(startDate: string, endDate: string, options?: { weekday?: boolean }): string {
  const start = formatCalendarDay(startDate, options);
  const end = formatCalendarDay(endDate, options);
  return start === end ? start : `${start} – ${end}`;
}
