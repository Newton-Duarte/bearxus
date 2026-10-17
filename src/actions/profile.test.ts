import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  compare: vi.fn(),
  deleteUser: vi.fn(),
  deleteWhere: vi.fn(),
  findFirst: vi.fn(),
  hash: vi.fn(),
  set: vi.fn(),
  signOut: vi.fn(),
  update: vi.fn(),
  updateReturning: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ compare: mocks.compare, hash: mocks.hash }));
vi.mock("@/auth", () => ({ auth: mocks.auth, signOut: mocks.signOut }));
vi.mock("@/db", () => ({
  db: {
    delete: mocks.deleteUser,
    query: { users: { findFirst: mocks.findFirst } },
    update: mocks.update,
  },
}));
vi.mock("@/db/schema", () => ({ users: { id: "id", passwordHash: "passwordHash" } }));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNotNull: vi.fn(),
}));

import { changePassword, deleteAccount } from "@/actions/profile";
import type { ChangePasswordState } from "@/types/profile";

const previousState: ChangePasswordState = { success: false, error: null };

function formData(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

const validForm = {
  currentPassword: "old-password",
  password: "new-password",
  confirmPassword: "new-password",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  mocks.compare.mockResolvedValue(false);
  mocks.findFirst.mockResolvedValue({ passwordHash: "old-hash" });
  mocks.hash.mockResolvedValue("new-hash");
  mocks.updateReturning.mockResolvedValue([{ id: "user-1" }]);
  mocks.updateWhere.mockReturnValue({ returning: mocks.updateReturning });
  mocks.set.mockReturnValue({ where: mocks.updateWhere });
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.deleteWhere.mockResolvedValue(undefined);
  mocks.deleteUser.mockReturnValue({ where: mocks.deleteWhere });
  mocks.signOut.mockResolvedValue(undefined);
});

describe("changePassword", () => {
  it("rejects an expired session before reading form data", async () => {
    mocks.auth.mockResolvedValue(null);

    const result = await changePassword(previousState, formData(validForm));

    expect(result).toEqual({ success: false, error: "Your session has expired. Sign in again." });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns validation errors without querying the database", async () => {
    const result = await changePassword(previousState, formData({
      currentPassword: "",
      password: "short",
      confirmPassword: "short",
    }));

    expect(result).toEqual({
      success: false,
      error: "Check the highlighted fields and try again.",
      fieldErrors: {
        currentPassword: "Enter your current password.",
        password: "Password must contain at least 8 characters.",
        confirmPassword: "Password must contain at least 8 characters.",
      },
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password", async () => {
    const result = await changePassword(previousState, formData(validForm));

    expect(result).toEqual({ success: false, error: "Your current password is incorrect." });
    expect(mocks.hash).not.toHaveBeenCalled();
  });

  it("hashes and stores a new password after verification", async () => {
    mocks.compare.mockResolvedValue(true);

    const result = await changePassword(previousState, formData(validForm));

    expect(result).toEqual({ success: true, error: null });
    expect(mocks.compare).toHaveBeenCalledWith("old-password", "old-hash");
    expect(mocks.hash).toHaveBeenCalledWith("new-password", 12);
    expect(mocks.set).toHaveBeenCalledWith({ passwordHash: "new-hash", updatedAt: expect.any(Date) });
  });

  it("returns a controlled error when the update no longer finds the user", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.updateReturning.mockResolvedValue([]);

    const result = await changePassword(previousState, formData(validForm));

    expect(result).toEqual({ success: false, error: "Unable to change your password right now." });
  });

  it("converts database failures to a controlled error", async () => {
    mocks.findFirst.mockRejectedValue(new Error("database unavailable"));

    const result = await changePassword(previousState, formData(validForm));

    expect(result).toEqual({ success: false, error: "Unable to change your password right now." });
  });
});

describe("deleteAccount", () => {
  it("redirects an unauthenticated deletion request back to sign-in", async () => {
    mocks.auth.mockResolvedValue(null);

    await deleteAccount();

    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in?callbackUrl=%2Fprofile" });
  });

  it("deletes the authenticated user before signing out with confirmation", async () => {
    await deleteAccount();

    expect(mocks.deleteUser).toHaveBeenCalled();
    expect(mocks.deleteWhere).toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in?deleted=1" });
  });
});
