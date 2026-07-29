
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { attachCourse, createBlockPlanFromCourse } from "@/lib/services/block-plan-admin";
import { createCourse } from "@/lib/services/course-admin";
import { createDraftEvent, deleteDraftEvent, updateDraftEvent } from "@/lib/services/event-admin";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

function createDatabase() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.prepare("INSERT INTO areas (id, name, normalized_name) VALUES (?, ?, ?)").run("area-01", "Technik", "technik");
  sqlite.prepare("INSERT INTO programs (id, area_id, name, abbreviation, semesters) VALUES (?, ?, ?, ?, ?)").run("prog-tif", "area-01", "Informatik", "TIF", 6);
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES ('admin', 'admin', 'admin@example.test', 0, 'NONE', 1, 'ACTIVE', ?, ?)").run(Date.now(), Date.now());
  return sqlite;
}

function insertEditor(sqlite: Database.Database, id: string, areaIds: string[]) {
  sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, role, system_admin, status, createdAt, updatedAt) VALUES (?, ?, ?, 0, 'AREA_EDITOR', 0, 'ACTIVE', ?, ?)").run(
    id, `${id}@example.test`, `${id}@example.test`, Date.now(), Date.now(),
  );
  for (const areaId of areaIds) sqlite.prepare("INSERT INTO area_assignments (user_id, area_id) VALUES (?, ?)").run(id, areaId);
}

function addCourse(sqlite: Database.Database, code: string) {
  return createCourse(sqlite, { accountId: "admin", code, programId: "prog-tif", studyStart: "2026-10-01", studyEnd: "2029-09-30" });
}

/** A block plan with two assigned courses — the usual starting point for an event that affects one or both of them. */
function createPlanWithCourses(sqlite: Database.Database) {
  const first = addCourse(sqlite, "TIF26A");
  const second = addCourse(sqlite, "TIF26B");
  const blockPlanId = createBlockPlanFromCourse(sqlite, { accountId: "admin", courseId: first });
  attachCourse(sqlite, { accountId: "admin", blockPlanId, courseId: second });
  return { blockPlanId, first, second };
}

