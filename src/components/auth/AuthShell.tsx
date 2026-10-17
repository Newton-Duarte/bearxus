import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  const titleId = `auth-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="flex min-h-svh flex-col bg-background font-sans text-foreground">
      <header className="px-6 py-7 sm:px-10">
        <Link href="/" className="inline-flex items-center gap-2.5 rounded-sm text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">b</span>
          bearxus<span className="-ml-2 text-primary">.</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16">
        <section aria-labelledby={titleId} className="w-full max-w-sm">
          <h1 id={titleId} className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </section>
      </main>
      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">Your private command center.</footer>
    </div>
  );
}
