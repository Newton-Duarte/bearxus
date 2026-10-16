import { hash } from "bcryptjs";

import { passwordResetSchema } from "@/lib/auth-validation";
import { isUsablePasswordResetToken, resetPasswordToken } from "@/lib/password-reset";
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

    const fieldErrors: PasswordResetResponse["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "password" || field === "confirmPassword") fieldErrors[field] ??= issue.message;
    }
    return respond({ success: false, data: null, error: "Check the highlighted fields and try again.", fieldErrors }, 400);
  }

  try {
    if (!(await isUsablePasswordResetToken(parsed.data.token))) {
      return respond({ success: false, data: null, error: invalidTokenMessage }, 400);
    }

    const passwordHash = await hash(parsed.data.password, 12);
    const result = await resetPasswordToken(parsed.data.token, passwordHash);
    if (result === "invalid") return respond({ success: false, data: null, error: invalidTokenMessage }, 400);
    return respond({ success: true, data: null, error: null }, 200);
  } catch {
    return respond({ success: false, data: null, error: "Unable to reset your password right now. Please try again." }, 500);
  }
}
