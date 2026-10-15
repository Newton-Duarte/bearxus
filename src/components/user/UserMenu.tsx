"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { signOutUser } from "@/actions/auth";
import { UserAvatar } from "@/components/user/UserAvatar";
import type { AccountUser } from "@/types/auth";

interface UserMenuProps {
  user: AccountUser;
}

const itemClassName = "flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={event => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }}>
      <button ref={triggerRef} type="button" aria-label={`Account menu for ${user.name?.trim() || user.email || "your account"}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} className="flex min-h-16 w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <UserAvatar name={user.name} image={user.image} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name?.trim() || "Your account"}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{user.email || "Personal workspace"}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={`size-4 shrink-0 text-muted-foreground ${open ? "rotate-180" : ""}`}><path d="m6 12 4-4 4 4" /></svg>
      </button>
      <nav id={panelId} aria-label="Account" hidden={!open} className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-xl border border-border bg-card p-1.5 shadow-xl shadow-black/30">
        <Link href="/profile" prefetch={false} className={itemClassName}>Profile</Link>
        <Link href="/settings" prefetch={false} className={itemClassName}>Settings</Link>
        <div className="mx-2 my-1 h-px bg-border" />
        <form action={signOutUser}><SignOutButton /></form>
      </nav>
    </div>
  );
}

function SignOutButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`${itemClassName} text-destructive disabled:opacity-60`}>{pending ? "Signing out…" : "Sign out"}</button>;
}
