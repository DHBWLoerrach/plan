// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { createElement } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { CourseCalendar } from "@/components/course-calendar";

const requested: string[] = [];

beforeAll(() => {
  vi.stubGlobal("__UI_SDK_STRICT__", true);
  Element.prototype.getAnimations = () => [];
  Element.prototype.checkVisibility = () => true;
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", async (url: string) => {
    requested.push(new URL(url, "http://localhost").searchParams.get("ansicht")!);
    return new Response(JSON.stringify({ events: [] }), { status: 200 });
  });
});

afterEach(cleanup);

it("lets an agent switch the calendar view by its name", async () => {
  const agent = createAgent();
  render(createElement(CourseCalendar, {
    courseId: "course-1",
    initialAnchor: "2026-08-06",
    initialView: "week",
    initialResult: { kind: "available", events: [] },
  }));

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  expect(components.map((entry) => entry.label)).toContain("Kalenderansicht");

  const result = await agent.act({ steps: [{ ref: "Kalenderansicht", action: "setValue", args: ["Monat"] }] });
  expect(result.ok, result.error?.message).toBe(true);

  const views = screen.getByRole("radiogroup", { name: "Kalenderansicht" });
  expect(views.querySelector('[aria-checked="true"]')?.textContent).toBe("Monat");
  await vi.waitFor(() => expect(requested).toEqual(["monat"]));
});
