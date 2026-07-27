
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { StaleStateError, publishBlockPlan, readPublicationPreview, withdrawBlockPlan } from "@/lib/services/publication";
import { applySchema } from "@/test/schema";

const draftUpdatedAt = "2026-01-01T00:00:00.000Z";

function databaseWithPublishablePlan() {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
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

/** Publishes the fixture draft as the editor currently sees it. */
function publish(sqlite: Database.Database, seenPublishedVersionId: string | null = null) {
  return publishBlockPlan(sqlite, { blockPlanId: "plan-1", accountId: "editor-1", seenDraftUpdatedAt: draftUpdatedAt, seenPublishedVersionId });
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

  it("copies course phases and events onto the course snapshots of the same version", () => {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec(`
      INSERT INTO draft_events VALUES ('event-1', 'plan-1', 'Prüfung', NULL, 'EXAM', '2026-10-15', NULL, 1);
      INSERT INTO draft_event_courses VALUES ('event-1', 'course-1');
    `);

    const version = publish(sqlite);

    // A published version is fully self-contained (ADR 0009): nothing inside it may point at a draft row or at a
    // snapshot of another version.
    const snapshot = sqlite.prepare("SELECT id FROM published_course_snapshots WHERE version_id = ?").get(version.id) as { id: string };
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_phases WHERE version_id = ? AND course_snapshot_id = ?").get(version.id, snapshot.id)).toEqual({ count: 6 });
    expect(sqlite.prepare("SELECT title, provisional FROM published_events WHERE version_id = ?").all(version.id)).toEqual([{ title: "Prüfung", provisional: 1 }]);
    expect(sqlite.prepare("SELECT course_snapshot_id AS courseSnapshotId FROM published_event_courses").all()).toEqual([{ courseSnapshotId: snapshot.id }]);
  });

  it("rejects a publication when the viewed draft is stale", () => {
    const sqlite = databaseWithPublishablePlan();

    // The editor must be able to tell this apart from any other refusal: only here it reloads the preview and asks
    // for a fresh release instead of showing an error at the button (MVP-SPEZIFIKATION.md).
    expect(() => publishBlockPlan(sqlite, {
      blockPlanId: "plan-1", accountId: "editor-1", seenDraftUpdatedAt: "outdated", seenPublishedVersionId: null,
    })).toThrow(StaleStateError);
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_versions").get()).toEqual({ count: 0 });
  });

  it("refuses a draft that violates a publication rule", () => {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec("DELETE FROM draft_phases WHERE id = 'phase-6'");

    expect(() => publish(sqlite)).toThrow("Studienende");
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_versions").get()).toEqual({ count: 0 });
  });

  it("refuses a course that another published version still shows", () => {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec(`
      INSERT INTO block_plans VALUES ('plan-2', 'area-1', NULL, NULL, 1, '${draftUpdatedAt}', 'editor-1');
      INSERT INTO published_versions VALUES ('version-2', 'plan-2', '${draftUpdatedAt}', '2026 · TIF26A', 'Informatik');
      INSERT INTO published_course_snapshots VALUES ('snapshot-2', 'version-2', 'course-1', 'TIF26A', 'Informatik', 'TIF', '2026-10-01', '2027-03-31', 6);
    `);

    expect(() => publish(sqlite)).toThrow("bereits in einer anderen veröffentlichten Fassung");
    expect(sqlite.prepare("SELECT block_plan_id AS blockPlanId FROM published_versions").all()).toEqual([{ blockPlanId: "plan-2" }]);
  });

  it("is backed by a database constraint against a second public snapshot of the same course", () => {
    const sqlite = databaseWithPublishablePlan();
    publish(sqlite);
    sqlite.exec(`
      INSERT INTO block_plans VALUES ('plan-2', 'area-1', NULL, NULL, 0, '${draftUpdatedAt}', 'editor-1');
      INSERT INTO published_versions VALUES ('version-2', 'plan-2', '${draftUpdatedAt}', '2026 · TIF26A', 'Informatik');
    `);

    // The application check refuses first, but only the constraint holds when two publications race
    // (ARCHITEKTUR_UND_BETRIEB.md).
    expect(() => sqlite.exec("INSERT INTO published_course_snapshots VALUES ('snapshot-x', 'version-2', 'course-1', 'TIF26A', 'Informatik', 'TIF', '2026-10-01', '2027-03-31', 6)"))
      .toThrow(/UNIQUE constraint failed/);
  });

  it("replaces its own previous version and keeps one public snapshot per course", () => {
    const sqlite = databaseWithPublishablePlan();
    const first = publish(sqlite);

    const second = publish(sqlite, first.id);

    expect(second.id).not.toBe(first.id);
    expect(sqlite.prepare("SELECT id FROM published_versions").all()).toEqual([{ id: second.id }]);
    expect(sqlite.prepare("SELECT source_course_id AS sourceCourseId FROM published_course_snapshots").all()).toEqual([{ sourceCourseId: "course-1" }]);
  });

  it("leaves the draft it copied untouched", () => {
    const sqlite = databaseWithPublishablePlan();

    publish(sqlite);

    expect(sqlite.prepare("SELECT count(*) AS count FROM draft_phases").get()).toEqual({ count: 6 });
    expect(sqlite.prepare("SELECT draft_updated_at AS updatedAt FROM block_plans WHERE id = 'plan-1'").get()).toEqual({ updatedAt: draftUpdatedAt });
  });

  it("refuses an account without permission for the area", () => {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec("DELETE FROM area_assignments WHERE user_id = 'editor-1'");

    expect(() => publish(sqlite)).toThrow("nicht zur Bearbeitung dieses Bereichs berechtigt");
    expect(sqlite.prepare("SELECT count(*) AS count FROM published_versions").get()).toEqual({ count: 0 });
  });
});

