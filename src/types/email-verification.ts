export interface VerificationSendResult {
  status: "sent" | "cooldown" | "ineligible" | "failed";
  retryAfterSeconds: number;
}

export type VerificationResult = "verified" | "invalid";

export interface VerificationFormState {
  success: boolean;
  data: { retryAfterSeconds: number } | null;
  error: string | null;
  fieldErrors?: { email?: string };
}
