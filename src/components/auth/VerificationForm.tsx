"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Text } from "@/components/ui/text";
import type { VerificationFormState } from "@/types/email-verification";

const initialState: VerificationFormState = { success: false, data: null, error: null };
const responseSchema = z.object({
  success: z.boolean(),
  data: z.object({ retryAfterSeconds: z.number() }).nullable(),
  error: z.string().nullable(),
});
const rateLimitResponseSchema = z.object({ error: z.string() });

export function VerificationForm() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
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
    setPending(true);
    const formData = new FormData(event.currentTarget);
    void (async () => {
      try {
        const response = await fetch("/api/auth/resend-verification", {
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
          setState(result.data);
          setSecondsLeft(result.data.data?.retryAfterSeconds ?? 0);
        }
      } catch {
        setState({ success: false, data: null, error: "Unable to send. Check your connection and try again." });
      } finally {
        submitting.current = false;
        setPending(false);
      }
    })();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
       <TextField name="email" label="Email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" error={state.fieldErrors?.email} />
       {state.error ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"><Text as="span" variant="small" className="leading-6 text-destructive">{state.error}</Text></p> : null}
       {state.success ? <Text as="p" variant="muted" role="status" className="leading-6">If this email belongs to an unverified password account, check your inbox for a verification link. Check spam too, or wait a minute before requesting another.</Text> : null}
       <Button type="submit" disabled={pending || secondsLeft > 0} className="h-11 w-full">{pending ? "Sending…" : secondsLeft > 0 ? `Try again in ${secondsLeft}s` : "Send verification email"}</Button>
       <Text as="p" variant="muted" className="text-center">Already verified? <Link href="/sign-in" className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Sign in</Link></Text>
    </form>
  );
}
