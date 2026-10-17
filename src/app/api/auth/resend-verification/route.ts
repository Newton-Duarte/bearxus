import { verificationEmailSchema } from "@/lib/auth-validation";
import { requestEmailVerification } from "@/lib/email-verification";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { RECOVERY_COOLDOWN_SECONDS } from "@/lib/recovery";

interface VerificationResponse {
  success: boolean;
  data: { retryAfterSeconds: number } | null;
  error: string | null;
}

function respond(body: VerificationResponse, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return respond({ success: false, data: null, error: "Invalid JSON body." }, 400);
  }

  const parsed = verificationEmailSchema.safeParse(input);
  if (!parsed.success) {
    return respond({ success: false, data: null, error: "Enter a valid email address." }, 400);
  }

  const rateLimit = await checkAuthRateLimit("resend-verification", request.headers, parsed.data.email);
  if (!rateLimit.success) return rateLimitResponse(rateLimit);

  try {
    const result = await requestEmailVerification(parsed.data.email);
    return respond({ success: true, data: { retryAfterSeconds: result.retryAfterSeconds }, error: null }, 200);
  } catch {
    // Delivery/storage failures must not reveal whether this account is eligible.
  }
  return respond({ success: true, data: { retryAfterSeconds: RECOVERY_COOLDOWN_SECONDS }, error: null }, 200);
}
