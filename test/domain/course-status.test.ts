import { describe, expect, it } from "vitest";

import { publicationState, publicationStateLabels } from "@/lib/domain/course-status";

describe("publicationState", () => {
  it("derives the two visibility states from the nullable publication timestamp", () => {
    expect(publicationState(null)).toBe("UNPUBLISHED");
    expect(publicationState("2026-02-01T00:00:00.000Z")).toBe("PUBLISHED");
  });

  it("names exactly those two states", () => {
    expect(publicationStateLabels).toEqual({ UNPUBLISHED: "Nicht veröffentlicht", PUBLISHED: "Veröffentlicht" });
  });
});
