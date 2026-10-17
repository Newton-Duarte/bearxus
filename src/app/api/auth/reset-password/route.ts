import { passwordResetSchema } from "@/lib/auth-validation";
import { completePasswordReset } from "@/lib/password-reset";
import { getFirstFieldErrors } from "@/lib/form-errors";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const invalidTokenMessage = "This password reset link is invalid, expired, or already used.";

interface PasswordResetResponse {
  success: boolean;
  data: null;
  error: string | null;
  fieldErrors?: { token?: string; password?: string; confirmPassword?: string };
}

function respond(body: PasswordResetResponse, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkAuthRateLimit("reset-password", request.headers);
  if (!rateLimit.success) return rateLimitResponse(rateLimit);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return respond({ success: false, data: null, error: "Invalid JSON body." }, 400);
  }

  const parsed = passwordResetSchema.safeParse(input);
  if (!parsed.success) {
    const tokenIssue = parsed.error.issues.some(issue => issue.path[0] === "token");
    if (tokenIssue) return respond({ success: false, data: null, error: invalidTokenMessage }, 400);

    const fieldErrors = getFirstFieldErrors(parsed.error.issues, ["password", "confirmPassword"]);
    return respond({ success: false, data: null, error: "Check the highlighted fields and try again.", fieldErrors }, 400);
  }

  try {
    const result = await completePasswordReset(parsed.data.token, parsed.data.password);
    if (result === "invalid") return respond({ success: false, data: null, error: invalidTokenMessage }, 400);
    return respond({ success: true, data: null, error: null }, 200);
  } catch {
    return respond({ success: false, data: null, error: "Unable to reset your password right now. Please try again." }, 500);
  }
}
