import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { normalizeCodePrefix } from "@/lib/domain/course-code";
import { type DraftCourse, type DraftEvent, type DraftPhase, type PublicationIssue, validatePublication } from "@/lib/domain/publication";
import { assertAreaEditPermission } from "@/lib/services/authorization";

type PublicationRequest = {
  blockPlanId: string;
  accountId: string;
  seenDraftUpdatedAt: string;
  seenPublishedVersionId: string | null;
};

type PlanRow = {
  id: string;
  areaId: string;
  name: string | null;
  draftUpdatedAt: string;
  areaName: string;
  hasEverBeenPublished: number;
  publishedVersionId: string | null;
};
type CourseRow = DraftCourse & { program: string; programAbbreviation: string };
type PublishedCourseCodeRow = { code: string };

/**
 * The refusal to act on a state that changed since it was shown — a draft edited after its preview was rendered, or
 * a published version replaced since it was displayed. The editor tells this apart from every other refusal, because
 * only here it leaves everything unchanged, reloads the current state and asks for a fresh decision
 * (MVP-SPEZIFIKATION.md).
 */
export class StaleStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleStateError";
  }
}

function readDraft(sqlite: Database.Database, blockPlanId: string) {
  const plan = sqlite.prepare(`SELECT plan.id, plan.area_id AS areaId, plan.name, plan.draft_updated_at AS draftUpdatedAt,
      area.name AS areaName, plan.has_ever_been_published AS hasEverBeenPublished, version.id AS publishedVersionId
    FROM block_plans plan JOIN areas area ON area.id = plan.area_id
    LEFT JOIN published_versions version ON version.block_plan_id = plan.id WHERE plan.id = ?`).get(blockPlanId) as PlanRow | undefined;
  if (!plan) return null;
  const courses = sqlite.prepare(`SELECT course.id, course.code, course.study_start AS studyStart, course.study_end AS studyEnd,
      program.semesters, program.name AS program, program.abbreviation AS programAbbreviation
    FROM courses course JOIN programs program ON program.id = course.program_id WHERE course.block_plan_id = ?`).all(blockPlanId) as CourseRow[];
  const phases = sqlite.prepare("SELECT course_id AS courseId, semester, phase_type AS type, start_date AS startDate, end_date AS endDate FROM draft_phases WHERE block_plan_id = ?").all(blockPlanId) as DraftPhase[];
  const eventRows = sqlite.prepare("SELECT id, title, description, category, start_date AS startDate, end_date AS endDate, provisional FROM draft_events WHERE block_plan_id = ?").all(blockPlanId) as Omit<DraftEvent, "courseIds">[];
  const eventCourses = sqlite.prepare("SELECT course_id AS courseId FROM draft_event_courses WHERE event_id = ?");
  const events: DraftEvent[] = eventRows.map((event) => ({
    ...event,
    provisional: Boolean(event.provisional),
    courseIds: (eventCourses.all(event.id) as { courseId: string }[]).map((row) => row.courseId),
  }));
  return { plan, courses, phases, events };
}

/**
 * Everything a draft needs to be checked before its release: the saved draft and every structural and publication
 * rule it still violates. Preview and publication read it from the same place, so what the preview shows is exactly
 * what the release checks again (MVP-SPEZIFIKATION.md). Returns `null` for an unknown block plan.
 */
export function readPublicationPreview(sqlite: Database.Database, blockPlanId: string) {
  const draft = readDraft(sqlite, blockPlanId);
  if (!draft) return null;
  const { plan, courses, phases, events } = draft;
  const issues = publicationIssuesForDraft(sqlite, plan.id, { courses, phases, events });
  return { plan, courses, phases, events, issues };
}

/**
 * Checks draft data that a caller already loaded. Database access remains necessary only for the cross-plan rule
 * about courses that are part of another published version.
 */
