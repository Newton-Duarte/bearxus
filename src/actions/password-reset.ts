"use server";

import { hash } from "bcryptjs";
import { headers } from "next/headers";

import {
  isUsablePasswordResetToken,
  requestPasswordReset as issuePasswordReset,
  resetPasswordToken,
} from "@/lib/password-reset";
import { passwordResetRequestSchema, passwordResetSchema } from "@/lib/auth-validation";
import { checkAuthRateLimit, getRateLimitMessage, getRetryAfterSeconds } from "@/lib/rate-limit";
import type {
  PasswordResetFormState,
  PasswordResetRequestState,
} from "@/types/password-reset";

const RETRY_AFTER_SECONDS = 60;
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
    return { success: true, data: { retryAfterSeconds: RETRY_AFTER_SECONDS }, error: null };
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

    const fieldErrors: PasswordResetFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "password" || field === "confirmPassword") fieldErrors[field] ??= issue.message;
    }
    return { success: false, data: null, error: "Check the highlighted fields and try again.", fieldErrors };
  }

  try {
    if (!(await isUsablePasswordResetToken(parsed.data.token))) {
      return { success: false, data: null, error: invalidTokenMessage };
    }

    const passwordHash = await hash(parsed.data.password, 12);
    const result = await resetPasswordToken(parsed.data.token, passwordHash);
    if (result === "invalid") return { success: false, data: null, error: invalidTokenMessage };
    return { success: true, data: null, error: null };
  } catch {
    return { success: false, data: null, error: "Unable to reset your password right now. Please try again." };
  }
}
