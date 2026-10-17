"use server";

import { headers } from "next/headers";

import { verificationEmailSchema } from "@/lib/auth-validation";
import { requestEmailVerification } from "@/lib/email-verification";
import { checkAuthRateLimit, getRateLimitMessage, getRetryAfterSeconds } from "@/lib/rate-limit";
import { RECOVERY_COOLDOWN_SECONDS } from "@/lib/recovery";
import type { VerificationFormState } from "@/types/email-verification";

export async function resendVerificationEmail(
  _previous: VerificationFormState,
  formData: FormData,
): Promise<VerificationFormState> {
  const parsed = verificationEmailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      success: false, data: null, error: "Enter a valid email address.",
      fieldErrors: { email: "Enter a valid email address." },
    };
  }

  const rateLimit = await checkAuthRateLimit("resend-verification", await headers(), parsed.data.email);
  if (!rateLimit.success) {
    return { success: false, data: { retryAfterSeconds: getRetryAfterSeconds(rateLimit) }, error: getRateLimitMessage(rateLimit) };
  }

  try {
    const result = await requestEmailVerification(parsed.data.email);
    return { success: true, data: { retryAfterSeconds: result.retryAfterSeconds }, error: null };
  } catch {
    // Delivery/storage failures must not reveal whether this account is eligible.
  }
  return { success: true, data: { retryAfterSeconds: RECOVERY_COOLDOWN_SECONDS }, error: null };
}
