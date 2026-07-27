import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(async () => undefined),
  readPublicCourseBlockPlan: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("@/lib/db", () => ({ sqlite: {} }));
vi.mock("@/lib/services/public-course-api", () => ({ readPublicCourseBlockPlan: mocks.readPublicCourseBlockPlan }));

import { GET } from "@/app/api/v1/courses/[courseCode]/block-plan/route";

const context = (courseCode: string) => ({ params: Promise.resolve({ courseCode }) });

describe("public course API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the course plan as public JSON", async () => {
    const data = {
      course: {
        code: "TIF25A",
        program: { name: "Informatik", abbreviation: "TIF" },
        studyPeriod: { startDate: "2025-10-01", endDate: "2028-09-30" },
      },
      semesters: [{ number: 1, phases: [{ type: "THEORY", startDate: "2025-10-01", endDate: "2025-12-19" }] }],
    };
    mocks.readPublicCourseBlockPlan.mockReturnValue({ kind: "found", data });

    const response = await GET(new Request("https://example.test/api/v1/courses/TIF25A/block-plan"), context("TIF25A"));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(data);
    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.readPublicCourseBlockPlan).toHaveBeenCalledWith({}, "TIF25A");
  });

  it("keeps an unknown or unpublished course indistinguishable", async () => {
    mocks.readPublicCourseBlockPlan.mockReturnValue({ kind: "not-found" });

    const response = await GET(new Request("https://example.test/api/v1/courses/TIF99A/block-plan"), context("TIF99A"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });
});
