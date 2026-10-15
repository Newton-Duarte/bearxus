import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Create an account | Bearxus" };

export default function RegisterPage() {
  return (
    <AuthShell title="Make room for your ideas" description="Create your account. Bring everything together.">
      <RegisterForm />
    </AuthShell>
  );
}
