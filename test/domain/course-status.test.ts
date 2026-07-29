import { describe, expect, it } from "vitest";

import { courseStatus, isPublicationState, publicationStateLabels } from "@/lib/domain/course-status";

describe("courseStatus", () => {
  it("distinguishes never published, published and withdrawn courses", () => {
    expect(courseStatus({ hasEverBeenPublished: false, publishedAt: null, draftUpdatedAt: "2026-01-01T00:00:00.000Z" }).state).toBe("NEVER_PUBLISHED");
    expect(courseStatus({ hasEverBeenPublished: true, publishedAt: "2026-02-01T00:00:00.000Z", draftUpdatedAt: "2026-01-01T00:00:00.000Z" }).state).toBe("PUBLISHED");
    expect(courseStatus({ hasEverBeenPublished: true, publishedAt: null, draftUpdatedAt: "2026-01-01T00:00:00.000Z" }).state).toBe("WITHDRAWN");
  });

  it("marks a course without a published version as in progress, whether or not it ever had one", () => {
    expect(courseStatus({ hasEverBeenPublished: false, publishedAt: null, draftUpdatedAt: "2026-01-01T00:00:00.000Z" }).workInProgress).toBe(true);
    expect(courseStatus({ hasEverBeenPublished: true, publishedAt: null, draftUpdatedAt: "2026-01-01T00:00:00.000Z" }).workInProgress).toBe(true);
  });

  it("marks a published course as in progress once its planning state changed after the publication", () => {
    expect(courseStatus({ hasEverBeenPublished: true, publishedAt: "2026-02-01T00:00:00.000Z", draftUpdatedAt: "2026-02-01T00:00:01.000Z" }).workInProgress).toBe(true);
    // Publishing does not touch the planning state, so an unchanged course keeps the timestamp it was published from.
    expect(courseStatus({ hasEverBeenPublished: true, publishedAt: "2026-02-01T00:00:00.000Z", draftUpdatedAt: "2026-02-01T00:00:00.000Z" }).workInProgress).toBe(false);
    expect(courseStatus({ hasEverBeenPublished: true, publishedAt: "2026-02-01T00:00:00.000Z", draftUpdatedAt: "2026-01-30T00:00:00.000Z" }).workInProgress).toBe(false);
  });

  it("names every state and the work in progress marking in text", () => {
    expect(publicationStateLabels.NEVER_PUBLISHED).toBe("Noch nie veröffentlicht");
    expect(publicationStateLabels.PUBLISHED).toBe("Veröffentlicht");
    expect(publicationStateLabels.WITHDRAWN).toBe("Zurückgenommen");
  });
});

describe("isPublicationState", () => {
  it("accepts the stored states and refuses anything else a URL may carry", () => {
    expect(isPublicationState("PUBLISHED")).toBe(true);
    expect(isPublicationState("veröffentlicht")).toBe(false);
    expect(isPublicationState(null)).toBe(false);
  });
});
