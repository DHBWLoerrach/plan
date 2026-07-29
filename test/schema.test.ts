import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { applySchema, applySchemaThrough } from "@/test/schema";

/** Whether the database carries a schema object of that kind under that name. */
function hasSchemaObject(sqlite: Database.Database, kind: "table" | "index", name: string) {
  return sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?").pluck().get(kind, name) === 1;
}

describe("applySchemaThrough", () => {
  it("stops at the named migration while the full build goes on past it", () => {
    // The table `published_course_search_keys` arrives with `0002_`, so it separates the two builds;
    // the index of `0001_` shows that the named migration is applied rather than stopped before.
    const limited = new Database(":memory:");
    applySchemaThrough(limited, "0001_foreign_key_indexes");
    const complete = new Database(":memory:");
    applySchema(complete);

    expect(hasSchemaObject(limited, "index", "courses_by_block_plan")).toBe(true);
    expect(hasSchemaObject(limited, "table", "published_course_search_keys")).toBe(false);
    expect(hasSchemaObject(complete, "table", "published_course_search_keys")).toBe(true);
  });

  it("refuses a migration it does not know instead of applying all of them", () => {
    const sqlite = new Database(":memory:");

    // A name no migration on disk resembles: the message lists the known ones, so a name close to a
    // real one would match that list and the assertion would no longer show what was rejected.
    expect(() => applySchemaThrough(sqlite, "9999_erfunden")).toThrow(/9999_erfunden/u);
    // A build that silently fell back to everything would leave a usable schema behind, and the test
    // that meant to observe the old state would pass against the new one.
    expect(hasSchemaObject(sqlite, "table", "courses")).toBe(false);
  });
});

describe("course planning schema", () => {
  it("has only course-owned planning and publication tables with foreign-key indexes", () => {
    const sqlite = new Database(":memory:");
    applySchema(sqlite);

    for (const table of ["course_phases", "course_events", "published_courses", "published_phases", "published_events"]) {
      expect(hasSchemaObject(sqlite, "table", table)).toBe(true);
    }
    for (const table of ["block_plans", "draft_phases", "draft_events", "draft_event_courses", "published_versions", "published_course_snapshots", "published_event_courses"]) {
      expect(hasSchemaObject(sqlite, "table", table)).toBe(false);
    }
    for (const index of ["course_phases_by_course", "course_events_by_course", "published_phases_by_course", "published_events_by_course"]) {
      expect(hasSchemaObject(sqlite, "index", index)).toBe(true);
    }
  });
});