/** A structurally valid event for one course; single fields get overridden per test. */
function validEvent(courseId: string) {
  return { title: "Prüfung Mathematik", description: "", category: "EXAM", startDate: "2027-01-12", endDate: "", provisional: false, courseIds: [courseId] };
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createDraftEvent", () => {
  it("stores the event with its affected courses and records the draft change", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first, second } = createPlanWithCourses(sqlite);

    const eventId = createDraftEvent(sqlite, {
      accountId: "admin",
      blockPlanId,
      title: "Klausur Programmieren",
      description: "Zwei Teilklausuren",
      category: "EXAM",
      startDate: "2027-01-12",
      endDate: "2027-01-13",
      provisional: true,
      courseIds: [first, second],
      now: new Date("2026-08-01T09:00:00.000Z"),
    });

    expect(sqlite.prepare("SELECT block_plan_id AS blockPlanId, title, description, category, start_date AS startDate, end_date AS endDate, provisional FROM draft_events WHERE id = ?").get(eventId)).toEqual({
      blockPlanId, title: "Klausur Programmieren", description: "Zwei Teilklausuren", category: "EXAM", startDate: "2027-01-12", endDate: "2027-01-13", provisional: 1,
    });
    expect(sqlite.prepare("SELECT course_id AS courseId FROM draft_event_courses WHERE event_id = ? ORDER BY course_id").all(eventId)).toEqual(
      [first, second].toSorted().map((courseId) => ({ courseId })),
    );
    expect(sqlite.prepare("SELECT draft_updated_at AS at, draft_updated_by_account_id AS by FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({
      at: "2026-08-01T09:00:00.000Z", by: "admin",
    });
  });

  it("trims the title, collapses its interior whitespace and keeps an empty description unset", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);

    const eventId = createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId, title: "  Abgabe   Studienarbeit ", description: "   " });

    expect(sqlite.prepare("SELECT title, description FROM draft_events WHERE id = ?").get(eventId)).toEqual({ title: "Abgabe Studienarbeit", description: null });
  });

  it("rejects an empty title and a title or description beyond its maximum length", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const event = { ...validEvent(first), accountId: "admin", blockPlanId };

    expect(() => createDraftEvent(sqlite, { ...event, title: "   " })).toThrow("Der Termintitel ist erforderlich.");
    expect(() => createDraftEvent(sqlite, { ...event, title: "x".repeat(161) })).toThrow("höchstens 160");
    expect(() => createDraftEvent(sqlite, { ...event, description: "x".repeat(2001) })).toThrow("höchstens 2000");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_events").get()).toEqual({ count: 0 });
  });

  it("stores an event without an end date as a single day", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);

    const eventId = createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId, endDate: "" });

    expect(sqlite.prepare("SELECT start_date AS startDate, end_date AS endDate FROM draft_events WHERE id = ?").get(eventId)).toEqual({ startDate: "2027-01-12", endDate: null });
  });

  it("rejects an invalid category, an invalid calendar day and an end date before the start date", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const event = { ...validEvent(first), accountId: "admin", blockPlanId };

    expect(() => createDraftEvent(sqlite, { ...event, category: "MEETING" })).toThrow("Kategorie");
    expect(() => createDraftEvent(sqlite, { ...event, startDate: "12.01.2027" })).toThrow("JJJJ-MM-TT");
    expect(() => createDraftEvent(sqlite, { ...event, startDate: "2027-02-30" })).toThrow("gültiger Kalendertag");
    expect(() => createDraftEvent(sqlite, { ...event, endDate: "2027-01-11" })).toThrow("Das Enddatum darf nicht vor dem Startdatum liegen.");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_events").get()).toEqual({ count: 0 });
  });

  it("names the field a rejected value belongs to", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const event = { ...validEvent(first), accountId: "admin", blockPlanId };

    expect(() => createDraftEvent(sqlite, { ...event, title: " " })).toThrow(expect.objectContaining({ field: "title" }));
    expect(() => createDraftEvent(sqlite, { ...event, startDate: "2027-02-30" })).toThrow(expect.objectContaining({ field: "startDate" }));
    expect(() => createDraftEvent(sqlite, { ...event, endDate: "2027-01-11" })).toThrow(expect.objectContaining({ field: "endDate" }));
    expect(() => createDraftEvent(sqlite, { ...event, courseIds: [] })).toThrow(expect.objectContaining({ field: "courseIds" }));
  });

  it("requires at least one course and accepts only courses of this block plan", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const unassigned = addCourse(sqlite, "TIF26C");
    const event = { ...validEvent(first), accountId: "admin", blockPlanId };

    expect(() => createDraftEvent(sqlite, { ...event, courseIds: [] })).toThrow("mindestens einen Kurs");
    expect(() => createDraftEvent(sqlite, { ...event, courseIds: [first, unassigned] })).toThrow("gehört nicht zu diesem Blockplan");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_events").get()).toEqual({ count: 0 });
  });

  it("keeps a repeatedly given course exactly once in the scope of the event", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);

    const eventId = createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId, courseIds: [first, first] });

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_event_courses WHERE event_id = ?").get(eventId)).toEqual({ count: 1 });
  });

  it("rejects an unknown block plan and an account without permission for its area", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    insertEditor(sqlite, "editor", []);

    expect(() => createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId: "unknown" })).toThrow("Blockplan wurde nicht gefunden");
    expect(() => createDraftEvent(sqlite, { ...validEvent(first), accountId: "editor", blockPlanId })).toThrow("nicht zur Bearbeitung dieses Bereichs");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_events").get()).toEqual({ count: 0 });
  });

  it("answers an account without permission before it says anything about the courses", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const foreign = addCourse(sqlite, "TIF26C");
    insertEditor(sqlite, "editor", []);

    // Both field errors would tell an account that may not edit here which courses this block plan carries.
    expect(() => createDraftEvent(sqlite, { ...validEvent(first), accountId: "editor", blockPlanId, courseIds: [] })).toThrow("nicht zur Bearbeitung dieses Bereichs");
    expect(() => createDraftEvent(sqlite, { ...validEvent(first), accountId: "editor", blockPlanId, courseIds: [foreign] })).toThrow("nicht zur Bearbeitung dieses Bereichs");
  });
});

