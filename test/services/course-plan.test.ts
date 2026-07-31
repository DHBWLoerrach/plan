import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { generateCoursePlan } from "@/lib/domain/generated-course-plan";
import { createCourse } from "@/lib/services/course-admin";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-technik', 'Technik', 'technik');
    INSERT INTO programs VALUES ('prog-tif', 'area-technik', 'Informatik', 'TIF', 6);
    INSERT INTO users VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area-technik');`);
  return sqlite;
}

const period = { studyStart: "2026-10-01", studyEnd: "2029-09-30", semesters: 6 } as const;
const newCourse = { accountId: "editor", code: "TIF26A", programId: "prog-tif", studyStart: period.studyStart, studyEnd: period.studyEnd };
const plan = generateCoursePlan({ ...period, startType: "THEORY" });

function phasesOf(sqlite: Database.Database, courseId: string) {
  return sqlite.prepare("SELECT semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM course_phases WHERE course_id = ? ORDER BY start_date").all(courseId);
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createCourse with a generated course progression", () => {
  it("writes every generated phase with the course", () => {
    const sqlite = database();
    const id = createCourse(sqlite, { ...newCourse, plan });
    expect(phasesOf(sqlite, id)).toEqual(plan);
  });

  it("takes the progression as it was adjusted in the form", () => {
    const sqlite = database();
    const adjusted = plan.map((phase, index) => index === 0 ? { ...phase, endDate: "2026-12-20" }
      : index === 1 ? { ...phase, startDate: "2026-12-21" } : phase);
    const id = createCourse(sqlite, { ...newCourse, plan: adjusted });
    expect(phasesOf(sqlite, id)).toMatchObject([{ endDate: "2026-12-20" }, { startDate: "2026-12-21" }, ...plan.slice(2)]);
  });

  it("refuses a progression with a gap and leaves nothing behind", () => {
    const sqlite = database();
    const withGap = plan.map((phase, index) => index === 0 ? { ...phase, endDate: "2026-12-01" } : phase);
    expect(() => createCourse(sqlite, { ...newCourse, plan: withGap })).toThrow("lückenlos");
    expect(sqlite.prepare("SELECT count(*) AS count FROM courses").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_phases").get()).toEqual({ count: 0 });
  });

  it("refuses a progression that leaves the study period", () => {
    const sqlite = database();
    const short = plan.map((phase, index) => index === plan.length - 1 ? { ...phase, endDate: "2029-09-29" } : phase);
    expect(() => createCourse(sqlite, { ...newCourse, plan: short })).toThrow("Studienende");
    expect(sqlite.prepare("SELECT count(*) AS count FROM courses").get()).toEqual({ count: 0 });
  });

  it("refuses a semester beyond the study program and a semester that falls back along the time axis", () => {
    const sqlite = database();
    expect(() => createCourse(sqlite, { ...newCourse, plan: plan.map((phase) => ({ ...phase, semester: 7 })) })).toThrow("1 bis 6");
    const backwards = plan.map((phase, index) => index === 4 ? { ...phase, semester: 1 } : phase);
    expect(() => createCourse(sqlite, { ...newCourse, plan: backwards })).toThrow("aufsteigen");
    // Moving a semester boundary is allowed: three phases in the first semester and one in the second still ascend.
    const shifted = plan.map((phase, index) => index === 2 ? { ...phase, semester: 1 } : phase);
    expect(() => createCourse(sqlite, { ...newCourse, plan: shifted })).not.toThrow();
  });

  it("refuses a course that is created from a template and with a progression at once", () => {
    const sqlite = database();
    expect(() => createCourse(sqlite, { ...newCourse, plan, adoption: { templateCourseId: "egal", withPhases: true, withEvents: true } }))
      .toThrow("entweder aus einer Vorlage");
  });
});
