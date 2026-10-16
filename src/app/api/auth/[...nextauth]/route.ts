import { handlers } from "@/auth";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const GET = handlers.GET;

export async function POST(request: NextRequest): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname.endsWith("/api/auth/callback/credentials")) {
    let email: string | undefined;
    try {
      const formData = await request.clone().formData();
      const value = formData.get("email");
      if (typeof value === "string") email = value;
    } catch {
      // Let Auth.js handle malformed request bodies with its normal response.
    }

    const rateLimit = await checkAuthRateLimit("login", request.headers, email);
    if (!rateLimit.success) return rateLimitResponse(rateLimit);
  }

  return handlers.POST(request);
}
