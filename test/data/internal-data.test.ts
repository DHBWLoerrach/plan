import { applySchema } from "@/test/schema";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  type BlockPlanListFilters,
  blockPlanCourses,
  blockPlanDraftEvents,
  blockPlanDraftPhases,
  blockPlanListData,
  blockPlanSummaries,
  findInternalBlockPlan,
  incompleteDrafts,
} from "@/app/intern/blockplaene/data";
import {
  accountAreaOptions,
  findManagedAccount,
  listAccounts,
} from "@/app/intern/konten/data";
import {
  type CourseSort,
  courseListData,
  findInternalCourse,
  programOptions,
} from "@/app/intern/kurse/data";

const databases: Database.Database[] = [];
const systemAdmin = { id: "admin", systemAdmin: true };
const technicalEditor = { id: "editor-tech", systemAdmin: false };
const noFilters = { area: null, program: null, year: null, assignment: null } as const;
const noPlanFilters: BlockPlanListFilters = { area: null, year: null, course: null, state: null };

/** A draft that covers the whole study period contiguously and therefore violates no publication rule. */
const completeDraft = [
  { semester: 1, type: "THEORY", startDate: "2024-10-01", endDate: "2025-03-31" },
  { semester: 2, type: "PRACTICE", startDate: "2025-04-01", endDate: "2025-09-30" },
  { semester: 3, type: "THEORY", startDate: "2025-10-01", endDate: "2026-03-31" },
  { semester: 4, type: "PRACTICE", startDate: "2026-04-01", endDate: "2026-09-30" },
  { semester: 5, type: "THEORY", startDate: "2026-10-01", endDate: "2027-03-31" },
  { semester: 6, type: "PRACTICE", startDate: "2027-04-01", endDate: "2027-09-30" },
] as const;

function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);

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
    "plan-business", "area-business", "Wirtschaftsplan", "wirtschaftsplan", 1, "2030-01-02T10:00:00.000Z", "editor-business",
  );
  // Withdrawn: published once, without a published version today.
  sqlite.prepare(`INSERT INTO block_plans
    (id, area_id, name, normalized_name, has_ever_been_published, draft_updated_at, draft_updated_by_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "plan-tech-2025", "area-tech", null, null, 1, "2030-01-03T10:00:00.000Z", "editor-tech",
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
    id: "course-tech-2025",
    programId: "program-tech",
    blockPlanId: "plan-tech-2025",
    code: "TIF25A",
    studyStart: "2025-10-01",
    studyEnd: "2028-09-30",
  });
  insertCourse(sqlite, {
    id: "course-business",
    programId: "program-business",
    blockPlanId: "plan-business",
    code: "WWI24A",
  });

  publish(sqlite, { versionId: "version-business", blockPlanId: "plan-business", name: "Wirtschaftsplan", areaName: "Wirtschaft", courseId: "course-business", code: "WWI24A" });
  for (const [index, phase] of completeDraft.entries()) {
    sqlite.prepare(`INSERT INTO draft_phases
      (id, block_plan_id, course_id, semester, phase_type, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      `phase-business-${index}`, "plan-business", "course-business", phase.semester, phase.type, phase.startDate, phase.endDate,
    );
  }

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

