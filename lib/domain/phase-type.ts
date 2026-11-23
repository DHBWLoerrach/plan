export type PhaseType = "THEORY" | "PRACTICE";

/** The two kinds of a course phase with their German labels: theory at the university, practice at the partner company. */
export const phaseTypes: { value: PhaseType; label: string }[] = [
  { value: "THEORY", label: "Theorie" },
  { value: "PRACTICE", label: "Praxis" },
];

export function phaseTypeLabel(type: PhaseType): string {
  return phaseTypes.find((entry) => entry.value === type)?.label ?? type;
}

/* Where the students are, as partners ask it, rather than the planners' „Theorie“ and „Praxis“. */
const phasePlaces: Record<PhaseType, string> = { THEORY: "An der DHBW", PRACTICE: "Im Unternehmen" };

export function phasePlaceLabel(type: PhaseType): string {
  return phasePlaces[type];
}

export function isPhaseType(value: string): value is PhaseType {
  return phaseTypes.some((entry) => entry.value === value);
}
