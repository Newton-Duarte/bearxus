import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const AUTH_RATE_LIMITS = {
  login: { limit: 5, window: "15 m" },
  register: { limit: 3, window: "1 h" },
  "forgot-password": { limit: 3, window: "1 h" },
  "reset-password": { limit: 5, window: "15 m" },
  "resend-verification": { limit: 3, window: "15 m" },
} as const;

export type AuthRateLimitName = keyof typeof AUTH_RATE_LIMITS;

export interface RateLimitDecision {
  success: boolean;
  remaining: number;
  reset: number;
  retryAfterSeconds?: number;
}

const WINDOW_MILLISECONDS: Record<AuthRateLimitName, number> = {
  login: 15 * 60 * 1000,
  register: 60 * 60 * 1000,
  "forgot-password": 60 * 60 * 1000,
  "reset-password": 15 * 60 * 1000,
  "resend-verification": 15 * 60 * 1000,
};

const limiters = new Map<AuthRateLimitName, Ratelimit>();
let redis: Redis | null = null;

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (forwarded) return forwarded;

  return headers.get("x-real-ip")?.trim() || "unknown";
}

function getLimiter(name: AuthRateLimitName): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;

  const existing = limiters.get(name);
  if (existing) return existing;

  try {
    redis ??= Redis.fromEnv();
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(AUTH_RATE_LIMITS[name].limit, AUTH_RATE_LIMITS[name].window),
      timeout: 1_000,
    });
    limiters.set(name, limiter);
    return limiter;
  } catch {
    return null;
  }
}

function allowDecision(name: AuthRateLimitName): RateLimitDecision {
  return {
    success: true,
    remaining: AUTH_RATE_LIMITS[name].limit,
    reset: Date.now() + WINDOW_MILLISECONDS[name],
  };
}

function normalizeIdentifier(identifier: string | undefined): string {
  return identifier?.trim().toLowerCase() || "unknown";
}

export async function checkAuthRateLimit(
  name: AuthRateLimitName,
  headers: Headers,
  identifier?: string,
): Promise<RateLimitDecision> {
  const limiter = getLimiter(name);
  if (!limiter) return allowDecision(name);

  const keyParts = [name, getClientIp(headers)];
  if (name === "login" || name === "resend-verification") keyParts.push(normalizeIdentifier(identifier));

  try {
    const result = await limiter.limit(keyParts.join(":"));
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      retryAfterSeconds: result.success ? undefined : WINDOW_MILLISECONDS[name] / 1000,
    };
  } catch {
    return allowDecision(name);
  }
}

export function getRetryAfterSeconds(decision: RateLimitDecision, now = Date.now()): number {
  return decision.retryAfterSeconds ?? Math.max(1, Math.ceil((decision.reset - now) / 1000));
}

export function getRateLimitMessage(decision: RateLimitDecision, now = Date.now()): string {
  const minutes = Math.max(1, Math.ceil(getRetryAfterSeconds(decision, now) / 60));
  return `Too many attempts. Please try again in ${minutes} minutes.`;
}

export function rateLimitResponse(decision: RateLimitDecision): Response {
  return Response.json(
    { error: getRateLimitMessage(decision) },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(getRetryAfterSeconds(decision)),
      },
    },
  );
}