/** The first column of each index on a table — the only ones a lookup on that column can use. */
function indexedColumns(sqlite: Database.Database, table: string): (string | undefined)[] {
  const indexes = sqlite.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[];
  return indexes.map((index) => (sqlite.prepare(`PRAGMA index_info(${index.name})`).all() as { seqno: number; name: string }[])
    .find((column) => column.seqno === 0)?.name);
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
  studyStart?: string;
  studyEnd?: string;
}) {
  sqlite.prepare(`INSERT INTO courses
    (id, program_id, block_plan_id, code, normalized_code, study_start, study_end)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    input.id,
    input.programId,
    input.blockPlanId,
    input.code,
    input.code.toLowerCase(),
    input.studyStart ?? "2024-10-01",
    input.studyEnd ?? "2027-09-30",
  );
}

function publish(sqlite: Database.Database, input: {
  versionId: string;
  blockPlanId: string;
  name: string;
  areaName: string;
  courseId: string;
  code: string;
}) {
  sqlite.prepare("INSERT INTO published_versions (id, block_plan_id, published_at, block_plan_name, area_name) VALUES (?, ?, ?, ?, ?)")
    .run(input.versionId, input.blockPlanId, "2030-01-02T11:00:00.000Z", input.name, input.areaName);
  sqlite.prepare(`INSERT INTO published_course_snapshots
    (id, version_id, source_course_id, code, program_name, program_abbreviation, study_start, study_end, semesters)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    `snapshot-${input.courseId}`, input.versionId, input.courseId, input.code, "Wirtschaftsinformatik", "WWI", "2024-10-01", "2027-09-30", 6,
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

    const list = courseListData(sqlite, technicalEditor, noFilters, "code");
    expect(list.areas).toEqual([{ id: "area-tech", name: "Technik" }]);
    expect(list.programs).toEqual([{ id: "program-tech", name: "Informatik" }]);
    expect(list.years).toEqual([{ year: "2025" }, { year: "2024" }]);
    expect(list.courses.map((course) => course.code)).toEqual(["TIF24A", "TIF24B", "TIF25A"]);
    expect(courseListData(sqlite, technicalEditor, { ...noFilters, assignment: "unassigned" }, "code").courses)
      .toMatchObject([{ id: "course-tech-unassigned", code: "TIF24B", blockPlanId: null }]);
    expect(programOptions(sqlite, technicalEditor)).toEqual([{
      id: "program-tech",
      label: "TIF — Informatik (Technik)",
    }]);
  });

  it("sorts the course list reproducibly by the requested order", () => {
    const sqlite = createDatabase();
    const codes = (sort: CourseSort) => courseListData(sqlite, systemAdmin, noFilters, sort).courses.map((course) => course.code);

    expect(codes("code")).toEqual(["TIF24A", "TIF24B", "TIF25A", "WWI24A"]);
    // Same year: the course code decides, so the order never depends on insertion or query chance.
    expect(codes("year")).toEqual(["TIF25A", "TIF24A", "TIF24B", "WWI24A"]);
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
  it("limits plan lists, filter options and details to manageable areas", () => {
    const sqlite = createDatabase();

    const list = blockPlanListData(sqlite, technicalEditor, noPlanFilters, "draft");
    expect(list.areas).toEqual([{ id: "area-tech", name: "Technik" }]);
    expect(list.years).toEqual([2025, 2024]);
    expect(list.plans.map((plan) => plan.id)).toEqual(["plan-tech-2025", "plan-tech"]);
    // A filter naming a foreign area returns nothing instead of that area's plans.
    expect(blockPlanListData(sqlite, technicalEditor, { ...noPlanFilters, area: "area-business" }, "draft").plans).toEqual([]);
    expect(findInternalBlockPlan(sqlite, "plan-business", technicalEditor)).toBeUndefined();

    expect(blockPlanListData(sqlite, systemAdmin, noPlanFilters, "draft").plans.map((plan) => plan.id)).toEqual([
      "plan-tech-2025",
      "plan-business",
      "plan-tech",
    ]);
    expect(findInternalBlockPlan(sqlite, "plan-business", systemAdmin)).toMatchObject({
      id: "plan-business",
      name: "Wirtschaftsplan",
      areaName: "Wirtschaft",
    });
  });

  it("describes every listed plan by its display name, year and publication state", () => {
    const sqlite = createDatabase();

    expect(blockPlanListData(sqlite, systemAdmin, noPlanFilters, "draft").plans).toEqual([
      {
        id: "plan-tech-2025",
        displayName: "2025 · TIF25A",
        courseCodes: ["TIF25A"],
        areaId: "area-tech",
        areaName: "Technik",
        year: 2025,
        state: "withdrawn",
        draftUpdatedAt: "2030-01-03T10:00:00.000Z",
        draftUpdatedBy: "tech@example.test",
      },
      {
        id: "plan-business",
        displayName: "Wirtschaftsplan",
        courseCodes: ["WWI24A"],
        areaId: "area-business",
        areaName: "Wirtschaft",
        year: 2024,
        state: "published",
        draftUpdatedAt: "2030-01-02T10:00:00.000Z",
        draftUpdatedBy: "business@example.test",
      },
      {
        id: "plan-tech",
        displayName: "Technikplan",
        courseCodes: ["TIF24A"],
        areaId: "area-tech",
        areaName: "Technik",
        year: 2024,
        state: "never-published",
        draftUpdatedAt: "2030-01-01T10:00:00.000Z",
        draftUpdatedBy: "tech@example.test",
      },
    ]);
  });

  it("combines area, year, course code and publication state filters with AND", () => {
    const sqlite = createDatabase();
    const ids = (filters: Partial<BlockPlanListFilters>) =>
      blockPlanListData(sqlite, systemAdmin, { ...noPlanFilters, ...filters }, "draft").plans.map((plan) => plan.id);

    expect(ids({ area: "area-tech" })).toEqual(["plan-tech-2025", "plan-tech"]);
    expect(ids({ year: "2024" })).toEqual(["plan-business", "plan-tech"]);
    // The course filter matches the beginning of a course code without regard to case.
    expect(ids({ course: "tif" })).toEqual(["plan-tech-2025", "plan-tech"]);
    expect(ids({ course: "TIF24" })).toEqual(["plan-tech"]);
    expect(ids({ course: "24A" })).toEqual([]);
    expect(ids({ state: "published" })).toEqual(["plan-business"]);
    expect(ids({ state: "withdrawn" })).toEqual(["plan-tech-2025"]);
    expect(ids({ state: "never-published" })).toEqual(["plan-tech"]);
    expect(ids({ area: "area-tech", year: "2024" })).toEqual(["plan-tech"]);
    expect(ids({ area: "area-tech", state: "published" })).toEqual([]);
  });

  it("sorts reproducibly by the requested order", () => {
    const sqlite = createDatabase();

    expect(blockPlanListData(sqlite, systemAdmin, noPlanFilters, "name").plans.map((plan) => plan.displayName)).toEqual([
      "2025 · TIF25A",
      "Technikplan",
      "Wirtschaftsplan",
    ]);
    // Same year: the display name decides, so the order never depends on insertion or query chance.
    expect(blockPlanListData(sqlite, systemAdmin, noPlanFilters, "year").plans.map((plan) => plan.id)).toEqual([
      "plan-tech-2025",
      "plan-tech",
      "plan-business",
    ]);
  });

  it("names the drafts that still violate publication rules", () => {
    const sqlite = createDatabase();

    const plans = blockPlanListData(sqlite, systemAdmin, noPlanFilters, "draft").plans;
    const incomplete = incompleteDrafts(sqlite, plans);

    // The complete draft of plan-business is absent; the other two keep the hint with a countable number of issues.
    expect(incomplete.map((draft) => draft.id)).toEqual(["plan-tech-2025", "plan-tech"]);
    for (const draft of incomplete) expect(draft.issueCount).toBeGreaterThan(0);
    expect(incompleteDrafts(sqlite, blockPlanListData(sqlite, technicalEditor, noPlanFilters, "draft").plans)
      .map((draft) => draft.id)).toEqual(["plan-tech-2025", "plan-tech"]);
  });

  it("reaches the draft rows of a single block plan by index", () => {
    const sqlite = createDatabase();

    // The start page checks every plan of the account this way. Without an index on the foreign key
    // each of those checks scans the phase and event tables of all plans, so the page costs the
    // square of the number of block plans instead of growing with it.
    for (const table of ["courses", "draft_phases", "draft_events"]) {
      expect(indexedColumns(sqlite, table)).toContain("block_plan_id");
    }
    // Detaching a course deletes its phases and event links by course, and deleting the course has
    // SQLite look for rows still referencing it.
    expect(indexedColumns(sqlite, "draft_phases")).toContain("course_id");
    expect(indexedColumns(sqlite, "draft_event_courses")).toContain("course_id");
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
