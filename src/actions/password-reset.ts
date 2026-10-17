"use server";

import { headers } from "next/headers";

import {
  completePasswordReset as completePasswordResetToken,
  requestPasswordReset as issuePasswordReset,
} from "@/lib/password-reset";
import { passwordResetRequestSchema, passwordResetSchema } from "@/lib/auth-validation";
import { getFirstFieldErrors } from "@/lib/form-errors";
import { checkAuthRateLimit, getRateLimitMessage, getRetryAfterSeconds } from "@/lib/rate-limit";
import { RECOVERY_COOLDOWN_SECONDS } from "@/lib/recovery";
import type {
  PasswordResetFormState,
  PasswordResetRequestState,
} from "@/types/password-reset";

const invalidTokenMessage = "This password reset link is invalid, expired, or already used.";

export async function requestPasswordReset(
  _previous: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const parsed = passwordResetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      success: false,
      data: null,
      error: "Enter a valid email address.",
      fieldErrors: { email: "Enter a valid email address." },
    };
  }

  const rateLimit = await checkAuthRateLimit("forgot-password", await headers());
  if (!rateLimit.success) {
    return { success: false, data: { retryAfterSeconds: getRetryAfterSeconds(rateLimit) }, error: getRateLimitMessage(rateLimit) };
  }

  try {
    const result = await issuePasswordReset(parsed.data.email);
    return { success: true, data: { retryAfterSeconds: result.retryAfterSeconds }, error: null };
  } catch {
    return { success: true, data: { retryAfterSeconds: RECOVERY_COOLDOWN_SECONDS }, error: null };
  }
}

export async function completePasswordReset(
  _previous: PasswordResetFormState,
  formData: FormData,
): Promise<PasswordResetFormState> {
  const rateLimit = await checkAuthRateLimit("reset-password", await headers());
  if (!rateLimit.success) {
    return { success: false, data: null, error: getRateLimitMessage(rateLimit) };
  }

  const parsed = passwordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const tokenIssue = parsed.error.issues.some(issue => issue.path[0] === "token");
    if (tokenIssue) return { success: false, data: null, error: invalidTokenMessage };

    const fieldErrors = getFirstFieldErrors(parsed.error.issues, ["password", "confirmPassword"]);
    return { success: false, data: null, error: "Check the highlighted fields and try again.", fieldErrors };
  }

  try {
    const result = await completePasswordResetToken(parsed.data.token, parsed.data.password);
    if (result === "invalid") return { success: false, data: null, error: invalidTokenMessage };
    return { success: true, data: null, error: null };
  } catch {
    return { success: false, data: null, error: "Unable to reset your password right now. Please try again." };
  }
}
