"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * How long a typed value rests before it narrows the list. Long enough that a word is not searched for letter by
 * letter, short enough that the wait is not read as a hang.
 */
export const typingDelay = 300;

/**
 * A filter bar narrows a list by writing the address: what is shown stays the page the address names, so a narrowed
 * list can be shared as a link, restored by the back key and read by a browser that never ran this code. This hook
 * holds everything that is true of every such bar — the fields, their delay, the navigation and its pending state —
 * and leaves each bar its own fields, labels and arrangement.
 *
 * `values` is what the address currently says, already reduced to strings. `debounced` names the one field that is
 * typed into rather than chosen from; every other field takes effect the moment it changes. `drops` names parameters
 * that a narrowing invalidates — a page number is the one case: a narrowed list is a different list and starts at its
 * beginning.
 */
export function useAddressFilters<Name extends string>({ path, names, parameterNames, values, debounced, drops = [] }: {
  path: string;
  names: readonly Name[];
  parameterNames: Record<Name, string>;
  values: Record<Name, string>;
  debounced: Name;
  drops?: readonly string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filters, setFilters] = useState(values);
  const filtersRef = useRef(values);
  const [pending, startNavigation] = useTransition();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /**
   * The address is not this form's alone: a link out of an empty result, the back key and the reset all set it, and
   * each of them reaches the form as values it never wrote. It has to show them — a form that kept its own would
   * claim a narrowing the list beneath it no longer stands on.
   *
   * What the form itself set arrives here a second time, unchanged, once the list has been read anew; adopting it
   * again costs a render and changes nothing. The typed field is the one value held back, and only for as long as a
   * delayed entry is still outstanding: between the keystroke and the navigation it triggers, the field is ahead of
   * the address on purpose, and overwriting it would take back the very entry that is on its way.
   *
   * The values travel through the effect as one string, because a fresh object every render would run the effect on
   * every render, and a dependency per field would tie this hook to a fixed number of them.
   */
  const addressKey = JSON.stringify(names.map((name) => values[name]));
  useEffect(() => {
    const read = JSON.parse(addressKey) as string[];
    const fromAddress = Object.fromEntries(names.map((name, index) => [name, read[index]])) as Record<Name, string>;
    const nextFilters = timer.current ? { ...fromAddress, [debounced]: filtersRef.current[debounced] } : fromAddress;
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
  }, [addressKey, names, debounced]);

  /** Writes the filters into the address and leaves every parameter the bar does not own where it is. */
  function apply(nextFilters: Record<Name, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const name of names) {
      const value = nextFilters[name].trim();
      if (value) params.set(parameterNames[name], value);
      else params.delete(parameterNames[name]);
    }
    for (const parameter of drops) params.delete(parameter);
    const query = params.toString();
    startNavigation(() => router.replace(query ? `${path}?${query}` : path, { scroll: false }));
  }

  function remember(name: Name, value: string) {
    const nextFilters = { ...filtersRef.current, [name]: value } as Record<Name, string>;
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    return nextFilters;
  }

  function applyNow(nextFilters: Record<Name, string>) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    apply(nextFilters);
  }

  return {
    filters,
    pending,
    /** A chosen value: it takes effect at once, because choosing is done when the option is picked. */
    set: (name: Name, value: string) => applyNow(remember(name, value)),
    /** A typed value: it takes effect once typing has rested, so a word is not searched for letter by letter. */
    type: (name: Name, value: string) => {
      if (timer.current) clearTimeout(timer.current);
      const nextFilters = remember(name, value);
      timer.current = setTimeout(() => {
        timer.current = null;
        apply(nextFilters);
      }, typingDelay);
    },
    /**
     * Emptying every filter goes the same way as changing one, so the address keeps what the bar does not own — a
     * sorting outlives the reset the way it outlives every other change here.
     */
    reset: () => {
      const empty = Object.fromEntries(names.map((name) => [name, ""])) as Record<Name, string>;
      filtersRef.current = empty;
      setFilters(empty);
      applyNow(empty);
    },
    /** Submitting adds nothing to what the fields already say; it only takes an outstanding delay off the clock. */
    submit: () => applyNow(filtersRef.current),
  };
}

/**
 * The field a designation is searched in. The magnifier sits inside the field rather than beside it, so the field
 * keeps the full width of its column, and it is drawn from the markup rather than from the stylesheet: an icon that
 * carries no meaning of its own belongs out of the accessibility tree, not into a pseudo-element.
 */
export function SearchField({ label, name, value, placeholder, describedBy, onChange }: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  return <label><span>{label}</span><span className="filter-bar__search">
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
    <input name={name} type="search" value={value} autoComplete="off" aria-describedby={describedBy}
      placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />
  </span></label>;
}
