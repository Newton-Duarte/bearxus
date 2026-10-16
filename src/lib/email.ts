import "server-only";

import { Resend } from "resend";

export async function sendVerificationEmail(email: string, verificationUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Verification email is not configured.");

  const safeUrl = verificationUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;");
  const { data, error } = await new Resend(apiKey).emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: "Verify your email for Bearxus",
    text: `Verify your email to sign in to Bearxus:\n\n${verificationUrl}\n\nThis link expires in 24 hours and can only be used once. If you did not request this, ignore this email.`,
    html: `<h1>Verify your email</h1><p>Confirm your email to sign in to Bearxus.</p><p><a href="${safeUrl}">Verify email</a></p><p>This link expires in 24 hours and can only be used once.</p><p>If you did not request this, ignore this email.</p>`,
  }, { signal: AbortSignal.timeout(10_000) });

  if (error || !data?.id) throw new Error("Unable to send verification email.");
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Password reset email is not configured.");

  const safeUrl = resetUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;");
  const { data, error } = await new Resend(apiKey).emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: "Reset your Bearxus password",
    text: `Reset your Bearxus password:\n\n${resetUrl}\n\nThis link expires in 24 hours and can only be used once. If you did not request this, ignore this email.`,
    html: `<h1>Reset your password</h1><p>Use the link below to choose a new Bearxus password.</p><p><a href="${safeUrl}">Reset password</a></p><p>This link expires in 24 hours and can only be used once.</p><p>If you did not request this, ignore this email.</p>`,
  }, { signal: AbortSignal.timeout(10_000) });

  if (error || !data?.id) throw new Error("Unable to send password reset email.");
}
