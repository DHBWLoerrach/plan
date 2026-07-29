import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanMatrix } from "@/components/plan-matrix";
import type { DraftCourse, DraftEvent, DraftPhase } from "@/lib/domain/publication";

const courses: DraftCourse[] = [
  { id: "course-a", code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 1 },
  { id: "course-b", code: "TIF26B", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 1 },
];

const phases: DraftPhase[] = courses.flatMap((course) => [
  { courseId: course.id, semester: 1, type: "THEORY" as const, startDate: "2026-10-01", endDate: "2027-09-30" },
]);

const events: DraftEvent[] = [
  { id: "event-a", title: "Klausur", description: "Raum A", category: "EXAM", startDate: "2027-03-15", endDate: null, provisional: false, courseIds: ["course-a"] },
  { id: "event-b", title: "  Klausur  ", description: "Raum B", category: "EXAM", startDate: "2027-03-15", endDate: null, provisional: false, courseIds: ["course-b"] },
];

describe("PlanMatrix", () => {
  it("renders one shared column and keeps every participating course programmatically assigned", () => {
    const markup = renderToStaticMarkup(createElement(PlanMatrix, { courses, phases, events }));

    expect(markup).toContain("TIF26A · TIF26B");
    expect(markup).toMatch(/headers="[^"]*matrix-course-course-a matrix-course-course-b"/);
    expect(markup).toMatch(/<th[^>]*id="matrix-course-course-a"/);
    expect(markup).toMatch(/<th[^>]*id="matrix-course-course-b"/);
  });

  it("renders equal events as one row with each course description", () => {
    const markup = renderToStaticMarkup(createElement(PlanMatrix, { courses, phases, events }));

    expect(markup.match(/<tr>/g)).toHaveLength(5);
    expect(markup).toContain("TIF26A: Raum A");
    expect(markup).toContain("TIF26B: Raum B");
  });
});
