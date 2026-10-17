"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { registrationSchema } from "@/lib/auth-validation";
import type { AuthFormState } from "@/types/auth";

const responseSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), data: z.object({ id: z.string(), name: z.string().nullable(), email: z.string(), verificationEmailSent: z.boolean(), verificationRequired: z.boolean() }), error: z.null() }),
  z.object({ success: z.literal(false), data: z.null(), error: z.string() }),
]);
const rateLimitResponseSchema = z.object({ error: z.string() });

export function RegisterForm() {
  const router = useRouter();
  const [state, setState] = useState<AuthFormState>({ success: false, data: null, error: null });
  const [pending, setPending] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const submitting = useRef(false);
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) alertRef.current?.focus();
  }, [state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || navigating) return;
    const parsed = registrationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      const fieldErrors: AuthFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "name" || field === "email" || field === "password" || field === "confirmPassword") fieldErrors[field] ??= issue.message;
      }
      setState({ success: false, data: null, error: "Check the highlighted fields and try again.", fieldErrors });
      return;
    }

    submitting.current = true;
    setPending(true);
    setState({ success: false, data: null, error: null });
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body: unknown = await response.json();
      const result = responseSchema.safeParse(body);
      if (response.status === 201 && result.success && result.data.success) {
        submitting.current = false;
        setPending(false);
        const status = result.data.data.verificationEmailSent ? "sent" : "delivery-failed";
        const destination = result.data.data.verificationRequired
          ? `/verify-email?status=${status}` : "/sign-in?registered=1";
        startNavigation(() => router.push(destination));
        return;
      }
      const rateLimit = rateLimitResponseSchema.safeParse(body);
      const error = result.success && !result.data.success
        ? result.data.error
        : rateLimit.success
          ? rateLimit.data.error
          : "Unable to register. Please try again.";
      setState({ success: false, data: null, error });
    } catch {
      setState({ success: false, data: null, error: "Unable to register. Check your connection and try again." });
    }
    submitting.current = false;
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <AuthField name="name" label="Name" autoComplete="name" required maxLength={100} placeholder="Your name" error={state.fieldErrors?.name} />
      <AuthField name="email" label="Email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" error={state.fieldErrors?.email} />
      <AuthField name="password" label="Password" type="password" autoComplete="new-password" required hint="At least 8 characters, up to 72 UTF-8 bytes." error={state.fieldErrors?.password} />
      <AuthField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirmPassword} />
      {state.error ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">{state.error}</p> : null}
      <Button type="submit" disabled={pending || navigating} className="h-11 w-full">{pending || navigating ? "Creating account…" : "Create account"}</Button>
      <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/sign-in" className="auth-link">Sign in</Link></p>
    </form>
  );
}
