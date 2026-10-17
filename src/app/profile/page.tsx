import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { UserAvatar } from "@/components/user/UserAvatar";
import { getProfileData } from "@/lib/profile";

export const metadata = {
  title: "Profile · Bearxus",
};

export default function ProfilePage() {
  return (
    <div className="min-h-svh bg-background font-sans text-foreground">
      <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Checking your session…</p>}>
        <ProfileSession />
      </Suspense>
    </div>
  );
}

async function ProfileSession() {
  await connection();
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=%2Fprofile");
  }

  const profile = await getProfileData(session.user.id);
  if (!profile) {
    redirect("/sign-in?callbackUrl=%2Fprofile");
  }

  const accountName = profile.user.name?.trim() || "Your account";
  const joinedDate = profile.user.createdAt.toISOString().slice(0, 10);
  const stats = [
    ["Notes", profile.stats.notes],
    ["Projects", profile.stats.projects],
    ["Tasks", profile.stats.tasks],
    ["Resources", profile.stats.resources],
    ["Transactions", profile.stats.transactions],
  ] as const;

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Sidebar user={profile.user} />
      <main className="min-w-0 flex-1 px-6 py-10 sm:px-10 md:py-12">
        <div className="mx-auto max-w-5xl">
          <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <UserAvatar
                name={profile.user.name}
                email={profile.user.email}
                image={profile.user.image}
                className="size-20 text-xl"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">Account profile</p>
                <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{accountName}</h1>
                <p className="mt-2 wrap-anywhere text-sm text-muted-foreground">{profile.user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">Member since {joinedDate}</p>
              </div>
            </div>
          </header>

          <section aria-labelledby="activity-heading" className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="activity-heading" className="text-lg font-semibold tracking-tight">Workspace activity</h2>
                <p className="mt-1 text-sm text-muted-foreground">A quiet ledger of what you have built here.</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-5 sm:divide-y-0">
              {stats.map(([label, value]) => (
                <div key={label} className="min-w-0 px-4 py-5 first:pl-5 sm:px-5 sm:py-6">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-2 text-2xl font-semibold tracking-tight">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="security-heading" className="mt-10 border-t border-border pt-8">
            <div>
              <h2 id="security-heading" className="text-lg font-semibold tracking-tight">Account security</h2>
              <p className="mt-1 text-sm text-muted-foreground">Manage how you sign in and protect your workspace.</p>
            </div>
            <ProfileActions canChangePassword={profile.user.canChangePassword} />
          </section>
        </div>
      </main>
    </div>
  );
}
