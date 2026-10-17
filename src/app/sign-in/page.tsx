import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { Text } from "@/components/ui/text";
import { getAuthRedirect } from "@/lib/auth-redirect";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";

export const metadata: Metadata = { title: "Sign in | Bearxus" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthShell title="Welcome back" description="Sign in to your Bearxus workspace.">
      <Suspense fallback={<Text as="p" variant="muted" role="status">Loading sign-in…</Text>}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignInContent({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  const verificationRequired = isEmailVerificationEnabled();
  const oauthError = verificationRequired && params.error === "CredentialsSignin" && params.code === "email_not_verified"
    ? "Verify your email before signing in. You can request a new verification link."
    : typeof params.error === "string"
    ? params.error === "OAuthAccountNotLinked"
      ? "This email uses a different sign-in method. Sign in with the method you used before."
      : "Unable to sign in. Please try again or choose another sign-in method."
    : undefined;

  return <SignInForm callbackUrl={getAuthRedirect(params.callbackUrl)} oauthError={oauthError} verified={params.verified === "1"} registered={params.registered === "1"} passwordReset={params.reset === "1"} verificationRequired={verificationRequired} />;
}