export function publicationIssuesForDraft(
  sqlite: Database.Database,
  blockPlanId: string,
  { courses, phases, events }: { courses: DraftCourse[]; phases: DraftPhase[]; events: DraftEvent[] },
): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  if (!courses.length) {
    issues.push({
      code: "block-plan-without-course",
      semester: null,
      field: null,
      message: "Der Blockplan benötigt mindestens einen zugeordneten Kurs.",
    });
  }
  const publishedElsewhere = sqlite.prepare(`SELECT snapshot.id FROM published_course_snapshots snapshot
    JOIN published_versions version ON version.id = snapshot.version_id
    WHERE snapshot.source_course_id = ? AND version.block_plan_id <> ?`);
  // Public snapshots preserve the code that was visible at publication time, while the current course code may later
  // change. Compare those snapshots in JavaScript because SQLite's NOCASE collation does not cover the application's
  // German Unicode normalisation strategy.
  const publishedCodesElsewhere = new Set(
    (sqlite.prepare(`SELECT snapshot.code FROM published_course_snapshots snapshot
      JOIN published_versions version ON version.id = snapshot.version_id
      WHERE version.block_plan_id <> ?`).all(blockPlanId) as PublishedCourseCodeRow[])
      .map((snapshot) => normalizeCodePrefix(snapshot.code))
      .filter((code): code is string => code !== null),
  );
  for (const course of courses) {
    const isPublishedElsewhere = Boolean(publishedElsewhere.get(course.id, blockPlanId));
    if (isPublishedElsewhere) {
      issues.push({
        code: "course-published-elsewhere",
        courseId: course.id,
        semester: null,
        field: null,
        message: `Der Kurs ${course.code} ist bereits in einer anderen veröffentlichten Fassung sichtbar. Diese muss zuerst ohne den Kurs neu veröffentlicht oder zurückgenommen werden.`,
      });
    }
    const normalizedCode = normalizeCodePrefix(course.code);
    if (!isPublishedElsewhere && normalizedCode && publishedCodesElsewhere.has(normalizedCode)) {
      issues.push({
        code: "course-code-published-elsewhere",
        courseId: course.id,
        semester: null,
        field: null,
        message: `Die Kurskennung ${course.code} ist bereits in einer anderen veröffentlichten Fassung sichtbar. Diese muss zuerst ohne die Kurskennung neu veröffentlicht oder zurückgenommen werden.`,
      });
    }
  }
  issues.push(...validatePublication({ courses, phases, events }));
  return issues;
}

export function publishBlockPlan(sqlite: Database.Database, request: PublicationRequest) {
  return sqlite.transaction(() => {
    const preview = readPublicationPreview(sqlite, request.blockPlanId);
    if (!preview) throw new Error("Der Blockplan wurde nicht gefunden.");
    const { plan, courses, phases, events, issues } = preview;
    assertAreaEditPermission(sqlite, request.accountId, plan.areaId);
    if (plan.draftUpdatedAt !== request.seenDraftUpdatedAt || plan.publishedVersionId !== request.seenPublishedVersionId) {
      throw new StaleStateError("Die Vorschau ist nicht mehr aktuell. Laden Sie den aktuellen Entwurf erneut.");
    }
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(" "));

    if (plan.publishedVersionId) sqlite.prepare("DELETE FROM published_versions WHERE id = ?").run(plan.publishedVersionId);
    const versionId = randomUUID();
    const blockPlanName = blockPlanDisplayName(plan.name, courses);
    sqlite.prepare("INSERT INTO published_versions (id, block_plan_id, published_at, block_plan_name, area_name) VALUES (?, ?, ?, ?, ?)")
      .run(versionId, plan.id, new Date().toISOString(), blockPlanName, plan.areaName);
    const snapshotIds = new Map<string, string>();
    const addSnapshot = sqlite.prepare(`INSERT INTO published_course_snapshots
      (id, version_id, source_course_id, code, program_name, program_abbreviation, study_start, study_end, semesters)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const addSearchKey = sqlite.prepare(`INSERT INTO published_course_search_keys (course_snapshot_id, normalized_code)
      VALUES (?, ?)`);
    for (const course of courses) {
      const snapshotId = randomUUID();
      snapshotIds.set(course.id, snapshotId);
      addSnapshot.run(snapshotId, versionId, course.id, course.code, course.program, course.programAbbreviation, course.studyStart, course.studyEnd, course.semesters);
      addSearchKey.run(snapshotId, normalizeCodePrefix(course.code));
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
    // Addressing the displayed version — not merely "the" version of the plan — is what makes a double click and a
    // meanwhile replaced version harmless (ARCHITEKTUR_UND_BETRIEB.md).
    const version = sqlite.prepare("SELECT id FROM published_versions WHERE block_plan_id = ?").get(blockPlanId) as { id: string } | undefined;
    if (!version || version.id !== seenPublishedVersionId) {
      throw new StaleStateError("Die angezeigte Veröffentlichung ist nicht mehr aktuell.");
    }
    // The draft, its course phases and its events hang off the block plan, not off the version: deleting the version
    // takes exactly the public copy with it (ADR 0009).
    sqlite.prepare("DELETE FROM published_versions WHERE id = ?").run(version.id);
  })();
}
