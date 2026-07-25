"use client";

import { useId, useState } from "react";

import { weekdayName } from "@/lib/domain/calendar-format";

/**
 * A date input that names the weekday of the entered day. Block phases practically always begin on a Monday and end
 * on a Friday, so the weekday catches a transposed digit right where it is typed. A native date input renders in the
 * browser locale, which is why the weekday lives next to the field rather than inside it.
 */
export function DateField({ label, name, defaultValue, required, invalid, errorId, hint, autoFocus }: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  invalid?: boolean;
  errorId?: string;
  hint?: string;
  /** Set on the first empty required field after a save, so capturing continues without reaching for the mouse. */
  autoFocus?: boolean;
}) {
  const ids = { field: useId(), weekday: useId(), hint: useId() };
  const [value, setValue] = useState(defaultValue);
  const weekday = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? weekdayName(value) : "";
  const describedBy = [hint ? ids.hint : "", weekday ? ids.weekday : "", invalid ? errorId ?? "" : ""].filter(Boolean).join(" ");
  return <>
    <label htmlFor={ids.field}>{label}</label>
    <input id={ids.field} name={name} type="date" required={required} defaultValue={defaultValue} autoFocus={autoFocus}
      onChange={(event) => setValue(event.target.value)}
      aria-invalid={invalid || undefined} aria-describedby={describedBy || undefined} />
    {weekday ? <p id={ids.weekday} className="field-hint">{weekday}</p> : null}
    {hint ? <p id={ids.hint} className="field-hint">{hint}</p> : null}
  </>;
}
