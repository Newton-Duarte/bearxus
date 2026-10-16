import "server-only";

export function isEmailVerificationEnabled(): boolean {
  // Only an explicit opt-out disables verification; missing/invalid values stay safe.
  return process.env.EMAIL_VERIFICATION_ENABLED !== "false";
}
