import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { type DraftCourse, type DraftEvent, type DraftPhase, validatePublication } from "@/lib/domain/publication";
import { assertAreaEditPermission } from "@/lib/services/authorization";

type PublicationRequest = {
  blockPlanId: string;
  accountId: string;
  seenDraftUpdatedAt: string;
  seenPublishedVersionId: string | null;
};

type PlanRow = { id: string; areaId: string; name: string | null; draftUpdatedAt: string; areaName: string };
type CourseRow = DraftCourse & { program: string; programAbbreviation: string };

function readDraft(sqlite: Database.Database, blockPlanId: string) {
  const plan = sqlite.prepare(`SELECT plan.id, plan.area_id AS areaId, plan.name, plan.draft_updated_at AS draftUpdatedAt, area.name AS areaName
    FROM block_plans plan JOIN areas area ON area.id = plan.area_id WHERE plan.id = ?`).get(blockPlanId) as PlanRow | undefined;
  if (!plan) throw new Error("Der Blockplan wurde nicht gefunden.");
  const courses = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd,
      program.semesters, program.name AS program, program.abbreviation AS programAbbreviation
    FROM courses course JOIN programs program ON program.id = course.program_id WHERE course.block_plan_id = ?`).all(blockPlanId) as CourseRow[];
  const phases = sqlite.prepare("SELECT course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM draft_phases WHERE block_plan_id = ?").all(blockPlanId) as DraftPhase[];
  const eventRows = sqlite.prepare("SELECT id, title, category, start_date AS startDate, end_date AS endDate, provisional FROM draft_events WHERE block_plan_id = ?").all(blockPlanId) as Omit<DraftEvent, "courseIds">[];
  const eventCourses = sqlite.prepare("SELECT course_id AS courseId FROM draft_event_courses WHERE event_id = ?");
  const events: DraftEvent[] = eventRows.map((event) => ({
    ...event,
    provisional: Boolean(event.provisional),
    courseIds: (eventCourses.all(event.id) as { courseId: string }[]).map((row) => row.courseId),
  }));
  return { plan, courses, phases, events };
}

export function publishBlockPlan(sqlite: Database.Database, request: PublicationRequest) {
  return sqlite.transaction(() => {
    const { plan, courses, phases, events } = readDraft(sqlite, request.blockPlanId);
    assertAreaEditPermission(sqlite, request.accountId, plan.areaId);
    const existing = sqlite.prepare("SELECT id FROM published_versions WHERE block_plan_id = ?").get(plan.id) as { id: string } | undefined;
    if (plan.draftUpdatedAt !== request.seenDraftUpdatedAt || (existing?.id ?? null) !== request.seenPublishedVersionId) {
      throw new Error("Die Vorschau ist nicht mehr aktuell. Laden Sie den aktuellen Entwurf erneut.");
    }
    if (!courses.length) throw new Error("Ein Blockplan benötigt mindestens einen Kurs.");
    const issues = validatePublication({ courses, phases, events });
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(" "));

    for (const course of courses) {
      const conflict = sqlite.prepare(`SELECT snapshot.code FROM published_course_snapshots snapshot
        JOIN published_versions version ON version.id = snapshot.version_id
        WHERE snapshot.source_course_id = ? AND version.block_plan_id <> ?`).get(course.id, plan.id);
      if (conflict) throw new Error(`Der Kurs ${course.code} ist bereits in einer anderen veröffentlichten Fassung sichtbar.`);
    }

    if (existing) sqlite.prepare("DELETE FROM published_versions WHERE id = ?").run(existing.id);
    const versionId = randomUUID();
    const blockPlanName = blockPlanDisplayName(plan.name, courses);
    sqlite.prepare("INSERT INTO published_versions (id, block_plan_id, published_at, block_plan_name, area_name) VALUES (?, ?, ?, ?, ?)")
      .run(versionId, plan.id, new Date().toISOString(), blockPlanName, plan.areaName);
    const snapshotIds = new Map<string, string>();
    const addSnapshot = sqlite.prepare(`INSERT INTO published_course_snapshots
      (id, version_id, source_course_id, code, program_name, program_abbreviation, study_start, study_end, semesters)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const course of courses) {
      const snapshotId = randomUUID();
      snapshotIds.set(course.id, snapshotId);
      addSnapshot.run(snapshotId, versionId, course.id, course.code, course.program, course.programAbbreviation, course.studyStart, course.studyEnd, course.semesters);
    }
    const addPhase = sqlite.prepare("INSERT INTO published_phases (id, version_id, course_snapshot_id, semester, phase_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const phase of phases) addPhase.run(randomUUID(), versionId, snapshotIds.get(phase.courseId), phase.semester, phase.type, phase.startDate, phase.endDate);
    const addEvent = sqlite.prepare("INSERT INTO published_events (id, version_id, title, description, category, start_date, end_date, provisional) SELECT ?, ?, title, description, category, start_date, end_date, provisional FROM draft_events WHERE id = ?");
    const addEventCourse = sqlite.prepare("INSERT INTO published_event_courses (event_id, course_snapshot_id) VALUES (?, ?)");
    for (const event of events) {
      const eventId = randomUUID();
      addEvent.run(eventId, versionId, event.id);
      for (const courseId of event.courseIds) addEventCourse.run(eventId, snapshotIds.get(courseId));
    }
    sqlite.prepare("UPDATE block_plans SET has_ever_been_published = 1 WHERE id = ?").run(plan.id);
    return { id: versionId, blockPlanName };
  })();
}

export function withdrawBlockPlan(sqlite: Database.Database, { blockPlanId, accountId, seenPublishedVersionId }: Omit<PublicationRequest, "seenDraftUpdatedAt">) {
  return sqlite.transaction(() => {
    const plan = sqlite.prepare("SELECT area_id AS areaId FROM block_plans WHERE id = ?").get(blockPlanId) as { areaId: string } | undefined;
    if (!plan) throw new Error("Der Blockplan wurde nicht gefunden.");
    assertAreaEditPermission(sqlite, accountId, plan.areaId);
    const version = sqlite.prepare("SELECT id FROM published_versions WHERE block_plan_id = ?").get(blockPlanId) as { id: string } | undefined;
    if (!version || version.id !== seenPublishedVersionId) throw new Error("Die angezeigte Veröffentlichung ist nicht mehr aktuell.");
    sqlite.prepare("DELETE FROM published_versions WHERE id = ?").run(version.id);
  })();
}
