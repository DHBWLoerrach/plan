// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { PublicOverview } from "@/components/public-overview";
import { buildPublicOverview, type OverviewCourse } from "@/lib/domain/public-overview";

function course(code: string, program: string): OverviewCourse {
  const year = 2000 + Number(code.slice(3, 5));
  return { id: code, code, studyStart: `${year}-10-01`, studyEnd: `${year + 3}-09-30`, semesters: 6, programAbbreviation: code.slice(0, 3), program, year };
}

beforeAll(() => {
  // jsdom lays nothing out, so each table cell gets a box from its row and column: 100 wide, 60 high, links stacked in it.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const cell = this.closest("td, th");
    const row = this.closest("tr");
    if (!cell || !row) return new DOMRect(0, 0, 0, 0);
    const links = [...cell.querySelectorAll("a")];
    const top = [...row.parentElement!.children].indexOf(row) * 60 + Math.max(0, links.indexOf(this as HTMLAnchorElement)) * 20;
    return new DOMRect([...row.children].indexOf(cell) * 100, top, 90, 18);
  };
});

afterEach(cleanup);

it("reaches every course by the arrows, even where each program has its course in another year", () => {
  const overview = buildPublicOverview([
    course("TAR24A", "Architektur"), course("TIF25A", "Informatik"), course("WWI26A", "Wirtschaftsinformatik"),
  ], [], "2026-11-20");
  render(createElement(PublicOverview, { overview, initialQuery: "", initialYear: "" }));
  const table = within(screen.getByRole("table"));
  const link = (code: string) => table.getByRole("link", { name: code });

  link("TAR24A").focus();
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(link("TIF25A"));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
  expect(document.activeElement).toBe(link("WWI26A"));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(link("TIF25A"));
  for (const code of ["TAR24A", "TIF25A", "WWI26A"]) expect(link(code).getAttribute("tabindex")).toBeNull();
});

it("keeps vertical arrows on the current link when a taller link starts beside it", () => {
  const overview = buildPublicOverview([
    course("TIF24A", "Informatik"), course("TIF25A", "Informatik"),
  ], [], "2026-11-20");
  render(createElement(PublicOverview, { overview, initialQuery: "", initialYear: "" }));
  const table = within(screen.getByRole("table"));
  const left = table.getByRole("link", { name: "TIF24A" });
  const right = table.getByRole("link", { name: "TIF25A" });
  const { x, y, width, height } = right.getBoundingClientRect();
  vi.spyOn(right, "getBoundingClientRect").mockReturnValue(new DOMRect(x, y, width, height * 2));

  left.focus();
  expect(fireEvent.keyDown(left, { key: "ArrowDown" })).toBe(true);
  expect(document.activeElement).toBe(left);

  fireEvent.keyDown(left, { key: "ArrowRight" });
  expect(document.activeElement).toBe(right);

  expect(fireEvent.keyDown(right, { key: "ArrowUp" })).toBe(true);
  expect(document.activeElement).toBe(right);
});
