import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveAccount: vi.fn(),
  createInternalAccount: vi.fn(),
  updateAccountEmail: vi.fn(),
  updateAccountPermissions: vi.fn(),
  issuePasswordLink: vi.fn(),
  lockInternalAccount: vi.fn(),
  unlockInternalAccount: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/db", () => ({ sqlite: {} }));
vi.mock("@/lib/domain/account-email.mjs", () => ({ normalizeEmail: vi.fn() }));
vi.mock("@/lib/internal-auth", () => ({ getActiveAccount: mocks.getActiveAccount }));
vi.mock("@/lib/services/account-admin", () => ({
  createInternalAccount: mocks.createInternalAccount,
  updateAccountEmail: mocks.updateAccountEmail,
  updateAccountPermissions: mocks.updateAccountPermissions,
  issuePasswordLink: mocks.issuePasswordLink,
  lockInternalAccount: mocks.lockInternalAccount,
  unlockInternalAccount: mocks.unlockInternalAccount,
}));
vi.mock("@/lib/services/password-link-token.mjs", () => ({ passwordLinkUrl: vi.fn() }));

import {
  createAccountAction,
  issueLinkAction,
  lockAction,
  unlockAction,
  updateEmailAction,
  updatePermissionsAction,
} from "@/app/intern/konten/actions";

const forbidden = { error: "Sie sind nicht zur Kontoverwaltung berechtigt." };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveAccount.mockResolvedValue({ id: "editor", systemAdmin: false });
});

describe("account administration actions", () => {
  it.each([
    ["creates no account", createAccountAction, mocks.createInternalAccount],
    ["changes no email", updateEmailAction, mocks.updateAccountEmail],
    ["changes no permissions", updatePermissionsAction, mocks.updateAccountPermissions],
    ["issues no password link", issueLinkAction, mocks.issuePasswordLink],
    ["locks no account", lockAction, mocks.lockInternalAccount],
    ["unlocks no account", unlockAction, mocks.unlockInternalAccount],
  ])("refuses a signed-in non-admin and %s", async (_, action, service) => {
    const result = await action({}, new FormData());

    expect(result).toMatchObject(forbidden);
    expect(service).not.toHaveBeenCalled();
  });
});
