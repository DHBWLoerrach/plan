/** The only two visibility states of a course. */
export type PublicationState = "UNPUBLISHED" | "PUBLISHED";

export const publicationStateLabels: Record<PublicationState, string> = {
  UNPUBLISHED: "Nicht veröffentlicht",
  PUBLISHED: "Veröffentlicht",
};

/** Unpublished courses may contain incomplete intermediate planning states. */
export const workInProgressLabel = "In Arbeit";

/** How every internal view names whether a course belongs to an area this account may write in (ADR 0011). */
export function areaAccessLabel(editable: boolean): string {
  return editable ? "Eigener Bereich" : "Fremder Bereich — nur lesbar";
}

export function isPublicationState(value: string | null): value is PublicationState {
  return value !== null && Object.hasOwn(publicationStateLabels, value);
}

export type CourseStatus = { state: PublicationState; workInProgress: boolean };

/** Publication is visibility of the current course data, represented by one nullable timestamp. */
export function courseStatus(publishedAt: string | null): CourseStatus {
  return publishedAt
    ? { state: "PUBLISHED", workInProgress: false }
    : { state: "UNPUBLISHED", workInProgress: true };
}
