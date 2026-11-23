import Database from "better-sqlite3";
import { afterEach, expect, it, vi } from "vitest";

import { errorMessage } from "@/app/intern/action-helpers";

vi.mock("@/lib/internal-auth", () => ({ getActiveAccount: async () => null }));

const logged = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => logged.mockClear());

it("passes the services' own refusals through as they are, without logging them", () => {
  expect(errorMessage(new Error("Der Kurs wurde nicht gefunden."))).toBe("Der Kurs wurde nicht gefunden.");
  expect(errorMessage("kein Fehlerobjekt")).toBe("Die Aktion konnte nicht ausgeführt werden.");
  expect(logged).not.toHaveBeenCalled();
});

it("asks to try again when the database is busy, instead of showing SQLite's wording, and logs the error", () => {
  for (const code of ["SQLITE_BUSY", "SQLITE_BUSY_SNAPSHOT"]) {
    const error = new Database.SqliteError("database is locked", code);
    expect(errorMessage(error)).toBe("Die Daten werden gerade an anderer Stelle geändert. Bitte versuchen Sie es in einem Moment erneut.");
    expect(logged).toHaveBeenLastCalledWith(error);
  }
});

it("keeps every other database failure generic", () => {
  expect(errorMessage(new Database.SqliteError("UNIQUE constraint failed: courses.normalized_code", "SQLITE_CONSTRAINT_UNIQUE")))
    .toBe("Die Aktion konnte nicht ausgeführt werden.");
});
