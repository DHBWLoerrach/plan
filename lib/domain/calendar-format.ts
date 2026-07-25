/**
 * Presentation of timezone-free calendar days. The weekday is spelled out here instead of taken from `Intl`, because
 * the abbreviations differ between ICU builds while the editor compares them against printed block plans.
 */
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

/** An inclusive period; a period of a single day collapses to that day (FACHLICHE_REGELN.md). */
export function formatCalendarPeriod(startDate: string, endDate: string, options?: { weekday?: boolean }): string {
  const start = formatCalendarDay(startDate, options);
  const end = formatCalendarDay(endDate, options);
  return start === end ? start : `${start} – ${end}`;
}
