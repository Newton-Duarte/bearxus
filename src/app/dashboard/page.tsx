import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardPage() {
  return (
    <div className="workspace-theme min-h-svh bg-background font-sans text-foreground">
      <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Checking your session…</p>}>
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
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-3 text-sm leading-6 wrap-anywhere text-muted-foreground">Welcome to your workspace{user.name?.trim() ? `, ${user.name.trim()}` : ""}.</p>
        <p className="mt-10 border-t border-border pt-6 font-mono text-xs break-all text-muted-foreground">User ID: {session.user.id}</p>
      </main>
    </div>
  );
}
