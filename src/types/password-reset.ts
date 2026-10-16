export interface PasswordResetSendResult {
  status: "sent" | "cooldown" | "ineligible" | "failed";
  retryAfterSeconds: number;
}

export type PasswordResetResult = "reset" | "invalid";

export interface PasswordResetRequestState {
  success: boolean;
  data: { retryAfterSeconds: number } | null;
  error: string | null;
  fieldErrors?: { email?: string };
}

export interface PasswordResetFormState {
  success: boolean;
  data: null;
  error: string | null;
  fieldErrors?: { token?: string; password?: string; confirmPassword?: string };
}
