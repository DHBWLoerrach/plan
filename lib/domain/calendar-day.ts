import { FieldError } from "@/lib/domain/field-error";

const calendarDayPattern = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Whether the value already is a calendar day: the check `normalizeCalendarDay` makes, without its message. A form
 * that computes something from a half-typed date asks this before it computes.
 */
export function isCalendarDay(value: string): boolean {
  if (!calendarDayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Normalizes a calendar day: trimmed and a valid Gregorian day in `YYYY-MM-DD` (FACHLICHE_REGELN.md). Calendar days
 * are timezone-free, so the value is compared against its own UTC round trip instead of being parsed locally.
 */
export function normalizeCalendarDay(value: string, label: string): string {
  const trimmed = value.trim();
  if (!calendarDayPattern.test(trimmed)) throw new Error(`${label} muss ein Datum im Format JJJJ-MM-TT sein.`);
  if (!isCalendarDay(trimmed)) throw new Error(`${label} ist kein gültiger Kalendertag.`);
  return trimmed;
}

/** The same normalization for an editor field, so a rejected day names the field it came from. */
export function normalizeCalendarDayField<TField extends string>(value: string, field: TField, label: string): string {
  try {
    return normalizeCalendarDay(value, label);
  } catch (error) {
    throw new FieldError(field, error instanceof Error ? error.message : `${label} ist kein gültiger Kalendertag.`);
  }
}

/** The calendar day the given number of days after the given one; a negative count steps backwards. */
export function plusDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The number of days a period covers with both of its days included, so a single day counts as one. */
export function inclusiveDays(from: string, to: string): number {
  const difference = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(difference / 86_400_000) + 1;
}
