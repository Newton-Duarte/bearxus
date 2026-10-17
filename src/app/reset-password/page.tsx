import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Text } from "@/components/ui/text";

export const metadata: Metadata = { title: "Reset password | Bearxus", referrer: "no-referrer", robots: { index: false, follow: false } };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthShell title="Choose a new password" description="Set a new password for your Bearxus workspace.">
        <Suspense fallback={<Text as="p" variant="muted" role="status">Loading password reset…</Text>}>
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ResetPasswordContent({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const params = await searchParams;
  const token = typeof params.token === "string" && /^[a-f0-9]{64}$/.test(params.token) ? params.token : "";
  return <ResetPasswordForm token={token} />;
}
