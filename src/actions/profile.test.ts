import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  compare: vi.fn(),
  deleteUser: vi.fn(),
  deleteReturning: vi.fn(),
  deleteWhere: vi.fn(),
  findFirst: vi.fn(),
  hash: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  set: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  sql: vi.fn(),
  update: vi.fn(),
  updateReturning: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ compare: mocks.compare, hash: mocks.hash }));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: mocks.signIn, signOut: mocks.signOut }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-auth", () => {
  class AuthError extends Error {
    type: string;

    constructor(message: string, type = "AuthError") {
      super(message);
      this.type = type;
    }
  }

  return { AuthError };
});
vi.mock("@/db", () => ({
  db: {
    delete: mocks.deleteUser,
    query: { users: { findFirst: mocks.findFirst } },
    update: mocks.update,
  },
}));
vi.mock("@/db/schema", () => ({
  accounts: { provider: "provider", userId: "userId" },
  users: { id: "id", passwordHash: "passwordHash" },
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNotNull: vi.fn(),
  sql: mocks.sql,
}));

import { AuthError } from "next-auth";

import { changePassword, connectOAuthProvider, deleteAccount, unlinkOAuthProvider } from "@/actions/profile";
import type { ChangePasswordState, UnlinkProviderState } from "@/types/profile";

const previousState: ChangePasswordState = { success: false, error: null };
const previousUnlinkState: UnlinkProviderState = { success: false, error: null };

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
  mocks.deleteReturning.mockResolvedValue([{ provider: "github" }]);
  mocks.deleteWhere.mockReturnValue({ returning: mocks.deleteReturning });
  mocks.deleteUser.mockReturnValue({ where: mocks.deleteWhere });
  mocks.signOut.mockResolvedValue(undefined);
  mocks.signIn.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

describe("connectOAuthProvider", () => {
  it("redirects an expired session to sign-in without starting OAuth", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(connectOAuthProvider("github", new FormData())).rejects.toThrow("REDIRECT:/sign-in?callbackUrl=%2Fprofile");

    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("starts the GitHub OAuth flow for an authenticated session", async () => {
    await connectOAuthProvider("github", new FormData());

    expect(mocks.signIn).toHaveBeenCalledWith("github", { redirectTo: "/profile" });
  });

  it("maps OAuthAccountNotLinked to a safe profile error", async () => {
    const oauthError = Object.assign(new AuthError("not linked"), { type: "OAuthAccountNotLinked" });
    mocks.signIn.mockRejectedValue(oauthError);

    await expect(connectOAuthProvider("github", new FormData())).rejects.toThrow("REDIRECT:/profile?error=OAuthAccountNotLinked&provider=github");
  });

  it("rethrows unexpected connection failures", async () => {
    const failure = new Error("provider unavailable");
    mocks.signIn.mockRejectedValue(failure);

    await expect(connectOAuthProvider("github", new FormData())).rejects.toBe(failure);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects an unsupported provider before starting OAuth", async () => {
    await expect(connectOAuthProvider("google", new FormData())).rejects.toThrow("REDIRECT:/profile?error=OAuthSignin");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
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

describe("unlinkOAuthProvider", () => {
  it("rejects an expired unlink request before querying accounts", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(unlinkOAuthProvider("github", previousUnlinkState, new FormData())).resolves.toEqual({
      success: false,
      error: "Your session has expired. Sign in again.",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("removes GitHub and refreshes the profile after a guarded delete succeeds", async () => {
    const result = await unlinkOAuthProvider("github", previousUnlinkState, new FormData());

    expect(result).toEqual({ success: true, error: null });
    expect(mocks.deleteUser).toHaveBeenCalled();
    expect(mocks.sql).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("returns a controlled error when GitHub is missing or is the only sign-in method", async () => {
    mocks.deleteReturning.mockResolvedValue([]);

    await expect(unlinkOAuthProvider("github", previousUnlinkState, new FormData())).resolves.toEqual({
      success: false,
      error: "GitHub is not connected or is your only sign-in method.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("converts database failures to a controlled error", async () => {
    mocks.deleteReturning.mockRejectedValue(new Error("database unavailable"));

    await expect(unlinkOAuthProvider("github", previousUnlinkState, new FormData())).resolves.toEqual({
      success: false,
      error: "Unable to disconnect GitHub right now.",
    });
  });
});
