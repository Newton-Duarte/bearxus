"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { resendVerificationEmail } from "@/actions/email-verification";
import { AuthField } from "@/components/auth/AuthField";
import type { VerificationFormState } from "@/types/email-verification";

const initialState: VerificationFormState = { success: false, data: null, error: null };

export function VerificationForm() {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const submitting = useRef(false);
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) alertRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || secondsLeft > 0) return;
    submitting.current = true;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await resendVerificationEmail(initialState, formData);
        setState(result);
        setSecondsLeft(result.data?.retryAfterSeconds ?? 0);
      } catch {
        setState({ success: false, data: null, error: "Unable to send. Check your connection and try again." });
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <AuthField name="email" label="Email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" error={state.fieldErrors?.email} />
      {state.error ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm leading-6 text-muted-foreground">If this email belongs to an unverified password account, check your inbox for a verification link. Check spam too, or wait a minute before requesting another.</p> : null}
      <button type="submit" disabled={pending || secondsLeft > 0} className="auth-primary-button">{pending ? "Sending…" : secondsLeft > 0 ? `Try again in ${secondsLeft}s` : "Send verification email"}</button>
      <p className="text-center text-sm text-muted-foreground">Already verified? <Link href="/sign-in" className="auth-link">Sign in</Link></p>
    </form>
  );
}
