"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { signInWithCredentials, signInWithGitHub } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Text } from "@/components/ui/text";
import type { AuthFormState } from "@/types/auth";

interface SignInFormProps {
  callbackUrl: string;
  oauthError?: string;
  verified: boolean;
  registered: boolean;
  passwordReset: boolean;
  verificationRequired: boolean;
}

const initialState: AuthFormState = { success: false, data: null, error: null };

export function SignInForm({ callbackUrl, oauthError, verified, registered, passwordReset, verificationRequired }: SignInFormProps) {
  const [state, action, pending] = useActionState(signInWithCredentials, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) alertRef.current?.focus();
  }, [state]);

  return (
    <div className="space-y-6">
      {verified ? <Text as="p" variant="small" role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 leading-6">Email verified. Sign in to your workspace.</Text> : null}
      {registered && !verified ? <Text as="p" variant="small" role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 leading-6">Account created. Sign in to your workspace.</Text> : null}
      {passwordReset ? <Text as="p" variant="small" role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 leading-6">Your password was reset. Sign in with your new password.</Text> : null}
      <form action={action} className="space-y-5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <TextField name="email" label="Email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} error={state.fieldErrors?.email} />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} error={state.fieldErrors?.password} />
        <div className="-mt-2 flex justify-end"><Link href="/forgot-password" className="rounded-sm font-medium text-foreground text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Forgot password?</Link></div>
        {state.error || oauthError ? <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"><Text as="span" variant="small" className="leading-6 text-destructive">{state.error || oauthError}</Text></p> : null}
        <Button type="submit" disabled={pending} className="h-11 w-full">{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      {verificationRequired ? <Text as="p" variant="muted" className="text-center"><Link href="/verify-email" className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{state.requiresEmailVerification ? "Request a new verification link" : "Need to verify your email?"}</Link></Text> : null}
      <div className="flex items-center gap-4"><span className="h-px flex-1 bg-border" /><Text as="span" variant="muted" className="text-xs">or</Text><span className="h-px flex-1 bg-border" /></div>
      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <GitHubButton />
      </form>
      <Text as="p" variant="muted" className="text-center">New to Bearxus? <Link href="/register" className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Create an account</Link></Text>
    </div>
  );
}

function GitHubButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="h-11 w-full gap-2.5">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.76-.24.76-.54v-2.09c-3.12.68-3.78-1.32-3.78-1.32-.51-1.3-1.24-1.65-1.24-1.65-1.02-.7.08-.68.08-.68 1.12.08 1.72 1.15 1.72 1.15 1 1.72 2.62 1.22 3.26.93.1-.73.4-1.22.71-1.5-2.49-.28-5.1-1.24-5.1-5.54 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.13-1.45 3.07-1.15 3.07-1.15.61 1.53.23 2.67.12 2.95.71.78 1.14 1.78 1.14 3 0 4.31-2.62 5.25-5.12 5.53.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" /></svg>
      {pending ? "Connecting to GitHub…" : "Sign in with GitHub"}
    </Button>
  );
}