describe("withdrawBlockPlan", () => {
  function databaseWithPublishedPlan() {
    const sqlite = databaseWithPublishablePlan();
    sqlite.exec(`
      INSERT INTO draft_events VALUES ('event-1', 'plan-1', 'Prüfung', NULL, 'EXAM', '2026-10-15', NULL, 0);
      INSERT INTO draft_event_courses VALUES ('event-1', 'course-1');
    `);
    return { sqlite, version: publish(sqlite) };
  }

  it("removes exactly the shown version with everything it made public and keeps the draft", () => {
    const { sqlite, version } = databaseWithPublishedPlan();

    withdrawBlockPlan(sqlite, { blockPlanId: "plan-1", accountId: "editor-1", seenPublishedVersionId: version.id });

    for (const table of ["published_versions", "published_course_snapshots", "published_phases", "published_events", "published_event_courses"]) {
      expect(sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
    expect(sqlite.prepare("SELECT count(*) AS count FROM draft_phases").get()).toEqual({ count: 6 });
    expect(sqlite.prepare("SELECT count(*) AS count FROM draft_events").get()).toEqual({ count: 1 });
    // The block plan stays withdrawn rather than never published, so the editor can tell the two states apart.
    expect(sqlite.prepare("SELECT has_ever_been_published AS value FROM block_plans WHERE id = 'plan-1'").get()).toEqual({ value: 1 });
  });

  it("rejects a version that is no longer the published one", () => {
    const { sqlite, version } = databaseWithPublishedPlan();
    const replacement = publish(sqlite, version.id);

    expect(() => withdrawBlockPlan(sqlite, {
      blockPlanId: "plan-1", accountId: "editor-1", seenPublishedVersionId: version.id,
    })).toThrow(StaleStateError);
    expect(sqlite.prepare("SELECT id FROM published_versions").all()).toEqual([{ id: replacement.id }]);
  });

  it("rejects a withdrawal of a block plan that is not published at all", () => {
    const sqlite = databaseWithPublishablePlan();

    expect(() => withdrawBlockPlan(sqlite, {
      blockPlanId: "plan-1", accountId: "editor-1", seenPublishedVersionId: "version-gone",
    })).toThrow(StaleStateError);
  });

  it("refuses an account without permission for the area", () => {
    const { sqlite, version } = databaseWithPublishedPlan();
    sqlite.exec("DELETE FROM area_assignments WHERE user_id = 'editor-1'");

    expect(() => withdrawBlockPlan(sqlite, {
      blockPlanId: "plan-1", accountId: "editor-1", seenPublishedVersionId: version.id,
    })).toThrow("nicht zur Bearbeitung dieses Bereichs berechtigt");
    expect(sqlite.prepare("SELECT id FROM published_versions").all()).toEqual([{ id: version.id }]);
  });
});