describe("updateDraftEvent", () => {
  it("replaces all details including the affected courses and records the draft change", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first, second } = createPlanWithCourses(sqlite);
    const eventId = createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId, provisional: true });

    updateDraftEvent(sqlite, {
      accountId: "admin",
      eventId,
      title: "Präsentation Projektarbeit",
      description: "Im Hörsaal",
      category: "PRESENTATION",
      startDate: "2027-06-01",
      endDate: "2027-06-02",
      provisional: false,
      courseIds: [second],
      now: new Date("2026-09-09T07:00:00.000Z"),
    });

    expect(sqlite.prepare("SELECT title, description, category, start_date AS startDate, end_date AS endDate, provisional FROM draft_events WHERE id = ?").get(eventId)).toEqual({
      title: "Präsentation Projektarbeit", description: "Im Hörsaal", category: "PRESENTATION", startDate: "2027-06-01", endDate: "2027-06-02", provisional: 0,
    });
    expect(sqlite.prepare("SELECT course_id AS courseId FROM draft_event_courses WHERE event_id = ?").all(eventId)).toEqual([{ courseId: second }]);
    expect(sqlite.prepare("SELECT draft_updated_at AS at FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({ at: "2026-09-09T07:00:00.000Z" });
  });

  it("keeps the stored event unchanged when the new details violate a structural rule", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const eventId = createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId });
    const foreign = addCourse(sqlite, "TIF26C");

    expect(() => updateDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", eventId, title: "  " })).toThrow("erforderlich");
    expect(() => updateDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", eventId, courseIds: [foreign] })).toThrow("gehört nicht zu diesem Blockplan");
    expect(sqlite.prepare("SELECT title FROM draft_events WHERE id = ?").get(eventId)).toEqual({ title: "Prüfung Mathematik" });
    expect(sqlite.prepare("SELECT course_id AS courseId FROM draft_event_courses WHERE event_id = ?").all(eventId)).toEqual([{ courseId: first }]);
  });

  it("rejects an unknown event and an account without permission for its area", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const eventId = createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId });
    insertEditor(sqlite, "editor", []);

    expect(() => updateDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", eventId: "unknown" })).toThrow("Termin wurde nicht gefunden");
    expect(() => updateDraftEvent(sqlite, { ...validEvent(first), accountId: "editor", eventId })).toThrow("nicht zur Bearbeitung dieses Bereichs");
  });

});

describe("deleteDraftEvent", () => {
  it("removes the event with its course assignments and records the draft change", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first, second } = createPlanWithCourses(sqlite);
    const eventId = createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId, courseIds: [first, second] });

    deleteDraftEvent(sqlite, { accountId: "admin", eventId, now: new Date("2026-10-10T11:00:00.000Z") });

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_events").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_event_courses").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT draft_updated_at AS at FROM block_plans WHERE id = ?").get(blockPlanId)).toEqual({ at: "2026-10-10T11:00:00.000Z" });
  });

  it("rejects an unknown event and an account without permission for its area", () => {
    const sqlite = createDatabase();
    const { blockPlanId, first } = createPlanWithCourses(sqlite);
    const eventId = createDraftEvent(sqlite, { ...validEvent(first), accountId: "admin", blockPlanId });
    insertEditor(sqlite, "editor", []);

    expect(() => deleteDraftEvent(sqlite, { accountId: "admin", eventId: "unknown" })).toThrow("Termin wurde nicht gefunden");
    expect(() => deleteDraftEvent(sqlite, { accountId: "editor", eventId })).toThrow("nicht zur Bearbeitung dieses Bereichs");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM draft_events").get()).toEqual({ count: 1 });
  });
});
