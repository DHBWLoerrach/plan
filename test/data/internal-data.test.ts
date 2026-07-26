import { readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  blockPlanCourses,
  blockPlanDraftEvents,
  blockPlanDraftPhases,
  blockPlanSummaries,
  findInternalBlockPlan,
  listInternalBlockPlans,
} from "@/app/intern/blockplaene/data";
import {
  accountAreaOptions,
  findManagedAccount,
  listAccounts,
} from "@/app/intern/konten/data";
import {
  courseListData,
  findInternalCourse,
  programOptions,
} from "@/app/intern/kurse/data";

const databases: Database.Database[] = [];
const systemAdmin = { id: "admin", systemAdmin: true };
const technicalEditor = { id: "editor-tech", systemAdmin: false };
const noFilters = { area: null, program: null, year: null, assignment: null } as const;

function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  sqlite.exec(readFileSync(path.join(process.cwd(), "migrations/0000_initial.sql"), "utf8"));

  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-tech", "Technik", "technik");
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-business", "Wirtschaft", "wirtschaft");
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)").run(
    "program-tech", "area-tech", "Informatik", "TIF", 6,
  );
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)").run(
    "program-business", "area-business", "Wirtschaftsinformatik", "WWI", 6,
  );

  insertAccount(sqlite, { id: "admin", email: "admin@example.test", role: "NONE", systemAdmin: 1 });
  insertAccount(sqlite, { id: "editor-tech", email: "tech@example.test", role: "AREA_EDITOR" });
  insertAccount(sqlite, { id: "editor-business", email: "business@example.test", role: "AREA_EDITOR" });
  insertAccount(sqlite, { id: "locked-editor", email: "locked@example.test", role: "AREA_EDITOR", status: "LOCKED" });
  sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("editor-tech", "area-tech");
  sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("editor-business", "area-business");
  sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run("locked-editor", "area-business");

  sqlite.prepare(`INSERT INTO block_plans
    (id, area_id, name, normalized_name, has_ever_been_published, draft_updated_at, draft_updated_by_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "plan-tech", "area-tech", "Technikplan", "technikplan", 0, "2030-01-01T10:00:00.000Z", "editor-tech",
  );
  sqlite.prepare(`INSERT INTO block_plans
    (id, area_id, name, normalized_name, has_ever_been_published, draft_updated_at, draft_updated_by_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "plan-business", "area-business", "Wirtschaftsplan", "wirtschaftsplan", 0, "2030-01-02T10:00:00.000Z", "editor-business",
  );

  insertCourse(sqlite, {
    id: "course-tech-assigned",
    programId: "program-tech",
    blockPlanId: "plan-tech",
    code: "TIF24A",
  });
  insertCourse(sqlite, {
    id: "course-tech-unassigned",
    programId: "program-tech",
    blockPlanId: null,
    code: "TIF24B",
  });
  insertCourse(sqlite, {
    id: "course-business",
    programId: "program-business",
    blockPlanId: "plan-business",
    code: "WWI24A",
  });

  sqlite.prepare(`INSERT INTO draft_phases
    (id, block_plan_id, course_id, semester, phase_type, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "phase-tech", "plan-tech", "course-tech-assigned", 1, "THEORY", "2024-10-01", "2024-12-31",
  );
  sqlite.prepare(`INSERT INTO draft_events
    (id, block_plan_id, title, description, category, start_date, end_date, provisional)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "event-tech", "plan-tech", "Prüfung", null, "EXAM", "2024-12-15", null, 1,
  );
  sqlite.prepare("INSERT INTO draft_event_courses (event_id, course_id) VALUES (?, ?)").run(
    "event-tech", "course-tech-assigned",
  );

  return sqlite;
}

function insertAccount(sqlite: Database.Database, input: {
  id: string;
  email: string;
  role: "NONE" | "AREA_EDITOR";
  systemAdmin?: number;
  status?: "PASSWORD_PENDING" | "ACTIVE" | "LOCKED";
}) {
  sqlite.prepare(`INSERT INTO user
    (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`).run(
    input.id,
    input.email,
    input.email,
    input.role,
    input.systemAdmin ?? 0,
    input.status ?? "ACTIVE",
    Date.now(),
    Date.now(),
  );
}

