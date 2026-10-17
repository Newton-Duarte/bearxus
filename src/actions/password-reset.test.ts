import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  completePasswordReset: vi.fn(),
  getRateLimitMessage: vi.fn(),
  getRetryAfterSeconds: vi.fn(),
  headers: vi.fn(),
  issuePasswordReset: vi.fn(),
}));

vi.mock("@/lib/password-reset", () => ({
  completePasswordReset: mocks.completePasswordReset,
  requestPasswordReset: mocks.issuePasswordReset,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
  getRateLimitMessage: mocks.getRateLimitMessage,
  getRetryAfterSeconds: mocks.getRetryAfterSeconds,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));

import {
  completePasswordReset,
  requestPasswordReset,
} from "@/actions/password-reset";
import type {
  PasswordResetFormState,
  PasswordResetRequestState,
} from "@/types/password-reset";

const requestPrevious: PasswordResetRequestState = { success: false, data: null, error: null };
const formPrevious: PasswordResetFormState = { success: false, data: null, error: null };

function formData(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.checkAuthRateLimit.mockResolvedValue({ success: true, remaining: 2, reset: Date.now() + 1_000 });
  mocks.getRateLimitMessage.mockReturnValue("Too many attempts.");
  mocks.getRetryAfterSeconds.mockReturnValue(900);
  mocks.completePasswordReset.mockResolvedValue("reset");
  mocks.issuePasswordReset.mockResolvedValue({ status: "sent", retryAfterSeconds: 60 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("requestPasswordReset", () => {
  it("returns an email field error for invalid input", async () => {
    const result = await requestPasswordReset(requestPrevious, formData({ email: "invalid" }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Enter a valid email address.",
      fieldErrors: { email: "Enter a valid email address." },
    });
    expect(mocks.issuePasswordReset).not.toHaveBeenCalled();
  });

  it("returns retry data when the request is rate limited", async () => {
    mocks.checkAuthRateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 900_000 });
    mocks.getRetryAfterSeconds.mockReturnValue(900);

    const result = await requestPasswordReset(requestPrevious, formData({ email: "user@example.com" }));

    expect(result).toEqual({ success: false, data: { retryAfterSeconds: 900 }, error: "Too many attempts." });
    expect(mocks.issuePasswordReset).not.toHaveBeenCalled();
  });

  it("keeps provider failures neutral with the fixed retry cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    mocks.issuePasswordReset.mockRejectedValue(new Error("provider unavailable"));

    const result = await requestPasswordReset(requestPrevious, formData({ email: "user@example.com" }));

    expect(result).toEqual({ success: true, data: { retryAfterSeconds: 60 }, error: null });
  });
});

describe("completePasswordReset", () => {
  it("rejects malformed reset tokens without checking token state", async () => {
    const result = await completePasswordReset(formPrevious, formData({
      token: "invalid",
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "This password reset link is invalid, expired, or already used.",
    });
    expect(mocks.completePasswordReset).not.toHaveBeenCalled();
  });

  it("returns password field errors for a mismatched confirmation", async () => {
    const result = await completePasswordReset(formPrevious, formData({
      token: "a".repeat(64),
      password: "password123",
      confirmPassword: "different123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Check the highlighted fields and try again.",
      fieldErrors: { confirmPassword: "Passwords do not match." },
    });
  });

  it("returns the invalid-token message when the helper rejects an expired or replayed token", async () => {
    mocks.completePasswordReset.mockResolvedValue("invalid");

    const result = await completePasswordReset(formPrevious, formData({
      token: "a".repeat(64),
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "This password reset link is invalid, expired, or already used.",
    });
    expect(mocks.completePasswordReset).toHaveBeenCalledWith("a".repeat(64), "password123");
  });

  it("hashes and consumes a usable reset token", async () => {
    const token = "a".repeat(64);

    const result = await completePasswordReset(formPrevious, formData({
      token,
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(result).toEqual({ success: true, data: null, error: null });
    expect(mocks.completePasswordReset).toHaveBeenCalledWith(token, "password123");
  });

  it("returns the invalid-token message when token consumption loses a race", async () => {
    mocks.completePasswordReset.mockResolvedValue("invalid");

    const result = await completePasswordReset(formPrevious, formData({
      token: "a".repeat(64),
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "This password reset link is invalid, expired, or already used.",
    });
  });

  it("converts token-service failures to a controlled error", async () => {
    mocks.completePasswordReset.mockRejectedValue(new Error("database unavailable"));

    const result = await completePasswordReset(formPrevious, formData({
      token: "a".repeat(64),
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Unable to reset your password right now. Please try again.",
    });
  });

  it("converts helper failures to a controlled error", async () => {
    mocks.completePasswordReset.mockRejectedValue(new Error("hash unavailable"));

    const result = await completePasswordReset(formPrevious, formData({
      token: "a".repeat(64),
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Unable to reset your password right now. Please try again.",
    });
    expect(mocks.completePasswordReset).toHaveBeenCalled();
  });
});
