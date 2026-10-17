"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import type { PasswordResetRequestState } from "@/types/password-reset";

const initialState: PasswordResetRequestState = { success: false, data: null, error: null };
const responseSchema = z.object({
  success: z.boolean(),
  data: z.object({ retryAfterSeconds: z.number() }).nullable(),
  error: z.string().nullable(),
});
const rateLimitResponseSchema = z.object({ error: z.string() });

export function ForgotPasswordForm() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) alertRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || secondsLeft > 0) return;

    setPending(true);
    setState(initialState);
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });
      const body: unknown = await response.json();
      if (response.status === 429) {
        const result = rateLimitResponseSchema.safeParse(body);
        const retryAfterSeconds = Number(response.headers.get("Retry-After")) || 60;
        setSecondsLeft(retryAfterSeconds);
        setState({ success: false, data: { retryAfterSeconds }, error: result.success ? result.data.error : "Too many attempts. Please try again later." });
      } else {
        const result = responseSchema.safeParse(body);
        if (!result.success) throw new Error("Invalid response");
        setSecondsLeft(result.data.data?.retryAfterSeconds ?? 0);
        setState(result.data);
      }
    } catch {
      setState({ success: false, data: null, error: "Unable to send. Check your connection and try again." });
    }
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <AuthField name="email" label="Email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" error={state.fieldErrors?.email} />
      {state.error ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm leading-6">If an account exists for that email, check your inbox and spam folder for a password reset link.</p> : null}
      <Button type="submit" disabled={pending || secondsLeft > 0} className="h-11 w-full">{pending ? "Sending…" : secondsLeft > 0 ? `Try again in ${secondsLeft}s` : "Send reset link"}</Button>
      <p className="text-center text-sm text-muted-foreground">Remembered your password? <Link href="/sign-in" className="auth-link">Sign in</Link></p>
    </form>
  );
}
