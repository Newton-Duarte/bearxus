"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { completePasswordReset } from "@/actions/password-reset";
import { AuthField } from "@/components/auth/AuthField";
import type { PasswordResetFormState } from "@/types/password-reset";

const initialState: PasswordResetFormState = { success: false, data: null, error: null };

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(completePasswordReset, initialState);
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

  if (!token) {
    return (
      <div className="space-y-5">
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive">This password reset link is invalid, expired, or already used.</p>
        <p className="text-center text-sm text-muted-foreground"><Link href="/forgot-password" className="auth-link">Request a new reset link</Link></p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <AuthField name="password" label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters, up to 72 UTF-8 bytes." error={state.fieldErrors?.password} />
      <AuthField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirmPassword} />
      {state.error ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="auth-primary-button">{pending ? "Updating password…" : "Set new password"}</button>
      <p className="text-center text-sm text-muted-foreground"><Link href="/sign-in" className="auth-link">Back to sign in</Link></p>
    </form>
  );
}
