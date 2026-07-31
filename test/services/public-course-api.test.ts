import { describe, expect, it } from "vitest";

import { readPublicCourseBlockPlan } from "@/lib/services/public-course-api";
import { databaseWithMasterData, publish } from "@/test/published-plans";

describe("readPublicCourseBlockPlan", () => {
  it("returns only a published course, structured by semester", () => {
    const sqlite = databaseWithMasterData();
    publish(sqlite, { id: "api", courses: [{ code: "TIF25A", studyStart: "2025-10-01", studyEnd: "2028-09-30", phases: [{ semester: 1, startDate: "2025-10-01", endDate: "2025-12-19" }] }] });
    expect(readPublicCourseBlockPlan(sqlite, " tif25a ")).toEqual({ kind: "found", data: { course: { code: "TIF25A", program: { name: "Informatik", abbreviation: "TIF" }, studyPeriod: { startDate: "2025-10-01", endDate: "2028-09-30" } }, semesters: [{ number: 1, phases: [{ type: "THEORY", startDate: "2025-10-01", endDate: "2025-12-19" }] }, { number: 2, phases: [] }, { number: 3, phases: [] }, { number: 4, phases: [] }, { number: 5, phases: [] }, { number: 6, phases: [] }] } });
  });
  it("keeps unpublished and unknown courses hidden", () => expect(readPublicCourseBlockPlan(databaseWithMasterData(), "TIF99A")).toEqual({ kind: "not-found" }));
});
