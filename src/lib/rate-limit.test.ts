import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  redisFromEnv: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: mocks.redisFromEnv } }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow = vi.fn(() => "sliding-window");
    limit = mocks.limit;
  },
}));

import {
  AUTH_RATE_LIMITS,
  checkAuthRateLimit,
  getClientIp,
  getRateLimitMessage,
  getRetryAfterSeconds,
} from "@/lib/rate-limit";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("getClientIp", () => {
  it("uses the first forwarded address before the real-ip header", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.10, 198.51.100.8 ",
      "x-real-ip": "192.0.2.10",
    });

    expect(getClientIp(headers)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip and then unknown", () => {
    expect(getClientIp(new Headers({ "x-real-ip": " 192.0.2.10 " }))).toBe("192.0.2.10");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("checkAuthRateLimit", () => {
  it("fails open with the configured allowance when Redis is unavailable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));

    const decision = await checkAuthRateLimit("register", new Headers());

    expect(decision).toEqual({
      success: true,
      remaining: AUTH_RATE_LIMITS.register.limit,
      reset: Date.now() + 60 * 60 * 1000,
    });
  });

  it("fails open when the configured limiter rejects", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    mocks.redisFromEnv.mockReturnValue({});
    mocks.limit.mockRejectedValue(new Error("Redis unavailable"));

    const decision = await checkAuthRateLimit("login", new Headers(), " USER@EXAMPLE.COM ");

    expect(decision).toEqual({
      success: true,
      remaining: AUTH_RATE_LIMITS.login.limit,
      reset: Date.now() + 15 * 60 * 1000,
    });
    expect(mocks.limit).toHaveBeenCalledWith("login:unknown:user@example.com");
  });

  it("returns a denied decision with the configured full-window retry duration", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    mocks.limit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 42_000 });

    const decision = await checkAuthRateLimit("login", new Headers(), "user@example.com");

    expect(decision).toEqual({
      success: false,
      remaining: 0,
      reset: Date.now() + 42_000,
      retryAfterSeconds: 15 * 60,
    });
  });
});

describe("rate-limit timing helpers", () => {
  it("uses an explicit retry duration and rounds reset windows upward", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));

    expect(getRetryAfterSeconds({ success: false, remaining: 0, reset: Date.now() + 61_000 })).toBe(61);
    expect(getRetryAfterSeconds({ success: false, remaining: 0, reset: Date.now() + 61_000 }, Date.now() + 1_000)).toBe(60);
    expect(getRetryAfterSeconds({ success: false, remaining: 0, reset: Date.now() - 1 })).toBe(1);
    expect(getRetryAfterSeconds({ success: false, remaining: 0, reset: 0, retryAfterSeconds: 900 })).toBe(900);
  });

  it.each([
    [1, "Too many attempts. Please try again in 1 minutes."],
    [61, "Too many attempts. Please try again in 2 minutes."],
    [120, "Too many attempts. Please try again in 2 minutes."],
  ])("formats %i seconds as %j", (seconds, expected) => {
    expect(getRateLimitMessage({ success: false, remaining: 0, reset: 0, retryAfterSeconds: seconds })).toBe(expected);
  });
});
