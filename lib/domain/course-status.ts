/**
 * The markings every internal view puts on a course: its Veröffentlichungszustand, whether it is „in Arbeit“ and
 * whether the reading account may write to it. They answer different questions and are therefore named separately
 * rather than folded into one state (FACHLICHE_REGELN.md, ADR 0011).
 */
export type PublicationState = "NEVER_PUBLISHED" | "PUBLISHED" | "WITHDRAWN";

export const publicationStateLabels: Record<PublicationState, string> = {
  NEVER_PUBLISHED: "Noch nie veröffentlicht",
  PUBLISHED: "Veröffentlicht",
  WITHDRAWN: "Zurückgenommen",
};

/** The text every list and every course view uses for a course whose planning state is not the published one. */
export const workInProgressLabel = "In Arbeit";

/** How every internal view names whether a course belongs to an area this account may write in (ADR 0011). */
export function areaAccessLabel(editable: boolean): string {
  return editable ? "Eigener Bereich" : "Fremder Bereich — nur lesbar";
}

export function isPublicationState(value: string | null): value is PublicationState {
  return value !== null && Object.hasOwn(publicationStateLabels, value);
}

export type CourseStatusInput = {
  hasEverBeenPublished: boolean;
  /** When the published version of the course was created, `null` while no version exists. */
  publishedAt: string | null;
  draftUpdatedAt: string;
};

export type CourseStatus = { state: PublicationState; workInProgress: boolean };

/**
 * Since every internal account may now read courses of foreign areas (ADR 0011), a planning state that nobody agreed
 * on could be mistaken for a settled one. A course therefore counts as „in Arbeit“ whenever it has no published
 * version or its planning state changed after the publication — a comparison of timestamps, not of contents
 * (ARCHITEKTUR_UND_BETRIEB.md).
 */
export function courseStatus({ hasEverBeenPublished, publishedAt, draftUpdatedAt }: CourseStatusInput): CourseStatus {
  if (!publishedAt) return { state: hasEverBeenPublished ? "WITHDRAWN" : "NEVER_PUBLISHED", workInProgress: true };
  return { state: "PUBLISHED", workInProgress: draftUpdatedAt > publishedAt };
}
