import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveAccount: vi.fn(),
  managesAnyArea: vi.fn(),
  readCourseCalendar: vi.fn(),
  findCourseCalendarReference: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ sqlite: {} }));
vi.mock("@/lib/internal-auth", () => ({
  getActiveAccount: mocks.getActiveAccount,
  managesAnyArea: mocks.managesAnyArea,
}));
vi.mock("@/lib/services/course-calendar-access", () => ({ findCourseCalendarReference: mocks.findCourseCalendarReference }));
vi.mock("@/lib/services/course-calendar-feed", () => ({ readCourseCalendar: mocks.readCourseCalendar }));

import { GET } from "@/app/api/internal/courses/[courseId]/calendar/route";

const context = (courseId: string) => ({ params: Promise.resolve({ courseId }) });

describe("internal course calendar API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveAccount.mockResolvedValue({ id: "editor" });
    mocks.managesAnyArea.mockReturnValue(true);
    mocks.findCourseCalendarReference.mockReturnValue({ id: "course-tif", code: "TIF25A" });
    mocks.readCourseCalendar.mockResolvedValue({
      kind: "available",
      events: [{ uid: "one", title: "Analysis", start: "2026-08-10T09:00:00.000Z", end: "2026-08-10T12:00:00.000Z", location: "", description: "", allDay: false }],
    });
  });

  it("returns a current calendar only to an internally course-readable account", async () => {
    const response = await GET(new Request("https://example.test/api/internal/courses/course-tif/calendar?datum=2026-08-06"), context("course-tif"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ events: [expect.objectContaining({ uid: "one", title: "Analysis" })] });
    expect(mocks.findCourseCalendarReference).toHaveBeenCalledWith({}, "course-tif");
    expect(mocks.readCourseCalendar).toHaveBeenCalledWith("TIF25A");
  });

  it("refuses missing sessions and accounts without system-wide course read access", async () => {
    mocks.getActiveAccount.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://example.test"), context("course-tif"))).status).toBe(401);
    expect(mocks.findCourseCalendarReference).not.toHaveBeenCalled();

    mocks.getActiveAccount.mockResolvedValueOnce({ id: "reader" });
    mocks.managesAnyArea.mockReturnValueOnce(false);
    expect((await GET(new Request("https://example.test"), context("course-tif"))).status).toBe(403);
    expect(mocks.findCourseCalendarReference).not.toHaveBeenCalled();
  });

  it("does not reveal an unknown course and distinguishes an unavailable upstream", async () => {
    mocks.findCourseCalendarReference.mockReturnValueOnce(undefined);
    expect((await GET(new Request("https://example.test"), context("unknown"))).status).toBe(404);

    mocks.readCourseCalendar.mockResolvedValueOnce({ kind: "unavailable" });
    const unavailable = await GET(new Request("https://example.test"), context("course-tif"));
    expect(unavailable.status).toBe(502);
    await expect(unavailable.json()).resolves.toEqual({ error: "calendar_unavailable" });
  });
});
