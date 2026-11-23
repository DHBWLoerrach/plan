// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { createElement } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { CoursePlanWorkspace } from "@/components/course-plan-editor";
import type { PlanCourse } from "@/lib/services/internal-course-plan";

vi.mock("@/app/intern/kurse/[courseId]/actions", () => ({
  createEventAction: vi.fn(),
  createPhaseAction: vi.fn(),
  deleteEventAction: vi.fn(),
  deletePhaseAction: vi.fn(),
  movePhaseChangeAction: vi.fn(),
  updateEventAction: vi.fn(),
  updatePhaseAction: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal("__UI_SDK_STRICT__", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.getAnimations = () => [];
  Element.prototype.checkVisibility = () => true;
});

afterEach(cleanup);

const course: PlanCourse = {
  id: "source", code: "TIF26A", areaId: "area", areaName: "Technik", programId: "program", program: "Informatik",
  studyStart: "2026-10-01", studyEnd: "2029-09-30", semesters: 6, updatedAt: "2026-01-01T00:00:00.000Z",
  publishedAt: null, state: "UNPUBLISHED", editable: true,
};

it("offers eligible courses by name and submits only the targets selected by an agent", async () => {
  const target = { ...course, id: "target", code: "TIF26B" };
  const published: PlanCourse = { ...course, id: "published", code: "TIF26C", publishedAt: "2026-01-01T00:00:00.000Z", state: "PUBLISHED" };
  const foreign = { ...course, id: "foreign", code: "TIF26D", editable: false };
  const agent = createAgent();
  render(createElement(CoursePlanWorkspace, { course, parallels: [target, published, foreign], phases: [], events: [] }));
  for (const summary of ["Kursphase ergänzen", "Termin erfassen"]) {
    screen.getByText(summary).closest("details")!.open = true;
  }

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component === "checkbox");
  expect(components.map((entry) => entry.label)).toEqual([
    "TIF26B – Kursphase übertragen",
    "TIF26B – Termin übertragen",
    "TIF26C · veröffentlicht – Termin übertragen",
  ]);

  const phase = screen.getByRole("checkbox", { name: "TIF26B – Kursphase übertragen" });
  const event = screen.getByRole("checkbox", { name: "TIF26C · veröffentlicht – Termin übertragen" });
  await act(async () => {
    const result = await agent.act({ steps: [
      { ref: "TIF26B – Kursphase übertragen", action: "setChecked", args: [true] },
      { ref: "TIF26C · veröffentlicht – Termin übertragen", action: "setChecked", args: [true] },
    ] });
    expect(result.ok, result.error?.message).toBe(true);
  });

  const phaseData = new FormData(phase.closest("form")!);
  const eventData = new FormData(event.closest("form")!);
  expect(phaseData.get("courseId")).toBe("source");
  expect(phaseData.getAll("transferCourseId")).toEqual(["target"]);
  expect(eventData.getAll("transferCourseId")).toEqual(["published"]);
});
