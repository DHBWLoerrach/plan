import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanEventTable, PlanMatrix } from "@/components/plan-matrix";
import type { CoursePlan, CourseEvent, CoursePhase } from "@/lib/domain/publication";

const courses: CoursePlan[] = [
  { id: "course-a", code: "TIF26A", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 1 },
  { id: "course-b", code: "TIF26B", studyStart: "2026-10-01", studyEnd: "2027-09-30", semesters: 1 },
];

const phases: CoursePhase[] = courses.flatMap((course) => [
  { courseId: course.id, semester: 1, type: "THEORY" as const, startDate: "2026-10-01", endDate: "2027-09-30" },
]);

const events: CourseEvent[] = [
  { id: "event-a", title: "Klausur", description: "Raum A", category: "EXAM", startDate: "2027-03-15", endDate: null, provisional: false, courseIds: ["course-a"] },
  { id: "event-b", title: "  Klausur  ", description: "Raum B", category: "EXAM", startDate: "2027-03-15", endDate: null, provisional: false, courseIds: ["course-b"] },
];

describe("PlanMatrix", () => {
  it("renders one shared column and keeps every participating course programmatically assigned", () => {
    const markup = renderToStaticMarkup(createElement(PlanMatrix, { courses, phases }));

    expect(markup).toContain("TIF26A · TIF26B");
    expect(markup).toMatch(/headers="[^"]*matrix-course-course-a matrix-course-course-b"/);
    expect(markup).toMatch(/<th[^>]*id="matrix-course-course-a"/);
    expect(markup).toMatch(/<th[^>]*id="matrix-course-course-b"/);
  });

  /* The mark belongs to one course, so a column two courses share carries it behind the designation it speaks about;
     the words behind it are the resolution assistive technology gets instead of the mark. */
  it("marks a course that is not published yet and resolves the mark below the table", () => {
    const markup = renderToStaticMarkup(createElement(PlanMatrix, {
      courses, phases, primaryCourseId: "course-a", unpublishedCourseIds: ["course-b"],
    }));

    expect(markup).toContain("TIF26B<span class=\"matrix-course__mark\" aria-hidden=\"true\">*</span>");
    expect(markup).toContain("<span class=\"sr-only\"> (nicht veröffentlicht)</span>");
    expect(markup).toContain("* Nicht veröffentlicht: Der Verlauf dieses Kurses kann sich noch ändern.");
    // Every cell of the column refers to the per-course heading, so the state is not repeated in each of them.
    expect(markup).not.toMatch(/id="matrix-course-course-b"[^>]*>[^<]*veröffentlicht/);
  });

  // A cut without unpublished courses explains no mark, because none appears in it.
  it("leaves the table unmarked and unexplained where every course is published", () => {
    const markup = renderToStaticMarkup(createElement(PlanMatrix, { courses, phases, primaryCourseId: "course-a" }));

    expect(markup).not.toContain("matrix-course__mark");
    expect(markup).not.toContain("Nicht veröffentlicht");
  });
});

describe("PlanEventTable", () => {
  it("renders equal events as one row with each course description", () => {
    const markup = renderToStaticMarkup(createElement(PlanEventTable, { courses, phases, events }));

    expect(markup).toContain("TIF26A: Raum A");
    expect(markup).toContain("TIF26B: Raum B");
    expect(markup.match(/<tbody>[\s\S]*?<tr>/g)).toHaveLength(1);
  });

  /* Where one course stands alone with its editable list of dates below, the chronology would hold the same entries
     in the same order. The section and what the caller writes into it remain. */
  it("drops the chronology on request but keeps the section around it", () => {
    const markup = renderToStaticMarkup(createElement(PlanEventTable, { courses, phases, events, chronology: false }));

    expect(markup).toContain("Termine");
    expect(markup).not.toContain("Raum A");
    expect(markup).not.toContain("<table");
  });
});
