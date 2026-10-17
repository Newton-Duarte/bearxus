import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  getRateLimitMessage: vi.fn(),
  headers: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("@/auth", () => ({ signIn: mocks.signIn }));
vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
  getRateLimitMessage: mocks.getRateLimitMessage,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next-auth", () => {
  class AuthError extends Error {
    type: string;

    constructor(message: string, type = "AuthError") {
      super(message);
      this.type = type;
    }
  }

  class CredentialsSignin extends AuthError {
    constructor() {
      super("Credentials failed", "CredentialsSignin");
    }
  }

  return { AuthError, CredentialsSignin };
});

import { AuthError, CredentialsSignin } from "next-auth";

import { signInWithCredentials } from "@/actions/auth";
import { EmailNotVerifiedError } from "@/lib/auth-errors";
import type { AuthFormState } from "@/types/auth";

const previousState: AuthFormState = { success: false, data: null, error: null };

function formData(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.checkAuthRateLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 1_000 });
  mocks.getRateLimitMessage.mockReturnValue("Too many attempts.");
});

describe("signInWithCredentials", () => {
  it("returns field errors without calling auth for invalid credentials", async () => {
    const result = await signInWithCredentials(previousState, formData({ email: "invalid", password: "short" }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Check your email and password.",
      fieldErrors: {
        email: "Invalid email address",
        password: "Password must contain at least 8 characters.",
      },
    });
    expect(mocks.checkAuthRateLimit).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "not-an-email"])("rejects malformed email payload %j before auth", async (email) => {
    const result = await signInWithCredentials(previousState, formData({ email, password: "password123" }));

    expect(result.success).toBe(false);
    expect(result.error).toBe("Check your email and password.");
    expect(result.fieldErrors?.email).toEqual(expect.any(String));
    expect(mocks.checkAuthRateLimit).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("returns the rate-limit message without attempting sign-in", async () => {
    mocks.checkAuthRateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 900_000 });
    mocks.getRateLimitMessage.mockReturnValue("Too many attempts. Please try again in 15 minutes.");

    const result = await signInWithCredentials(previousState, formData({
      email: "user@example.com",
      password: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Too many attempts. Please try again in 15 minutes.",
    });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("maps a credentials failure to the generic login error", async () => {
    mocks.signIn.mockRejectedValue(new CredentialsSignin());

    const result = await signInWithCredentials(previousState, formData({
      email: "user@example.com",
      password: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Email or password is incorrect. Try again.",
    });
  });

  it("maps a non-credential auth failure to the unavailable error", async () => {
    mocks.signIn.mockRejectedValue(new AuthError("internal failure"));

    const result = await signInWithCredentials(previousState, formData({
      email: "user@example.com",
      password: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Unable to sign in right now. Please try again.",
    });
  });

  it("marks an unverified credentials failure for the recovery flow", async () => {
    mocks.signIn.mockRejectedValue(new EmailNotVerifiedError());

    const result = await signInWithCredentials(previousState, formData({
      email: "user@example.com",
      password: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Verify your email before signing in. You can request a new verification link.",
      requiresEmailVerification: true,
    });
  });

  it("passes a safe callback destination to credentials sign-in", async () => {
    const result = await signInWithCredentials(previousState, formData({
      email: " USER@EXAMPLE.COM ",
      password: "password123",
      callbackUrl: "/profile?tab=security",
    }));

    expect(result).toEqual({ success: true, data: null, error: null });
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "password123",
      redirectTo: "/profile?tab=security",
    });
  });

  it.each([
    "https://evil.example/steal",
    "/dashboard%2Fsecret",
    "/dashboard%ZZ",
    "/sign-in",
    "/api/auth/session",
  ])("falls back to the dashboard for unsafe callback destination %j", async (callbackUrl) => {
    await signInWithCredentials(previousState, formData({
      email: "user@example.com",
      password: "password123",
      callbackUrl,
    }));

    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "password123",
      redirectTo: "/dashboard",
    });
  });
});
