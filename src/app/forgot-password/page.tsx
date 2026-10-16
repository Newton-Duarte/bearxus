import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password | Bearxus", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" description="Enter your email and we’ll send a secure password reset link.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
