/** The only two visibility states of a course. */
export type PublicationState = "UNPUBLISHED" | "PUBLISHED";

export const publicationStateLabels: Record<PublicationState, string> = {
  UNPUBLISHED: "Nicht veröffentlicht",
  PUBLISHED: "Veröffentlicht",
};

export function isPublicationState(value: string | null): value is PublicationState {
  return value !== null && Object.hasOwn(publicationStateLabels, value);
}

/**
 * Publication is visibility of the current course data, represented by one nullable timestamp. Since a course carries
 * no second data stand beside the visible one (ADR 0012), this single state says everything there is to say about it:
 * an unpublished course is not additionally „in Arbeit“, that was the same fact under a second name (ADR 0014).
 */
export function publicationState(publishedAt: string | null): PublicationState {
  return publishedAt ? "PUBLISHED" : "UNPUBLISHED";
}
