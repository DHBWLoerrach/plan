// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { PlanMatrix } from "@/components/plan-matrix";
import type { CoursePhase, CoursePlan } from "@/lib/domain/publication";

const announced = vi.hoisted(() => [] as string[]);
vi.mock("@ui-sdk/core", async (original) => ({
  ...await original<typeof import("@ui-sdk/core")>(),
  announce: (text: string) => { announced.push(text); },
}));

const courses: CoursePlan[] = [
  { id: "course-a", code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 1 },
  { id: "course-b", code: "TIF26B", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 1 },
];
const phases: CoursePhase[] = courses.map((course) => (
  { courseId: course.id, semester: 1, type: "THEORY", startDate: "2026-10-01", endDate: "2027-09-30" }
));

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  announced.length = 0;
});

// jsdom drops the space that opens the visually hidden part of the name; a browser keeps it.
const checkbox = (code: string) => screen.getByRole<HTMLInputElement>("checkbox", { name: new RegExp(`^${code}\\s*in der Planmatrix anzeigen$`) });

it("announces a hidden course and the remaining count", () => {
  render(createElement(PlanMatrix, { courses, phases }));

  fireEvent.click(checkbox("TIF26B"));

  expect(checkbox("TIF26B").checked).toBe(false);
  expect(announced).toEqual(["TIF26B ausgeblendet. 1 von 2 Kursen sichtbar."]);
});

it("refuses to hide the last course and says so every time it is asked", () => {
  render(createElement(PlanMatrix, { courses, phases }));
  fireEvent.click(checkbox("TIF26B"));
  announced.length = 0;

  const last = checkbox("TIF26A");
  expect(last.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(last);
  fireEvent.click(last);

  // jsdom undoes a cancelled click on a controlled checkbox differently from a browser; e2e checks that it stays ticked.
  expect(announced).toEqual([
    "TIF26A bleibt sichtbar: Mindestens ein Kurs muss in der Planmatrix angezeigt werden.",
    "TIF26A bleibt sichtbar: Mindestens ein Kurs muss in der Planmatrix angezeigt werden.",
  ]);
});

it("leaves no live region of its own in the markup", () => {
  const { container } = render(createElement(PlanMatrix, { courses, phases }));

  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(checkbox("TIF26A").hasAttribute("aria-disabled")).toBe(false);
});
