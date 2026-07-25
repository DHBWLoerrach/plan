import { describe, expect, it } from "vitest";

import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";

describe("blockPlanDisplayName", () => {
  it("derives the name from the year and the current course codes when no designation is given", () => {
    const courses = [
      { code: "WWI26A", studyStart: "2026-10-01" },
      { code: "TIF26A", studyStart: "2026-09-01" },
    ];

    expect(blockPlanDisplayName(null, courses)).toBe("2026 · TIF26A, WWI26A");
  });

  it("names a block plan whose courses are all detached instead of deriving from nothing", () => {
    expect(blockPlanDisplayName(null, [])).toBe("Blockplan ohne Kurse");
  });

  it("uses the given designation instead of the derived name", () => {
    expect(blockPlanDisplayName("Technik Jahrgang 2026", [{ code: "TIF26A", studyStart: "2026-09-01" }])).toBe("Technik Jahrgang 2026");
  });
});
