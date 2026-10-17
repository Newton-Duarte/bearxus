"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import type { PasswordResetFormState } from "@/types/password-reset";

const initialState: PasswordResetFormState = { success: false, data: null, error: null };
const responseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
  error: z.string().nullable(),
  fieldErrors: z.object({ token: z.string().optional(), password: z.string().optional(), confirmPassword: z.string().optional() }).optional(),
});
const rateLimitResponseSchema = z.object({ error: z.string() });

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (state.error) alertRef.current?.focus();
    if (state.success) router.replace("/sign-in?reset=1");
  }, [router, state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setState(initialState);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: formData.get("token"),
          password: formData.get("password"),
          confirmPassword: formData.get("confirmPassword"),
        }),
      });
      const body: unknown = await response.json();
      if (response.status === 429) {
        const result = rateLimitResponseSchema.safeParse(body);
        setState({ success: false, data: null, error: result.success ? result.data.error : "Too many attempts. Please try again later." });
      } else {
        const result = responseSchema.safeParse(body);
        if (!result.success) throw new Error("Invalid response");
        setState(result.data);
      }
    } catch {
      setState({ success: false, data: null, error: "Unable to reset your password right now. Please try again." });
    }
    setPending(false);
  }

  if (!token) {
    return (
      <div className="space-y-5">
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive">This password reset link is invalid, expired, or already used.</p>
        <p className="text-center text-sm text-muted-foreground"><Link href="/forgot-password" className="auth-link">Request a new reset link</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <AuthField name="password" label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters, up to 72 UTF-8 bytes." error={state.fieldErrors?.password} />
      <AuthField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirmPassword} />
      {state.error ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="h-11 w-full">{pending ? "Updating password…" : "Set new password"}</Button>
      <p className="text-center text-sm text-muted-foreground"><Link href="/sign-in" className="auth-link">Back to sign in</Link></p>
    </form>
  );
}
