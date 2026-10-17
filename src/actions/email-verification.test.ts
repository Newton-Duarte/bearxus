import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  getRateLimitMessage: vi.fn(),
  getRetryAfterSeconds: vi.fn(),
  headers: vi.fn(),
  requestEmailVerification: vi.fn(),
}));

vi.mock("@/lib/email-verification", () => ({ requestEmailVerification: mocks.requestEmailVerification }));
vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
  getRateLimitMessage: mocks.getRateLimitMessage,
  getRetryAfterSeconds: mocks.getRetryAfterSeconds,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));

import { resendVerificationEmail } from "@/actions/email-verification";
import type { VerificationFormState } from "@/types/email-verification";

const previousState: VerificationFormState = { success: false, data: null, error: null };

function formData(email: string): FormData {
  const form = new FormData();
  form.set("email", email);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.checkAuthRateLimit.mockResolvedValue({ success: true, remaining: 2, reset: Date.now() + 1_000 });
  mocks.getRateLimitMessage.mockReturnValue("Too many attempts.");
  mocks.getRetryAfterSeconds.mockReturnValue(900);
  mocks.requestEmailVerification.mockResolvedValue({ status: "sent", retryAfterSeconds: 60 });
});

describe("resendVerificationEmail", () => {
  it("returns a field error before checking the rate limit for invalid email", async () => {
    const result = await resendVerificationEmail(previousState, formData("not-an-email"));

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Enter a valid email address.",
      fieldErrors: { email: "Enter a valid email address." },
    });
    expect(mocks.checkAuthRateLimit).not.toHaveBeenCalled();
  });

  it("returns retry data when resend is rate limited", async () => {
    mocks.checkAuthRateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 900_000 });
    mocks.getRetryAfterSeconds.mockReturnValue(900);

    const result = await resendVerificationEmail(previousState, formData("user@example.com"));

    expect(result).toEqual({
      success: false,
      data: { retryAfterSeconds: 900 },
      error: "Too many attempts.",
    });
    expect(mocks.requestEmailVerification).not.toHaveBeenCalled();
  });

  it("normalizes the email and returns a 60-second retry value after delivery", async () => {
    const result = await resendVerificationEmail(previousState, formData(" USER@EXAMPLE.COM "));

    expect(result).toEqual({ success: true, data: { retryAfterSeconds: 60 }, error: null });
    expect(mocks.requestEmailVerification).toHaveBeenCalledWith("user@example.com");
  });

  it("keeps delivery failures neutral", async () => {
    mocks.requestEmailVerification.mockRejectedValue(new Error("provider unavailable"));

    const result = await resendVerificationEmail(previousState, formData("user@example.com"));

    expect(result).toEqual({ success: true, data: { retryAfterSeconds: 60 }, error: null });
  });
});
