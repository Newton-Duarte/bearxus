import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";

export default function DashboardPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p className="mt-2">Checking your session…</p>}>
        <DashboardSession />
      </Suspense>
    </main>
  );
}

async function DashboardSession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdashboard");
  }

  return <p className="mt-2">User ID: {session.user.id}</p>;
}
