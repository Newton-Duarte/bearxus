import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  handlerGet: vi.fn(),
  handlerPost: vi.fn(),
  rateLimitResponse: vi.fn(),
}));

vi.mock("@/auth", () => ({
  handlers: { GET: mocks.handlerGet, POST: mocks.handlerPost },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
  rateLimitResponse: mocks.rateLimitResponse,
}));

import type { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

function nextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

function credentialRequest(email?: string): NextRequest {
  const body = email === undefined ? "not-form-data" : new URLSearchParams({ email }).toString();
  const headers = email === undefined
    ? undefined
    : { "content-type": "application/x-www-form-urlencoded" };

  return nextRequest(new Request("http://localhost/api/auth/callback/credentials", {
    body,
    headers,
    method: "POST",
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkAuthRateLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 900_000 });
  mocks.handlerPost.mockResolvedValue(new Response("handled", { status: 200 }));
  mocks.rateLimitResponse.mockReturnValue(new Response("rate-limited", { status: 429 }));
});

describe("NextAuth route adapter", () => {
  it("exports the Auth.js GET handler unchanged", () => {
    expect(GET).toBe(mocks.handlerGet);
  });

  it("delegates non-credential POST requests without rate limiting", async () => {
    const request = nextRequest(new Request("http://localhost/api/auth/session", { method: "POST" }));

    const response = await POST(request);

    expect(response).toBe(await mocks.handlerPost.mock.results[0]?.value);
    expect(mocks.checkAuthRateLimit).not.toHaveBeenCalled();
    expect(mocks.handlerPost).toHaveBeenCalledWith(request);
  });

  it("rate-limits credential callbacks using the submitted email", async () => {
    const request = credentialRequest("USER@EXAMPLE.COM");

    await POST(request);

    expect(mocks.checkAuthRateLimit).toHaveBeenCalledWith("login", request.headers, "USER@EXAMPLE.COM");
    expect(mocks.handlerPost).toHaveBeenCalledWith(request);
  });

  it("preserves the original credential body for Auth.js", async () => {
    mocks.handlerPost.mockImplementation(async (request: Request) => {
      const formData = await request.formData();
      return new Response(String(formData.get("email")));
    });
    const request = credentialRequest("user@example.com");

    const response = await POST(request);

    expect(await response.text()).toBe("user@example.com");
  });

  it("passes malformed credential bodies to rate limiting with no email", async () => {
    const request = credentialRequest();

    await POST(request);

    expect(mocks.checkAuthRateLimit).toHaveBeenCalledWith("login", request.headers, undefined);
    expect(mocks.handlerPost).toHaveBeenCalledWith(request);
  });

  it("returns the rate-limit response without invoking Auth.js", async () => {
    const rateLimit = { success: false, remaining: 0, reset: Date.now() + 900_000, retryAfterSeconds: 900 };
    mocks.checkAuthRateLimit.mockResolvedValue(rateLimit);
    const request = credentialRequest("user@example.com");

    const response = await POST(request);

    expect(response).toBe(await mocks.rateLimitResponse.mock.results[0]?.value);
    expect(mocks.rateLimitResponse).toHaveBeenCalledWith(rateLimit);
    expect(mocks.handlerPost).not.toHaveBeenCalled();
  });
});
