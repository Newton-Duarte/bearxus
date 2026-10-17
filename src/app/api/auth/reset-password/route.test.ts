import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  completePasswordReset: vi.fn(),
}));

vi.mock("@/lib/password-reset", () => ({
  completePasswordReset: mocks.completePasswordReset,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, checkAuthRateLimit: mocks.checkAuthRateLimit };
});

import { POST } from "@/app/api/auth/reset-password/route";

const token = "a".repeat(64);

function request(body: unknown): Request {
  return new Request("http://localhost/api/auth/reset-password", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.checkAuthRateLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 1_000 });
  mocks.completePasswordReset.mockResolvedValue("reset");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/auth/reset-password", () => {
  it("returns a 400 response for invalid JSON", async () => {
    const response = await POST(request("not-json"));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ success: false, data: null, error: "Invalid JSON body." });
  });

  it("returns the neutral invalid-token message for malformed tokens", async () => {
    const response = await POST(request({ token: "invalid", password: "password123", confirmPassword: "password123" }));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({
      success: false,
      data: null,
      error: "This password reset link is invalid, expired, or already used.",
    });
    expect(mocks.completePasswordReset).not.toHaveBeenCalled();
  });

  it.each([{}, { token: 123, password: "password123", confirmPassword: "password123" }])(
    "rejects malformed reset payload %j without token access",
    async (body) => {
      const response = await POST(request(body));

      expect(response.status).toBe(400);
      expect(await responseBody(response)).toEqual({
        success: false,
        data: null,
        error: "This password reset link is invalid, expired, or already used.",
      });
    expect(mocks.completePasswordReset).not.toHaveBeenCalled();
    },
  );

  it("returns field errors for mismatched passwords", async () => {
    const response = await POST(request({ token, password: "password123", confirmPassword: "different123" }));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({
      success: false,
      data: null,
      error: "Check the highlighted fields and try again.",
      fieldErrors: { confirmPassword: "Passwords do not match." },
    });
  });

  it("returns a 429 response when reset attempts are rate limited", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    mocks.checkAuthRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 900_000,
      retryAfterSeconds: 900,
    });

    const response = await POST(request({ token, password: "password123", confirmPassword: "password123" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await responseBody(response)).toEqual({ error: "Too many attempts. Please try again in 15 minutes." });
  });

  it("returns the invalid-token message when the helper rejects an expired or replayed token", async () => {
    mocks.completePasswordReset.mockResolvedValue("invalid");

    const response = await POST(request({ token, password: "password123", confirmPassword: "password123" }));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({
      success: false,
      data: null,
      error: "This password reset link is invalid, expired, or already used.",
    });
    expect(mocks.completePasswordReset).toHaveBeenCalledWith(token, "password123");
  });

  it("hashes the password and consumes a valid token", async () => {
    const response = await POST(request({ token, password: "password123", confirmPassword: "password123" }));

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({ success: true, data: null, error: null });
    expect(mocks.completePasswordReset).toHaveBeenCalledWith(token, "password123");
  });

  it("returns the invalid-token message when consumption loses a race", async () => {
    mocks.completePasswordReset.mockResolvedValue("invalid");

    const response = await POST(request({ token, password: "password123", confirmPassword: "password123" }));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toMatchObject({ success: false, error: "This password reset link is invalid, expired, or already used." });
  });

  it("returns a controlled error for token-service failures", async () => {
    mocks.completePasswordReset.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(request({ token, password: "password123", confirmPassword: "password123" }));

    expect(response.status).toBe(500);
    expect(await responseBody(response)).toEqual({
      success: false,
      data: null,
      error: "Unable to reset your password right now. Please try again.",
    });
  });

  it("returns a controlled error when the helper fails", async () => {
    mocks.completePasswordReset.mockRejectedValue(new Error("hash unavailable"));

    const response = await POST(request({ token, password: "password123", confirmPassword: "password123" }));

    expect(response.status).toBe(500);
    expect(await responseBody(response)).toEqual({
      success: false,
      data: null,
      error: "Unable to reset your password right now. Please try again.",
    });
    expect(mocks.completePasswordReset).toHaveBeenCalled();
  });
});
