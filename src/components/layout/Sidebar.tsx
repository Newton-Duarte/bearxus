import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { UserMenu } from "@/components/user/UserMenu";
import type { AccountUser } from "@/types/auth";

interface SidebarProps {
  user: AccountUser;
}

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside aria-label="Workspace sidebar" className="flex w-full shrink-0 flex-col border-b border-border bg-background p-4 md:sticky md:top-0 md:h-svh md:w-64 md:border-r md:border-b-0">
      <Link href="/dashboard" className="mx-2 my-2 inline-flex w-fit items-center gap-2.5 rounded-sm text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">b</span>
        <Text as="span" variant="large" className="tracking-tight">bearxus</Text><Text as="span" variant="large" className="-ml-2 text-primary">.</Text>
      </Link>
      <nav aria-label="Workspace" className="mt-6 flex-1 md:mt-10">
        <Link href="/dashboard" aria-current="page" className="flex min-h-11 items-center gap-3 rounded-lg bg-primary/10 px-3 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4"><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="12" y="3" width="5" height="5" rx="1" /><rect x="3" y="12" width="5" height="5" rx="1" /><rect x="12" y="12" width="5" height="5" rx="1" /></svg>
          <Text as="span" variant="small" className="text-primary">Dashboard</Text>
        </Link>
      </nav>
      <div className="mt-6 pt-3"><Separator className="mb-3" /><UserMenu user={user} /></div>
    </aside>
  );
}
