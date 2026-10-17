import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  requestEmailVerification: vi.fn(),
}));

vi.mock("@/lib/email-verification", () => ({ requestEmailVerification: mocks.requestEmailVerification }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, checkAuthRateLimit: mocks.checkAuthRateLimit };
});

import { POST } from "@/app/api/auth/resend-verification/route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/auth/resend-verification", {
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
  mocks.checkAuthRateLimit.mockResolvedValue({ success: true, remaining: 2, reset: Date.now() + 1_000 });
  mocks.requestEmailVerification.mockResolvedValue({ status: "sent", retryAfterSeconds: 60 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/auth/resend-verification", () => {
  it("returns a 400 response for invalid JSON", async () => {
    const response = await POST(request("not-json"));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ success: false, data: null, error: "Invalid JSON body." });
  });

  it("validates email before checking the rate limit", async () => {
    const response = await POST(request({ email: "invalid" }));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ success: false, data: null, error: "Enter a valid email address." });
    expect(mocks.checkAuthRateLimit).not.toHaveBeenCalled();
  });

  it.each([{}, { email: "   " }, { email: 123 }])("keeps malformed payload %j neutral", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ success: false, data: null, error: "Enter a valid email address." });
    expect(mocks.checkAuthRateLimit).not.toHaveBeenCalled();
  });

  it("returns a 429 response for a valid but rate-limited email", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    mocks.checkAuthRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 900_000,
      retryAfterSeconds: 900,
    });

    const response = await POST(request({ email: "user@example.com" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await responseBody(response)).toEqual({ error: "Too many attempts. Please try again in 15 minutes." });
    expect(mocks.requestEmailVerification).not.toHaveBeenCalled();
  });

  it("normalizes the email and returns a neutral success response", async () => {
    const response = await POST(request({ email: " USER@EXAMPLE.COM " }));

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      success: true,
      data: { retryAfterSeconds: 60 },
      error: null,
    });
    expect(mocks.requestEmailVerification).toHaveBeenCalledWith("user@example.com");
  });

  it("returns the retry value supplied by the verification service", async () => {
    mocks.requestEmailVerification.mockResolvedValue({ status: "cooldown", retryAfterSeconds: 90 });

    const response = await POST(request({ email: "user@example.com" }));

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      success: true,
      data: { retryAfterSeconds: 90 },
      error: null,
    });
  });

  it("keeps email delivery failures neutral", async () => {
    mocks.requestEmailVerification.mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(request({ email: "user@example.com" }));

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      success: true,
      data: { retryAfterSeconds: 60 },
      error: null,
    });
  });
});
