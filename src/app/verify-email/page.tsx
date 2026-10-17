import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { VerificationForm } from "@/components/auth/VerificationForm";
import { Text } from "@/components/ui/text";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";

export const metadata: Metadata = { title: "Verify your email | Bearxus", robots: { index: false, follow: false } };

export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <AuthShell title="Email verification" description="Manage email verification for your account.">
        <Suspense fallback={<Text as="p" variant="muted" role="status">Loading verification…</Text>}>
        <VerificationContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function VerificationContent({ searchParams }: Pick<PageProps<"/verify-email">, "searchParams">) {
  const { status } = await searchParams;
  if (!isEmailVerificationEnabled()) redirect("/sign-in");
  const notice = status === "sent"
    ? "Account created. Check your inbox and spam folder for a verification link."
    : status === "delivery-failed"
      ? "Account created, but we could not send the verification email. Request a new link below."
      : status === "invalid"
        ? "This verification link is invalid, expired, or already used. If you have not verified yet, request a new link below."
        : status === "error"
          ? "We could not verify your email right now. Try the link again or request a new one."
          : null;
  return (
    <div className="space-y-6">
      <Text as="p" variant="muted" className="leading-6">Open the link in your email before signing in. Links expire after 24 hours.</Text>
      {notice ? <Text as="p" variant="small" role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 leading-6">{notice}</Text> : null}
      <VerificationForm />
    </div>
  );
}
