import { passwordResetRequestSchema } from "@/lib/auth-validation";
import { requestPasswordReset } from "@/lib/password-reset";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const RETRY_AFTER_SECONDS = 60;

interface PasswordResetRequestResponse {
  success: boolean;
  data: { retryAfterSeconds: number } | null;
  error: string | null;
}

function respond(body: PasswordResetRequestResponse, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkAuthRateLimit("forgot-password", request.headers);
  if (!rateLimit.success) return rateLimitResponse(rateLimit);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return respond({ success: false, data: null, error: "Invalid JSON body." }, 400);
  }

  const parsed = passwordResetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return respond({ success: false, data: null, error: "Enter a valid email address." }, 400);
  }

  try {
    const result = await requestPasswordReset(parsed.data.email);
    return respond({ success: true, data: { retryAfterSeconds: result.retryAfterSeconds }, error: null }, 200);
  } catch {
    return respond({ success: true, data: { retryAfterSeconds: RETRY_AFTER_SECONDS }, error: null }, 200);
  }
}
