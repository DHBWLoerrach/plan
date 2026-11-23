import Database from "better-sqlite3";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FieldError } from "@/lib/domain/field-error";

const mocks = vi.hoisted(() => ({
  redeemPasswordLink: vi.fn(),
  changeAccountPassword: vi.fn(),
  getActiveAccount: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/db", () => ({ sqlite: {} }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, signOut: vi.fn() } } }));
vi.mock("@/lib/internal-auth", () => ({ getActiveAccount: mocks.getActiveAccount }));
vi.mock("@/lib/services/password-link", () => ({
  redeemPasswordLink: mocks.redeemPasswordLink,
  changeAccountPassword: mocks.changeAccountPassword,
}));

import { changePasswordAction, setPasswordWithLinkAction } from "@/app/intern/actions";

const busy = () => new Database.SqliteError("database is locked", "SQLITE_BUSY");
const retry = "Die Daten werden gerade an anderer Stelle geändert. Bitte versuchen Sie es in einem Moment erneut.";
const logged = vi.spyOn(console, "error").mockImplementation(() => {});

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

beforeEach(() => {
  mocks.getActiveAccount.mockResolvedValue({ id: "user" });
  mocks.getSession.mockResolvedValue({ user: { id: "user" }, session: { id: "session" } });
});

afterEach(() => {
  vi.clearAllMocks();
});

it("asks to try a still valid password link again when the database is busy, and logs it", async () => {
  const error = busy();
  mocks.redeemPasswordLink.mockRejectedValue(error);

  expect(await setPasswordWithLinkAction({}, form({ token: "token", password: "x" }))).toEqual({ error: retry });
  expect(logged).toHaveBeenCalledWith(error);
});

it("keeps calling a refused link invalid or expired, and a refused password by its rule", async () => {
  mocks.redeemPasswordLink.mockRejectedValueOnce(new Error("Der Passwortlink ist abgelaufen."));
  expect(await setPasswordWithLinkAction({}, form({ token: "token", password: "x" }))).toEqual({ error: "Der Passwortlink ist ungültig oder abgelaufen." });

  mocks.redeemPasswordLink.mockRejectedValueOnce(new FieldError("password", "Das Passwort ist zu kurz."));
  expect(await setPasswordWithLinkAction({}, form({ token: "token", password: "x" }))).toEqual({ error: "Das Passwort ist zu kurz." });
  expect(logged).not.toHaveBeenCalled();
});

it("asks to try a password change again when the database is busy, and logs it", async () => {
  const error = busy();
  mocks.changeAccountPassword.mockRejectedValue(error);

  expect(await changePasswordAction({}, form({ currentPassword: "a", newPassword: "b" }))).toEqual({ formError: retry });
  expect(logged).toHaveBeenCalledWith(error);
});

it("keeps the general refusal of a password change for every other failure", async () => {
  mocks.changeAccountPassword.mockRejectedValue(new Error("Das Konto ist gesperrt."));

  expect(await changePasswordAction({}, form({ currentPassword: "a", newPassword: "b" }))).toEqual({ formError: "Das Passwort konnte nicht geändert werden." });
  expect(logged).not.toHaveBeenCalled();
});
