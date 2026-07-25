import { FieldError } from "@/lib/domain/field-error";

/**
 * Normalizes a calendar day: trimmed and a valid Gregorian day in `YYYY-MM-DD` (FACHLICHE_REGELN.md). Calendar days
 * are timezone-free, so the value is compared against its own UTC round trip instead of being parsed locally.
 */
export function normalizeCalendarDay(value: string, label: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) throw new Error(`${label} muss ein Datum im Format JJJJ-MM-TT sein.`);
  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) throw new Error(`${label} ist kein gültiger Kalendertag.`);
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

/**
 * The number of days strictly between two calendar days, so directly consecutive days yield zero. Used to name the
 * span a draft leaves unassigned between two course phases.
 */
export function daysBetween(from: string, to: string): number {
  const difference = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(0, Math.round(difference / 86_400_000) - 1);
}
