"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { requestPasswordReset } from "@/actions/password-reset";
import { AuthField } from "@/components/auth/AuthField";
import type { PasswordResetRequestState } from "@/types/password-reset";

const initialState: PasswordResetRequestState = { success: false, data: null, error: null };

export function ForgotPasswordForm() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [state, action, pending] = useActionState(async (previous: PasswordResetRequestState, formData: FormData) => {
    const result = await requestPasswordReset(previous, formData);
    setSecondsLeft(result.data?.retryAfterSeconds ?? 0);
    return result;
  }, initialState);
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) alertRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <form action={action} noValidate className="space-y-5">
      <AuthField name="email" label="Email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" error={state.fieldErrors?.email} />
      {state.error ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm leading-6">If an account exists for that email, check your inbox and spam folder for a password reset link.</p> : null}
      <button type="submit" disabled={pending || secondsLeft > 0} className="auth-primary-button">{pending ? "Sending…" : secondsLeft > 0 ? `Try again in ${secondsLeft}s` : "Send reset link"}</button>
      <p className="text-center text-sm text-muted-foreground">Remembered your password? <Link href="/sign-in" className="auth-link">Sign in</Link></p>
    </form>
  );
}
