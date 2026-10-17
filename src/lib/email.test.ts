import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiKey: "",
  send: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mocks.send };

    constructor(apiKey: string) {
      mocks.apiKey = apiKey;
    }
  },
}));

import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.apiKey = "";
  mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendVerificationEmail", () => {
  it("rejects when the Resend API key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", undefined);

    await expect(sendVerificationEmail("user@example.com", "http://localhost/verify?x=1")).rejects.toThrow(
      "Verification email is not configured.",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("escapes the verification URL in HTML while preserving the text URL", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const verificationUrl = "https://bearxus.test/verify?next=\"<safe>&mode='full'";

    await sendVerificationEmail("user@example.com", verificationUrl);

    expect(mocks.apiKey).toBe("re_test");
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Verify your email for Bearxus",
        text: expect.stringContaining(verificationUrl),
        html: expect.stringContaining("&quot;&lt;safe&gt;&amp;mode=&#39;full&#39;"),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each([
    [{ data: null, error: null }],
    [{ data: { id: "email-1" }, error: new Error("provider failed") }],
  ])("rejects when Resend returns an unsuccessful result: %j", async (result) => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    mocks.send.mockResolvedValue(result);

    await expect(sendVerificationEmail("user@example.com", "http://localhost/verify")).rejects.toThrow(
      "Unable to send verification email.",
    );
  });
});

describe("sendPasswordResetEmail", () => {
  it("sends the reset email through Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const resetUrl = "https://bearxus.test/reset-password?token=abc";

    await sendPasswordResetEmail("user@example.com", resetUrl);

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Reset your Bearxus password",
        text: expect.stringContaining(resetUrl),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects when the Resend API key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", undefined);

    await expect(sendPasswordResetEmail("user@example.com", "http://localhost/reset-password")).rejects.toThrow(
      "Password reset email is not configured.",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("escapes the password reset URL in HTML", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const resetUrl = "https://bearxus.test/reset?next=\"<safe>&mode='full'";

    await sendPasswordResetEmail("user@example.com", resetUrl);

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("&quot;&lt;safe&gt;&amp;mode=&#39;full&#39;"),
        text: expect.stringContaining(resetUrl),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects when the password reset provider returns an error", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: new Error("provider failed") });

    await expect(sendPasswordResetEmail("user@example.com", "http://localhost/reset-password")).rejects.toThrow(
      "Unable to send password reset email.",
    );
  });

  it("rejects when the password reset provider returns no message id", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    mocks.send.mockResolvedValue({ data: {}, error: null });

    await expect(sendPasswordResetEmail("user@example.com", "http://localhost/reset-password")).rejects.toThrow(
      "Unable to send password reset email.",
    );
  });
});
