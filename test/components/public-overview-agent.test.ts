// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { createElement } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { PublicOverview } from "@/components/public-overview";
import { buildPublicOverview, type OverviewCourse } from "@/lib/domain/public-overview";

function course(code: string, program: string): OverviewCourse {
  const year = 2000 + Number(code.slice(3, 5));
  return { id: code, code, studyStart: `${year}-10-01`, studyEnd: `${year + 3}-09-30`, semesters: 6, programAbbreviation: code.slice(0, 3), program, year };
}

beforeAll(() => {
  vi.stubGlobal("__UI_SDK_STRICT__", true);
  HTMLElement.prototype.showPopover = () => {};
  HTMLElement.prototype.hidePopover = () => {};
  Element.prototype.getAnimations = () => [];
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.checkVisibility = () => true;
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const style = document.createElement("style");
  style.textContent = "[popover] { display: block !important }";
  document.head.append(style);
});

afterEach(cleanup);

it("lets a ui-sdk agent search for plans and filter by study start", async () => {
  const overview = buildPublicOverview([
    course("TIF25A", "Informatik"),
    course("WPM24A", "BWL – Personalmanagement"),
    course("WPM25A", "BWL – Personalmanagement"),
  ], [], "2026-11-20");
  const searchLabel = "Studiengang oder Kurs suchen";
  const yearLabel = "Studienbeginn";
  const agent = createAgent();

  render(createElement(PublicOverview, { overview, initialQuery: "", initialYear: "" }));

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  }
  expect(components.map((entry) => entry.label)).toEqual(expect.arrayContaining([searchLabel, yearLabel]));

  const year = components.find((entry) => entry.label === yearLabel)?.items?.find((item) => item.label === "2025");
  if (!year) throw new Error("The agent cannot find study start 2025");

  await act(async () => {
    const result = await agent.act({ steps: [
      { ref: searchLabel, action: "setValue", args: ["pers"] },
      { ref: yearLabel, action: "setValue", args: [year.value] },
    ] });
    expect(result.ok, result.error?.message).toBe(true);
  });

  expect(screen.getByRole<HTMLInputElement>("combobox", { name: searchLabel }).value).toBe("pers");
  expect(screen.getByRole("radio", { name: year.label }).getAttribute("aria-checked")).toBe("true");

  const results = within(screen.getByRole("table"));
  expect(results.getByRole("link", { name: "WPM25A" }).getAttribute("href")).toBe("/WPM25A");
  expect(results.queryByRole("link", { name: "WPM24A" })).toBeNull();
  expect(results.queryByRole("link", { name: "TIF25A" })).toBeNull();
});
