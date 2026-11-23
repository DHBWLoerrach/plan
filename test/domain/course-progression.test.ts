import { describe, expect, it } from "vitest";

import { buildCourseProgression } from "@/lib/domain/course-progression";
import type { CourseEvent, CoursePhase } from "@/lib/domain/publication";

const course = { id: "course", semesters: 2 };
const phase = (semester: number, type: CoursePhase["type"], startDate: string, endDate: string, courseId = "course"): CoursePhase => ({ courseId, semester, type, startDate, endDate });
const event = (id: string, startDate: string, courseId = "course"): CourseEvent => ({ id, title: id, description: null, category: "EXAM", startDate, endDate: null, provisional: false, courseId });

describe("buildCourseProgression", () => {
  it("orders the phases by semester and names the day the course changes over, across semesters as well", () => {
    const progression = buildCourseProgression(course, [
      phase(2, "THEORY", "2027-04-01", "2027-06-30"),
      phase(1, "PRACTICE", "2027-01-01", "2027-03-31"),
      phase(1, "THEORY", "2026-10-01", "2026-12-31"),
    ], []);

    expect(progression.semesters.map((semester) => semester.phases.map((entry) => entry.phase.startDate))).toEqual([["2026-10-01", "2027-01-01"], ["2027-04-01"]]);
    expect(progression.semesters[0].phases.map((entry) => entry.junction)).toEqual([{ kind: "change", date: "2027-01-01" }, { kind: "change", date: "2027-04-01" }]);
    expect(progression.semesters[0].phases[1].next?.startDate).toBe("2027-04-01");
    expect(progression.semesters[1].phases[0].junction).toBeNull();
  });

  // Where two phases do not adjoin there is no day to move, and the list says what lies between them instead.
  it("names days nobody planned and days planned twice instead of a change", () => {
    const gap = buildCourseProgression(course, [phase(1, "THEORY", "2026-10-01", "2026-12-20"), phase(1, "PRACTICE", "2026-12-28", "2027-03-31")], []);
    const overlap = buildCourseProgression(course, [phase(1, "THEORY", "2026-10-01", "2026-12-31"), phase(1, "PRACTICE", "2026-12-28", "2027-03-31")], []);

    expect(gap.semesters[0].phases[0].junction).toEqual({ kind: "gap", startDate: "2026-12-21", endDate: "2026-12-27", days: 7 });
    expect(overlap.semesters[0].phases[0].junction).toEqual({ kind: "overlap", startDate: "2026-12-28", endDate: "2026-12-31", days: 4 });
  });

  it("puts a date into the phase it begins in and keeps the ones beginning in none", () => {
    const progression = buildCourseProgression(course, [phase(1, "THEORY", "2026-10-01", "2026-12-31"), phase(1, "PRACTICE", "2027-01-01", "2027-03-31")],
      [event("late", "2027-05-01"), event("change-day", "2027-01-01"), event("early", "2026-11-11"), event("foreign", "2026-11-12", "other")]);

    expect(progression.semesters[0].phases.map((entry) => entry.events.map((placed) => placed.id))).toEqual([["early"], ["change-day"]]);
    expect(progression.unplacedEvents.map((unplaced) => unplaced.id)).toEqual(["late"]);
  });

  // A semester without a phase says so instead of missing; a phase in a semester the program no longer has stays reachable.
  it("lists every semester of the study program and any other a stored phase names", () => {
    const progression = buildCourseProgression(course, [phase(4, "THEORY", "2028-04-01", "2028-06-30"), phase(1, "THEORY", "2026-10-01", "2026-12-31", "other")], []);

    expect(progression.semesters.map((semester) => [semester.semester, semester.phases.length])).toEqual([[1, 0], [2, 0], [4, 1]]);
  });

  /* The semester number groups the list, the calendar decides what follows what: an unpublished plan may number its
     semesters against their order in time, and two phases that adjoin must not be reported as lying on top of each other. */
  it("finds the following phase by time, not by semester number", () => {
    const progression = buildCourseProgression(course, [phase(1, "THEORY", "2027-04-01", "2027-09-30"), phase(2, "PRACTICE", "2026-10-01", "2027-03-31")], []);

    expect(progression.semesters[1].phases[0].junction).toEqual({ kind: "change", date: "2027-04-01" });
    expect(progression.semesters[1].phases[0].next?.semester).toBe(1);
    expect(progression.semesters[0].phases[0].junction).toBeNull();
  });
});
