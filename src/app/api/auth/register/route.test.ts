import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  findFirst: vi.fn(),
  hash: vi.fn(),
  isEmailVerificationEnabled: vi.fn(),
  onConflictDoNothing: vi.fn(),
  requestEmailVerification: vi.fn(),
  returning: vi.fn(),
  sql: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ hash: mocks.hash }));
vi.mock("drizzle-orm", () => ({ sql: mocks.sql }));
vi.mock("@/db", () => ({
  db: {
    insert: mocks.insert,
    query: { users: { findFirst: mocks.findFirst } },
  },
}));
vi.mock("@/db/schema", () => ({ users: { email: "email" } }));
vi.mock("@/lib/email-verification", () => ({ requestEmailVerification: mocks.requestEmailVerification }));
vi.mock("@/lib/email-verification-config", () => ({ isEmailVerificationEnabled: mocks.isEmailVerificationEnabled }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, checkAuthRateLimit: mocks.checkAuthRateLimit };
});

import { POST } from "@/app/api/auth/register/route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
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
  mocks.findFirst.mockResolvedValue(null);
  mocks.hash.mockResolvedValue("hashed-password");
  mocks.isEmailVerificationEnabled.mockReturnValue(true);
  mocks.requestEmailVerification.mockResolvedValue({ status: "sent", retryAfterSeconds: 60 });
  mocks.returning.mockResolvedValue([{ id: "user-1", name: "Bear", email: "user@example.com" }]);
  mocks.onConflictDoNothing.mockReturnValue({ returning: mocks.returning });
  mocks.values.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
  mocks.insert.mockReturnValue({ values: mocks.values });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/auth/register", () => {
  it("returns a 400 response for invalid JSON", async () => {
    const response = await POST(request("not-json"));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ success: false, data: null, error: "Invalid JSON body." });
  });

  it("returns a 400 response for invalid registration data", async () => {
    const response = await POST(request({ email: "invalid" }));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({
      success: false,
      data: null,
      error: "Invalid email address",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each<[Record<string, unknown>, string]>([
    [{}, "Invalid input: expected string, received undefined"],
    [{ email: "   " }, "Invalid email address"],
    [{ email: 123 }, "Invalid input: expected string, received number"],
  ])("returns the validation contract for malformed payload %j", async (body, error) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ success: false, data: null, error });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns a conflict when the email already exists", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing-user" });

    const response = await POST(request({
      name: "Bear",
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(response.status).toBe(409);
    expect(await responseBody(response)).toEqual({ success: false, data: null, error: "Email is already registered." });
  });

  it("creates a verified-registration-required account and sends verification", async () => {
    const response = await POST(request({
      name: "Bear",
      email: " USER@EXAMPLE.COM ",
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(response.status).toBe(201);
    expect(await responseBody(response)).toEqual({
      success: true,
      data: {
        id: "user-1",
        name: "Bear",
        email: "user@example.com",
        verificationEmailSent: true,
        verificationRequired: true,
      },
      error: null,
    });
    expect(mocks.hash).toHaveBeenCalledWith("password123", 12);
    expect(mocks.requestEmailVerification).toHaveBeenCalledWith("user@example.com");
  });

  it("creates an automatically verified account when verification is disabled", async () => {
    mocks.isEmailVerificationEnabled.mockReturnValue(false);

    const response = await POST(request({
      name: "Bear",
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(response.status).toBe(201);
    expect(await responseBody(response)).toEqual({
      success: true,
      data: {
        id: "user-1",
        name: "Bear",
        email: "user@example.com",
        verificationEmailSent: false,
        verificationRequired: false,
      },
      error: null,
    });
    expect(mocks.requestEmailVerification).not.toHaveBeenCalled();
  });

  it("keeps account creation successful when verification delivery fails", async () => {
    mocks.requestEmailVerification.mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(request({
      name: "Bear",
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(response.status).toBe(201);
    expect(await responseBody(response)).toMatchObject({
      success: true,
      data: { verificationEmailSent: false, verificationRequired: true },
      error: null,
    });
  });

  it("returns the rate-limit response before parsing the body", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    mocks.checkAuthRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 900_000,
      retryAfterSeconds: 900,
    });

    const response = await POST(request("not-json"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await responseBody(response)).toEqual({ error: "Too many attempts. Please try again in 15 minutes." });
  });

  it("returns a controlled error for an unexpected database failure", async () => {
    mocks.findFirst.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(request({
      name: "Bear",
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    }));

    expect(response.status).toBe(500);
    expect(await responseBody(response)).toEqual({
      success: false,
      data: null,
      error: "Unable to register. Please try again.",
    });
  });
});
