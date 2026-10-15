import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { getAuthRedirect } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Sign in | Bearxus" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthShell title="Welcome back" description="Sign in to your Bearxus workspace.">
      <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading sign-in…</p>}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignInContent({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  const oauthError = typeof params.error === "string"
    ? params.error === "OAuthAccountNotLinked"
      ? "This email uses a different sign-in method. Sign in with the method you used before."
      : "Unable to sign in. Please try again or choose another sign-in method."
    : undefined;

  return <SignInForm callbackUrl={getAuthRedirect(params.callbackUrl)} oauthError={oauthError} registered={params.registered === "1"} />;
}
