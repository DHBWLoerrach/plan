import { readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { StalePreviewError, publishBlockPlan, readPublicationPreview } from "@/lib/services/publication";

function databaseWithPublishablePlan() {
  const sqlite = new Database(":memory:");
  sqlite.exec(readFileSync(path.join(process.cwd(), "drizzle/0000_initial.sql"), "utf8"));
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-1', 'Informatik', 'informatik');
    INSERT INTO programs VALUES ('program-1', 'area-1', 'Informatik', 'TIF', 6);
    INSERT INTO user VALUES ('editor-1', 'editor@example.test', 'editor@example.test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor-1', 'area-1');
    INSERT INTO block_plans VALUES ('plan-1', 'area-1', NULL, NULL, 0, '2026-01-01T00:00:00.000Z', 'editor-1');
    INSERT INTO courses VALUES ('course-1', 'program-1', 'plan-1', 'TIF26A', 'tif26a', '2026-10-01', '2027-03-31');
    INSERT INTO draft_phases VALUES ('phase-1', 'plan-1', 'course-1', 1, 'THEORY', '2026-10-01', '2026-10-31');
    INSERT INTO draft_phases VALUES ('phase-2', 'plan-1', 'course-1', 2, 'PRACTICE', '2026-11-01', '2026-11-30');
    INSERT INTO draft_phases VALUES ('phase-3', 'plan-1', 'course-1', 3, 'THEORY', '2026-12-01', '2026-12-31');
    INSERT INTO draft_phases VALUES ('phase-4', 'plan-1', 'course-1', 4, 'PRACTICE', '2027-01-01', '2027-01-31');
    INSERT INTO draft_phases VALUES ('phase-5', 'plan-1', 'course-1', 5, 'THEORY', '2027-02-01', '2027-02-28');
    INSERT INTO draft_phases VALUES ('phase-6', 'plan-1', 'course-1', 6, 'PRACTICE', '2027-03-01', '2027-03-31');
  `);
  return sqlite;
}

describe("readPublicationPreview", () => {
  it("reports no issue for a publishable draft", () => {
    const sqlite = databaseWithPublishablePlan();

    expect(readPublicationPreview(sqlite, "plan-1")?.issues).toEqual([]);
  });

  it("reports the missing course phase of an incomplete draft per semester", () => {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec("DELETE FROM draft_phases WHERE id = 'phase-3'");

    const issues = readPublicationPreview(sqlite, "plan-1")?.issues ?? [];

    expect(issues).toContainEqual(expect.objectContaining({ code: "semester-missing", semester: 3, courseId: "course-1" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "coverage-gap", semester: 4, field: "startDate" }));
  });

  it("reports a course that another published version still shows", () => {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec(`
      INSERT INTO block_plans VALUES ('plan-2', 'area-1', NULL, NULL, 1, '2026-01-01T00:00:00.000Z', 'editor-1');
      INSERT INTO published_versions VALUES ('version-2', 'plan-2', '2026-01-01T00:00:00.000Z', '2026 · TIF26A', 'Informatik');
      INSERT INTO published_course_snapshots VALUES ('snapshot-2', 'version-2', 'course-1', 'TIF26A', 'Informatik', 'TIF', '2026-10-01', '2027-03-31', 6);
    `);

    expect(readPublicationPreview(sqlite, "plan-1")?.issues).toContainEqual(
      expect.objectContaining({ code: "course-published-elsewhere", courseId: "course-1" }),
    );
  });

  it("reports a block plan without any course", () => {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec("DELETE FROM draft_phases; UPDATE courses SET block_plan_id = NULL WHERE id = 'course-1'");

    expect(readPublicationPreview(sqlite, "plan-1")?.issues).toEqual([
      expect.objectContaining({ code: "block-plan-without-course" }),
    ]);
  });

  it("reports an unknown block plan as absent", () => {
    expect(readPublicationPreview(databaseWithPublishablePlan(), "plan-unknown")).toBeNull();
  });
});

describe("publishBlockPlan", () => {
  it("creates an independent public snapshot and marks the block plan as published", () => {
    const sqlite = databaseWithPublishablePlan();

    const version = publishBlockPlan(sqlite, {
      blockPlanId: "plan-1",
      accountId: "editor-1",
      seenDraftUpdatedAt: "2026-01-01T00:00:00.000Z",
      seenPublishedVersionId: null,
    });

    expect(version.blockPlanName).toBe("2026 · TIF26A");
    expect(sqlite.prepare("SELECT has_ever_been_published AS value FROM block_plans WHERE id = 'plan-1'").get()).toEqual({ value: 1 });
    expect(sqlite.prepare("SELECT code, study_start, study_end FROM published_course_snapshots").all()).toEqual([
      { code: "TIF26A", study_start: "2026-10-01", study_end: "2027-03-31" },
    ]);
  });

  it("rejects a publication when the viewed draft is stale", () => {
    const sqlite = databaseWithPublishablePlan();

    // The editor must be able to tell this apart from any other refusal: only here it reloads the preview and asks
    // for a fresh release instead of showing an error at the button (MVP-SPEZIFIKATION.md).
    expect(() => publishBlockPlan(sqlite, {
      blockPlanId: "plan-1", accountId: "editor-1", seenDraftUpdatedAt: "outdated", seenPublishedVersionId: null,
    })).toThrow(StalePreviewError);
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_versions").get()).toEqual({ count: 0 });
  });

  it("refuses a draft that violates a publication rule", () => {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec("DELETE FROM draft_phases WHERE id = 'phase-6'");

    expect(() => publishBlockPlan(sqlite, {
      blockPlanId: "plan-1", accountId: "editor-1", seenDraftUpdatedAt: "2026-01-01T00:00:00.000Z", seenPublishedVersionId: null,
    })).toThrow("Studienende");
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_versions").get()).toEqual({ count: 0 });
  });
});