function insertCourse(sqlite: Database.Database, input: {
  id: string;
  programId: string;
  blockPlanId: string | null;
  code: string;
}) {
  sqlite.prepare(`INSERT INTO courses
    (id, program_id, block_plan_id, code, normalized_code, study_start, study_end)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    input.id,
    input.programId,
    input.blockPlanId,
    input.code,
    input.code.toLowerCase(),
    "2024-10-01",
    "2027-09-30",
  );
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("internal account data", () => {
  it("rejects every account read for a non-system-administration account", () => {
    const sqlite = createDatabase();

    expect(() => listAccounts(sqlite, technicalEditor)).toThrow("nicht zur Kontoverwaltung berechtigt");
    expect(() => accountAreaOptions(sqlite, technicalEditor)).toThrow("nicht zur Kontoverwaltung berechtigt");
    expect(() => findManagedAccount(sqlite, technicalEditor, "editor-business")).toThrow("nicht zur Kontoverwaltung berechtigt");
  });

  it("returns filtered account details and permission options to system administration", () => {
    const sqlite = createDatabase();

    expect(listAccounts(sqlite, systemAdmin, "LOCKED")).toEqual([{
      id: "locked-editor",
      email: "locked@example.test",
      role: "AREA_EDITOR",
      systemAdmin: 0,
      status: "LOCKED",
      areas: "Wirtschaft",
    }]);
    expect(accountAreaOptions(sqlite, systemAdmin)).toEqual([
      { id: "area-tech", name: "Technik" },
      { id: "area-business", name: "Wirtschaft" },
    ]);
    expect(findManagedAccount(sqlite, systemAdmin, "editor-tech")).toEqual({
      account: {
        id: "editor-tech",
        email: "tech@example.test",
        role: "AREA_EDITOR",
        systemAdmin: 0,
        status: "ACTIVE",
      },
      areas: [
        { id: "area-tech", name: "Technik" },
        { id: "area-business", name: "Wirtschaft" },
      ],
      areaIds: ["area-tech"],
    });
  });
});

describe("internal course data", () => {
  it("limits list data, filters and program options to manageable areas", () => {
    const sqlite = createDatabase();

    const list = courseListData(sqlite, technicalEditor, noFilters);
    expect(list.areas).toEqual([{ id: "area-tech", name: "Technik" }]);
    expect(list.programs).toEqual([{ id: "program-tech", name: "Informatik" }]);
    expect(list.years).toEqual([{ year: "2024" }]);
    expect(list.courses.map((course) => course.code)).toEqual(["TIF24A", "TIF24B"]);
    expect(courseListData(sqlite, technicalEditor, { ...noFilters, assignment: "unassigned" }).courses)
      .toMatchObject([{ id: "course-tech-unassigned", code: "TIF24B", blockPlanId: null }]);
    expect(programOptions(sqlite, technicalEditor)).toEqual([{
      id: "program-tech",
      label: "TIF — Informatik (Technik)",
    }]);
  });

  it("hides foreign course details while system administration may read them", () => {
    const sqlite = createDatabase();

    expect(findInternalCourse(sqlite, "course-business", technicalEditor)).toBeUndefined();
    expect(findInternalCourse(sqlite, "course-business", systemAdmin)).toMatchObject({
      id: "course-business",
      code: "WWI24A",
      programId: "program-business",
    });
  });
});

describe("internal block plan data", () => {
  it("limits plan lists and details to manageable areas", () => {
    const sqlite = createDatabase();

    expect(listInternalBlockPlans(sqlite, technicalEditor).map((plan) => plan.id)).toEqual(["plan-tech"]);
    expect(findInternalBlockPlan(sqlite, "plan-business", technicalEditor)).toBeUndefined();
    expect(listInternalBlockPlans(sqlite, systemAdmin).map((plan) => plan.id)).toEqual([
      "plan-business",
      "plan-tech",
    ]);
    expect(findInternalBlockPlan(sqlite, "plan-business", systemAdmin)).toMatchObject({
      id: "plan-business",
      name: "Wirtschaftsplan",
      areaName: "Wirtschaft",
    });
  });

  it("returns the minimal draft data and summaries used by the workspace", () => {
    const sqlite = createDatabase();

    expect(blockPlanCourses(sqlite, "plan-tech")).toMatchObject([{
      id: "course-tech-assigned",
      code: "TIF24A",
      program: "Informatik",
      semesters: 6,
    }]);
    expect(blockPlanDraftPhases(sqlite, "plan-tech")).toEqual([{
      id: "phase-tech",
      courseId: "course-tech-assigned",
      semester: 1,
      type: "THEORY",
      startDate: "2024-10-01",
      endDate: "2024-12-31",
      code: "TIF24A",
    }]);
    expect(blockPlanDraftEvents(sqlite, "plan-tech")).toEqual([{
      id: "event-tech",
      title: "Prüfung",
      description: null,
      category: "EXAM",
      startDate: "2024-12-15",
      endDate: null,
      provisional: true,
      courseIds: ["course-tech-assigned"],
    }]);
    expect(blockPlanSummaries(sqlite, ["plan-tech"]).get("plan-tech")).toEqual({
      displayName: "Technikplan",
      courseCodes: ["TIF24A"],
    });
  });
});
