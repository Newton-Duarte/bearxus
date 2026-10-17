import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Text } from "@/components/ui/text";

export default function DashboardPage() {
  return (
    <div className="min-h-svh bg-background font-sans text-foreground">
        <Suspense fallback={<Text as="p" variant="muted" role="status" className="p-6">Checking your session…</Text>}>
        <DashboardSession />
      </Suspense>
    </div>
  );
}

async function DashboardSession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=%2Fdashboard");
  }

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  };

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 px-6 py-10 sm:px-10 md:py-12">
        <Text as="h1" variant="large" className="text-2xl tracking-tight">Dashboard</Text>
        <Text as="p" variant="muted" className="mt-3 leading-6 wrap-anywhere">Welcome to your workspace{user.name?.trim() ? `, ${user.name.trim()}` : ""}.</Text>
        <Text as="p" variant="muted" className="mt-10 border-t border-border pt-6 font-mono text-xs break-all">User ID: {session.user.id}</Text>
      </main>
    </div>
  );
}
