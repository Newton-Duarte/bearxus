"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import { signOutUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/text";
import { UserAvatar } from "@/components/user/UserAvatar";
import type { AccountUser } from "@/types/auth";

interface UserMenuProps {
  user: AccountUser;
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="min-h-16 w-full justify-start gap-3 p-2 text-left" />}
        aria-label={`Account menu for ${user.name?.trim() || user.email || "your account"}`}
      >
        <UserAvatar name={user.name} image={user.image} />
        <span className="min-w-0 flex-1">
          <Text as="span" variant="small" className="block truncate text-left">{user.name?.trim() || "Your account"}</Text>
          <Text as="span" variant="muted" className="mt-0.5 block truncate text-left text-xs">{user.email || "Personal workspace"}</Text>
        </span>
        <span aria-hidden="true" className="size-4 shrink-0 text-muted-foreground">⌄</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--anchor-width)">
        <DropdownMenuItem render={<Link href="/profile" prefetch={false} className="min-h-11" />}>Profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" prefetch={false} className="min-h-11" />}>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutUser}>
          <SignOutButton />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <DropdownMenuItem
      variant="destructive"
      nativeButton
      render={<Button type="submit" variant="ghost" className="min-h-11 w-full justify-start text-left" />}
      disabled={pending}
    >
      {pending ? "Signing out…" : "Sign out"}
    </DropdownMenuItem>
  );
}
