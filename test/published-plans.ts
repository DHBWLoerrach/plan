import Database from "better-sqlite3";

import type { EventCategory } from "@/lib/domain/event-category";
import type { PhaseType } from "@/lib/domain/phase-type";
import { applySchema } from "@/test/schema";

/** A database holding the master data the public views never read, so that a test can tell the two apart. */
export function databaseWithMasterData() {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area-1', 'Technik', 'technik');
    INSERT INTO areas VALUES ('area-2', 'Wirtschaft', 'wirtschaft');
    INSERT INTO programs VALUES ('program-1', 'area-1', 'Informatik', 'TIF', 6);
    INSERT INTO programs VALUES ('program-2', 'area-2', 'BWL', 'WWI', 6);
  `);
  return sqlite;
}

type PhaseInput = { semester: number; type?: PhaseType; startDate: string; endDate: string };

export type PublishedCourseInput = {
  code: string;
  program?: string;
  studyStart: string;
  studyEnd?: string;
  semesters?: number;
  phases?: PhaseInput[];
};

type EventInput = {
  title: string;
  description?: string | null;
  category?: EventCategory;
  startDate: string;
  endDate?: string | null;
  provisional?: boolean;
  /** The course codes of this version the event affects; all of them when left out. */
  courses?: string[];
};

type PublicationInput = {
  /** The published version the courses share. Publication is one act per course, so it defaults to one per course. */
  id?: string;
  area?: string;
  areaId?: string;
  courses: PublishedCourseInput[];
  events?: EventInput[];
};

/**
 * Publishes courses straight into the snapshot tables — the only data the public views may read. The block plan name
 * is written as a value no assertion expects, because the public views name a cut from its snapshots.
 */
export function publish(sqlite: Database.Database, publication: PublicationInput) {
  const versionId = publication.id ?? `version-${publication.courses[0].code}`;
  const planId = `plan-${versionId}`;
  sqlite.prepare("INSERT INTO block_plans VALUES (?, ?, NULL, NULL, 1, '2026-01-01T00:00:00.000Z', NULL)")
    .run(planId, publication.areaId ?? "area-1");
  sqlite.prepare("INSERT INTO published_versions VALUES (?, ?, '2026-01-01T00:00:00.000Z', ?, ?)")
    .run(versionId, planId, `Interner Name von ${versionId}`, publication.area ?? "Technik");

  for (const course of publication.courses) {
    const studyStartYear = Number(course.studyStart.slice(0, 4));
    sqlite.prepare("INSERT INTO published_course_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      snapshotId(course.code),
      versionId,
      `course-${course.code}`,
      course.code,
      course.program ?? "Informatik",
      "TIF",
      course.studyStart,
      course.studyEnd ?? `${studyStartYear + 3}-09-30`,
      course.semesters ?? 6,
    );
    sqlite.prepare("INSERT INTO published_course_search_keys VALUES (?, ?)")
      .run(snapshotId(course.code), course.code.toLocaleLowerCase("de-DE"));
    for (const [index, phase] of (course.phases ?? []).entries()) {
      sqlite.prepare("INSERT INTO published_phases VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        `phase-${course.code}-${index}`,
        versionId,
        snapshotId(course.code),
        phase.semester,
        phase.type ?? "THEORY",
        phase.startDate,
        phase.endDate,
      );
    }
  }

  for (const [index, event] of (publication.events ?? []).entries()) {
    const eventId = `event-${versionId}-${index}`;
    sqlite.prepare("INSERT INTO published_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      eventId,
      versionId,
      event.title,
      event.description ?? null,
      event.category ?? "EXAM",
      event.startDate,
      event.endDate ?? null,
      event.provisional ? 1 : 0,
    );
    for (const code of event.courses ?? publication.courses.map((course) => course.code)) {
      sqlite.prepare("INSERT INTO published_event_courses VALUES (?, ?)").run(eventId, snapshotId(code));
    }
  }
}

/** The snapshot id of a published course, derived from its code so that a test can name it. */
export function snapshotId(code: string) {
  return `snapshot-${code}`;
}

/** A course that exists internally but has never been published. */
export function draftOnlyCourse(sqlite: Database.Database, code: string) {
  sqlite.prepare("INSERT INTO block_plans VALUES (?, 'area-2', NULL, NULL, 0, '2026-01-01T00:00:00.000Z', NULL)")
    .run(`plan-draft-${code}`);
  sqlite.prepare("INSERT INTO courses VALUES (?, 'program-2', ?, ?, ?, '2099-10-01', '2102-09-30')")
    .run(`course-draft-${code}`, `plan-draft-${code}`, code, code.toLocaleLowerCase("de-DE"));
}

/** Withdraws a publication: its version and everything hanging off it disappear (ADR 0008). */
export function withdraw(sqlite: Database.Database, versionId: string) {
  sqlite.prepare("DELETE FROM published_versions WHERE id = ?").run(versionId);
}
