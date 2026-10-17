import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { UserAvatar } from "@/components/user/UserAvatar";
import { getProfileData } from "@/lib/profile";

export const metadata = {
  title: "Profile · Bearxus",
};

export default function ProfilePage() {
  return (
    <div className="min-h-svh bg-background font-sans text-foreground">
        <Suspense fallback={<Text as="p" variant="muted" role="status" className="p-6">Checking your session…</Text>}>
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
          <header className="flex flex-col gap-6 pb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <UserAvatar
                name={profile.user.name}
                email={profile.user.email}
                image={profile.user.image}
                className="size-20 text-xl"
              />
              <div className="min-w-0">
                <Text as="p" variant="small" className="text-primary">Account profile</Text>
                <Text as="h1" variant="large" className="mt-1 truncate text-3xl tracking-tight">{accountName}</Text>
                <Text as="p" variant="muted" className="mt-2 wrap-anywhere">{profile.user.email}</Text>
                <Text as="p" variant="muted" className="mt-1 text-xs">Member since {joinedDate}</Text>
              </div>
            </div>
          </header>
          <Separator />

          <section aria-labelledby="activity-heading" className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Text as="h2" variant="large" id="activity-heading" className="text-lg tracking-tight">Workspace activity</Text>
                <Text as="p" variant="muted" className="mt-1">A quiet ledger of what you have built here.</Text>
              </div>
            </div>
            <Card className="mt-5 gap-0 py-0">
              <dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-5 sm:divide-y-0">
                {stats.map(([label, value]) => (
                  <div key={label} className="min-w-0 px-4 py-5 first:pl-5 sm:px-5 sm:py-6">
                    <Text as="dt" variant="muted">{label}</Text>
                    <Text as="dd" variant="large" className="mt-2 text-2xl tracking-tight">{value}</Text>
                  </div>
                ))}
              </dl>
            </Card>
          </section>

          <Separator className="mt-10" />
          <section aria-labelledby="security-heading" className="pt-8">
            <div>
              <Text as="h2" variant="large" id="security-heading" className="text-lg tracking-tight">Account security</Text>
              <Text as="p" variant="muted" className="mt-1">Manage how you sign in and protect your workspace.</Text>
            </div>
            <ProfileActions canChangePassword={profile.user.canChangePassword} />
          </section>
        </div>
      </main>
    </div>
  );
}
