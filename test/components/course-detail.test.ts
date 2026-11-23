// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CourseDetailView } from "@/components/course-detail";
import { buildCourseDetail } from "@/lib/domain/course-detail";
import type { CourseEvent, CoursePhase } from "@/lib/domain/publication";

const course = { id: "tif25a", code: "TIF25A", studyStart: "2025-10-01", studyEnd: "2026-09-30", semesters: 2, program: "Informatik", programAbbreviation: "TIF", area: "Technik", year: 2025 };
const phases: CoursePhase[] = [
  { courseId: "tif25a", semester: 1, type: "THEORY", startDate: "2025-10-01", endDate: "2025-12-31" },
  { courseId: "tif25a", semester: 1, type: "PRACTICE", startDate: "2026-01-01", endDate: "2026-03-31" },
  { courseId: "tif25a", semester: 2, type: "THEORY", startDate: "2026-04-01", endDate: "2026-09-30" },
];
const events: CourseEvent[] = [
  { id: "e1", courseId: "tif25a", title: "Abgabe Projektarbeit", description: "mit Reflexionsbericht", category: "SUBMISSION", startDate: "2025-11-03", endDate: null, provisional: false },
  { id: "e2", courseId: "tif25a", title: "Klausurwoche", description: null, category: "EXAM", startDate: "2026-03-16", endDate: "2026-03-20", provisional: true },
];

function detail(withEvents = true) {
  return buildCourseDetail({ course, parallels: [], phases, events: withEvents ? events : [], updatedAt: "2026-01-01T00:00:00.000Z", today: "2026-01-15" });
}

beforeAll(() => {
  vi.stubGlobal("__UI_SDK_STRICT__", true);
  Element.prototype.checkVisibility = () => true;
});

afterEach(cleanup);

describe("CourseDetailView", () => {
  it("renders on the server without a style element the policy would refuse", () => {
    const markup = renderToStaticMarkup(createElement(CourseDetailView, { detail: detail() }));

    expect(markup).not.toContain("<style");
    expect(markup).toContain("<h1>Informatik</h1>");
  });

  it("lists every phase with its semester as row heading and marks the current one in words", () => {
    render(createElement(CourseDetailView, { detail: detail() }));

    const table = within(screen.getByRole("table", { name: "Alle Phasen" }));
    expect(table.getByRole("rowheader", { name: "1. Studienjahr · 2025/26" })).toBeTruthy();
    expect(table.getByRole("rowheader", { name: "1. Semester" }).getAttribute("rowspan")).toBe("2");
    const current = table.getByText("jetzt").closest("tr")!;
    expect(current.textContent).toContain("01.01.2026 – 31.03.2026");
    expect(current.textContent).toContain("Im Unternehmen");
    expect(table.getByText("01.10.2025 – 31.12.2025").textContent).toContain("(vorbei)");
  });

  it("names the next date, a provisional one, and each date's category and semester in the table of dates", () => {
    render(createElement(CourseDetailView, { detail: detail() }));

    const rows = within(screen.getByRole("table", { name: "Prüfungsrelevante Termine" })).getAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual([
      "DatumTermin",
      "Mo 03.11.2025 (vorbei)Abgabe ProjektarbeitAbgabe · 1. Semestermit Reflexionsbericht",
      "Mo 16.03.2026 – Fr 20.03.2026nächster TerminVorläufigKlausurwochePrüfung · 1. Semester",
    ]);
  });

  it("says so when the plan holds no dates, and leaves the timeline without toggles", () => {
    render(createElement(CourseDetailView, { detail: detail(false) }));

    expect(screen.getByText("Dieser Blockplan enthält keine Prüfungstermine.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Abgabe/u })).toBeNull();
    expect(screen.queryByText(/Wählen Sie einen Termin/u)).toBeNull();
  });

  it("names a date of the timeline when it is pressed, and only one at a time", () => {
    render(createElement(CourseDetailView, { detail: detail() }));

    const status = screen.getByText(/Wählen Sie einen Termin/u);
    const submission = screen.getByRole("button", { name: "Mo 03.11.2025: Abgabe Projektarbeit (Abgabe)" });
    const exams = screen.getByRole("button", { name: "Mo 16.03.2026 – Fr 20.03.2026: Klausurwoche (Prüfung, vorläufig)" });

    fireEvent.click(submission);
    expect(submission.getAttribute("aria-pressed")).toBe("true");
    expect(status.textContent).toBe("Mo 03.11.2025: Abgabe Projektarbeit (Abgabe)");

    fireEvent.click(exams);
    expect(submission.getAttribute("aria-pressed")).toBe("false");
    expect(status.textContent).toBe("Mo 16.03.2026 – Fr 20.03.2026: Klausurwoche (Prüfung, vorläufig)");

    fireEvent.click(exams);
    expect(status.textContent).toMatch(/Wählen Sie einen Termin/u);
  });

  it("copies the address of the course without the search it was opened with", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(createElement(CourseDetailView, { detail: detail() }));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Link kopieren" })); });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/TIF25A`);
    expect(screen.getByText("Link in die Zwischenablage kopiert.")).toBeTruthy();
  });
});

it("lets a ui-sdk agent pick a date on the timeline and copy the link", async () => {
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: async () => {} } });
  const agent = createAgent();
  render(createElement(CourseDetailView, { detail: detail() }));

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  }
  expect(components.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Termine in der Zeitleiste", "Link kopieren"]));

  await act(async () => {
    const result = await agent.act({ steps: [
      { ref: "Mo 03.11.2025: Abgabe Projektarbeit (Abgabe)", action: "setPressed", args: [true] },
      { ref: "Link kopieren", action: "press" },
    ] });
    expect(result.ok, result.error?.message).toBe(true);
  });

  expect(screen.getByRole("button", { name: "Mo 03.11.2025: Abgabe Projektarbeit (Abgabe)" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Link in die Zwischenablage kopiert.")).toBeTruthy();
});
