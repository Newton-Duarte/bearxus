"use server";

import { verificationEmailSchema } from "@/lib/auth-validation";
import { requestEmailVerification } from "@/lib/email-verification";
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

  try {
    await requestEmailVerification(parsed.data.email);
  } catch {
    // Delivery/storage failures must not reveal whether this account is eligible.
  }
  return { success: true, data: { retryAfterSeconds: 60 }, error: null };
}
