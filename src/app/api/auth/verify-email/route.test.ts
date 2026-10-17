import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verifyEmailToken: vi.fn() }));

vi.mock("@/lib/email-verification", () => ({ verifyEmailToken: mocks.verifyEmailToken }));

import { GET, HEAD } from "@/app/api/auth/verify-email/route";

function request(token?: string): Request {
  const url = new URL("http://localhost/api/auth/verify-email");
  if (token !== undefined) url.searchParams.set("token", token);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyEmailToken.mockResolvedValue("invalid");
});

describe("GET /api/auth/verify-email", () => {
  it("redirects verified tokens to sign-in", async () => {
    mocks.verifyEmailToken.mockResolvedValue("verified");

    const response = await GET(request("a".repeat(64)));

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/sign-in?verified=1");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(mocks.verifyEmailToken).toHaveBeenCalledWith("a".repeat(64));
  });

  it("redirects invalid or missing tokens to the invalid status", async () => {
    const response = await GET(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/verify-email?status=invalid");
    expect(mocks.verifyEmailToken).toHaveBeenCalledWith("");
  });

  it("redirects service failures to the error status", async () => {
    mocks.verifyEmailToken.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(request("a".repeat(64)));

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/verify-email?status=error");
  });
});

describe("HEAD /api/auth/verify-email", () => {
  it("returns method-not-allowed with safe headers", () => {
    const response = HEAD();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});
