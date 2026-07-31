import { describe, expect, it } from "vitest";

import { courseStatus, isPublicationState, publicationStateLabels } from "@/lib/domain/course-status";

describe("courseStatus", () => {
  it("derives the two visibility states from the nullable publication timestamp", () => {
    expect(courseStatus(null)).toEqual({ state: "UNPUBLISHED", workInProgress: true });
    expect(courseStatus("2026-02-01T00:00:00.000Z")).toEqual({ state: "PUBLISHED", workInProgress: false });
  });

  it("names and recognises exactly those two states", () => {
    expect(publicationStateLabels).toEqual({ UNPUBLISHED: "Nicht veröffentlicht", PUBLISHED: "Veröffentlicht" });
    expect(isPublicationState("UNPUBLISHED")).toBe(true);
    expect(isPublicationState("PUBLISHED")).toBe(true);
    expect(isPublicationState("WITHDRAWN")).toBe(false);
  });
});
