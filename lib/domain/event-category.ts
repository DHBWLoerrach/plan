export type EventCategory = "REGISTRATION" | "SUBMISSION" | "PRESENTATION" | "EXAM" | "OTHER";

/** The five categories of an examination-relevant event with their German labels (CONTEXT.md, FACHLICHE_REGELN.md). */
export const eventCategories: { value: EventCategory; label: string }[] = [
  { value: "REGISTRATION", label: "Anmeldung" },
  { value: "SUBMISSION", label: "Abgabe" },
  { value: "PRESENTATION", label: "Präsentation" },
  { value: "EXAM", label: "Prüfung" },
  { value: "OTHER", label: "Sonstiges" },
];

export function eventCategoryLabel(category: EventCategory): string {
  return eventCategories.find((entry) => entry.value === category)?.label ?? category;
}

export function isEventCategory(value: string): value is EventCategory {
  return eventCategories.some((entry) => entry.value === value);
}
