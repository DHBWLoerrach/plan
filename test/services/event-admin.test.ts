import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { FieldError } from "@/lib/domain/field-error";
import { createDraftEvent, deleteDraftEvent, updateDraftEvent } from "@/lib/services/event-admin";
import { applySchema } from "@/test/schema";

const databases: Database.Database[] = [];

function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  applySchema(sqlite);
  sqlite.exec(`
    INSERT INTO areas VALUES ('area', 'Technik', 'technik');
    INSERT INTO programs VALUES ('program', 'area', 'Informatik', 'TIF', 6);
    INSERT INTO user VALUES ('editor', 'Editor', 'editor@test', 0, NULL, 'AREA_EDITOR', 0, 'ACTIVE', 0, 0);
    INSERT INTO area_assignments VALUES ('editor', 'area');
    INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, has_ever_been_published, draft_updated_at, draft_updated_by_account_id) VALUES
      ('course', 'program', 'TIF26A', 'tif26a', '2026-10-01', '2029-09-30', 0, '2026-01-01T00:00:00.000Z', 'editor');`);
  return sqlite;
}

const valid = { title: "Prüfung", description: "", category: "EXAM", startDate: "2026-12-01", endDate: "", provisional: false };

function create(sqlite: Database.Database, details: Partial<typeof valid> = {}, courseIds = ["course"]) {
  return createDraftEvent(sqlite, { accountId: "editor", courseIds, ...valid, ...details });
}

function rejectedField(save: () => unknown) {
  try {
    save();
  } catch (error) {
    return error instanceof FieldError ? error.field : `${error}`;
  }
  return "accepted";
}

function storedEvent(sqlite: Database.Database) {
  return sqlite.prepare(`SELECT title, description, category, start_date AS startDate, end_date AS endDate, provisional
    FROM course_events`).get();
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe("createDraftEvent", () => {
  it("stores the event on the course, with no end date meaning the start day alone", () => {
    const sqlite = database();

    create(sqlite);

    expect(storedEvent(sqlite)).toEqual({ title: "Prüfung", description: null, category: "EXAM", startDate: "2026-12-01", endDate: null, provisional: 0 });
  });

  it("keeps a provisional date marked as provisional", () => {
    const sqlite = database();

    create(sqlite, { provisional: true, endDate: "2026-12-05" });

    expect(storedEvent(sqlite)).toMatchObject({ endDate: "2026-12-05", provisional: 1 });
  });

  it("collapses the white space a pasted title carries", () => {
    const sqlite = database();

    create(sqlite, { title: "  Mündliche   Prüfung\n Teil 2 ", description: "  " });

    expect(storedEvent(sqlite)).toMatchObject({ title: "Mündliche Prüfung Teil 2", description: null });
  });

  it("refuses a title that is empty or only white space", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, { title: "" }))).toBe("title");
    expect(rejectedField(() => create(sqlite, { title: "   " }))).toBe("title");
  });

  it("measures the length limits in characters, not in code units", () => {
    const sqlite = database();

    // An emoji outside the basic plane occupies two UTF-16 units but is one character to whoever types the title.
    expect(() => create(sqlite, { title: "🎓".repeat(160) })).not.toThrow();
    expect(rejectedField(() => create(sqlite, { title: "P".repeat(161) }))).toBe("title");
    expect(rejectedField(() => create(sqlite, { description: "B".repeat(2001) }))).toBe("description");
  });

  it("refuses a category outside the five the domain knows", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, { category: "URLAUB" }))).toBe("category");
    expect(rejectedField(() => create(sqlite, { category: "" }))).toBe("category");
  });

  it("refuses an end date before the start date and a day that is no calendar day", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, { startDate: "2026-12-01", endDate: "2026-11-30" }))).toBe("endDate");
    expect(rejectedField(() => create(sqlite, { startDate: "" }))).toBe("startDate");
    expect(rejectedField(() => create(sqlite, { endDate: "2026-02-30" }))).toBe("endDate");
    // The same day at both ends is the inclusive period of one day.
    expect(() => create(sqlite, { endDate: "2026-12-01" })).not.toThrow();
  });

  it("refuses a selection that is empty or names a course that does not exist", () => {
    const sqlite = database();

    expect(rejectedField(() => create(sqlite, {}, []))).toBe("courseIds");
    expect(rejectedField(() => create(sqlite, {}, ["kurs-unbekannt"]))).toBe("courseIds");
    expect(sqlite.prepare("SELECT count(*) AS count FROM course_events").get()).toEqual({ count: 0 });
  });

  it("records the moment of the change on the course", () => {
    const sqlite = database();

    createDraftEvent(sqlite, { accountId: "editor", courseIds: ["course"], ...valid, now: new Date("2026-07-30T09:00:00.000Z") });

    expect(sqlite.prepare("SELECT draft_updated_at AS at, draft_updated_by_account_id AS by FROM courses").get())
      .toEqual({ at: "2026-07-30T09:00:00.000Z", by: "editor" });
  });
});

describe("updateDraftEvent", () => {
  it("checks the changed values the same way the creation does", () => {
    const sqlite = database();
    const [eventId] = create(sqlite);

    expect(rejectedField(() => updateDraftEvent(sqlite, { accountId: "editor", eventId, ...valid, category: "URLAUB" }))).toBe("category");
    expect(rejectedField(() => updateDraftEvent(sqlite, { accountId: "editor", eventId, ...valid, title: "" }))).toBe("title");
    expect(storedEvent(sqlite)).toMatchObject({ title: "Prüfung", category: "EXAM" });
  });

  it("clears an end date the change no longer names", () => {
    const sqlite = database();
    const [eventId] = create(sqlite, { endDate: "2026-12-05" });

    updateDraftEvent(sqlite, { accountId: "editor", eventId, ...valid, endDate: "" });

    expect(storedEvent(sqlite)).toMatchObject({ endDate: null });
  });

  it("reports an event it cannot find", () => {
    const sqlite = database();

    expect(() => updateDraftEvent(sqlite, { accountId: "editor", eventId: "termin-unbekannt", ...valid })).toThrow("nicht gefunden");
  });
});

describe("deleteDraftEvent", () => {
  it("removes the event and stamps the course", () => {
    const sqlite = database();
    const [eventId] = create(sqlite);

    deleteDraftEvent(sqlite, { accountId: "editor", eventId, now: new Date("2026-07-30T10:00:00.000Z") });

    expect(sqlite.prepare("SELECT count(*) AS count FROM course_events").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT draft_updated_at AS at FROM courses").get()).toEqual({ at: "2026-07-30T10:00:00.000Z" });
  });

  it("reports an event it cannot find", () => {
    const sqlite = database();

    expect(() => deleteDraftEvent(sqlite, { accountId: "editor", eventId: "termin-unbekannt" })).toThrow("nicht gefunden");
  });
});
