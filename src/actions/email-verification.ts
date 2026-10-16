"use server";

import { headers } from "next/headers";

import { verificationEmailSchema } from "@/lib/auth-validation";
import { requestEmailVerification } from "@/lib/email-verification";
import { checkAuthRateLimit, getRateLimitMessage, getRetryAfterSeconds } from "@/lib/rate-limit";
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
    await requestEmailVerification(parsed.data.email);
  } catch {
    // Delivery/storage failures must not reveal whether this account is eligible.
  }
  return { success: true, data: { retryAfterSeconds: 60 }, error: null };
}
