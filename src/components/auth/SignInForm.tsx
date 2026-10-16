"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { signInWithCredentials, signInWithGitHub } from "@/actions/auth";
import { AuthField } from "@/components/auth/AuthField";
import type { AuthFormState } from "@/types/auth";

interface SignInFormProps {
  callbackUrl: string;
  oauthError?: string;
  verified: boolean;
  registered: boolean;
  verificationRequired: boolean;
}

const initialState: AuthFormState = { success: false, data: null, error: null };

export function SignInForm({ callbackUrl, oauthError, verified, registered, verificationRequired }: SignInFormProps) {
  const [state, action, pending] = useActionState(signInWithCredentials, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) alertRef.current?.focus();
  }, [state]);

  return (
    <div className="space-y-6">
      {verified ? <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm leading-6">Email verified. Sign in to your workspace.</p> : null}
      {registered && !verified ? <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm leading-6">Account created. Sign in to your workspace.</p> : null}
      <form action={action} className="space-y-5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <AuthField name="email" label="Email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} error={state.fieldErrors?.email} />
        <AuthField name="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} error={state.fieldErrors?.password} />
        {state.error || oauthError ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">{state.error || oauthError}</p> : null}
        <button type="submit" disabled={pending} className="auth-primary-button">{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      {verificationRequired ? <p className="text-center text-sm text-muted-foreground"><Link href="/verify-email" className="auth-link">{state.requiresEmailVerification ? "Request a new verification link" : "Need to verify your email?"}</Link></p> : null}
      <div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <GitHubButton />
      </form>
      <p className="text-center text-sm text-muted-foreground">New to Bearxus? <Link href="/register" className="auth-link">Create an account</Link></p>
    </div>
  );
}

function GitHubButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-60">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.76-.24.76-.54v-2.09c-3.12.68-3.78-1.32-3.78-1.32-.51-1.3-1.24-1.65-1.24-1.65-1.02-.7.08-.68.08-.68 1.12.08 1.72 1.15 1.72 1.15 1 1.72 2.62 1.22 3.26.93.1-.73.4-1.22.71-1.5-2.49-.28-5.1-1.24-5.1-5.54 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.13-1.45 3.07-1.15 3.07-1.15.61 1.53.23 2.67.12 2.95.71.78 1.14 1.78 1.14 3 0 4.31-2.62 5.25-5.12 5.53.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" /></svg>
      {pending ? "Connecting to GitHub…" : "Sign in with GitHub"}
    </button>
  );
}
