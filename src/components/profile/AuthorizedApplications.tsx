"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { connectOAuthProvider, unlinkOAuthProvider } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "@/lib/oauth-providers";
import {
  initialUnlinkProviderState,
  type AuthorizedApplication,
} from "@/types/profile";

interface AuthorizedApplicationsProps {
  applications: AuthorizedApplication[];
  applicationError?: string | null;
}

export function AuthorizedApplications({ applications, applicationError }: AuthorizedApplicationsProps) {
  return (
    <section aria-labelledby="authorized-applications-heading" className="mt-10">
      <div>
        <Text as="h2" variant="large" id="authorized-applications-heading" className="text-lg tracking-tight">
          Authorized applications
        </Text>
        <Text as="p" variant="muted" className="mt-1">OAuth applications you&apos;ve approved</Text>
      </div>

      {applicationError ? (
        <p role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 outline-none">
          <Text as="span" variant="small" className="leading-6 text-destructive">{applicationError}</Text>
        </p>
      ) : null}

      <Card className="mt-5 gap-0 divide-y divide-border py-0">
        {applications.length > 0 ? applications.map(application => (
          <AuthorizedApplicationRow key={application.provider} application={application} />
        )) : (
          <CardContent className="p-5 sm:p-6">
            <Text as="p" variant="muted">No applications have been authorized to connect with your account.</Text>
          </CardContent>
        )}
      </Card>
    </section>
  );
}

function AuthorizedApplicationRow({ application }: { application: AuthorizedApplication }) {
  const providerName = OAUTH_PROVIDERS[application.provider].name;
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [unlinkState, unlinkAction] = useActionState(
    unlinkOAuthProvider.bind(null, application.provider),
    initialUnlinkProviderState,
  );
  const router = useRouter();

  useEffect(() => {
    if (unlinkState.success) router.refresh();
  }, [router, unlinkState.success]);

  return (
    <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
          <ProviderMark provider={application.provider} />
        </div>
        <div className="min-w-0">
          <Text as="h3" variant="large" className="font-medium">{providerName}</Text>
          <Text as="p" variant="muted" className="mt-1">
            {application.connected ? (
              <><span className="font-medium text-primary">Connected</span> to your Bearxus account.</>
            ) : `Not connected to your account.`}
          </Text>
        </div>
      </div>

      {application.connected ? (
        application.canDisconnect ? (
          <Dialog open={disconnectOpen && application.connected} onOpenChange={setDisconnectOpen}>
            <DialogTrigger render={<Button variant="outline" className="min-h-11 sm:shrink-0" />}>Disconnect {providerName}</DialogTrigger>
            <DialogContent className="max-w-lg overscroll-contain">
              <DialogHeader>
                <DialogTitle>Disconnect {providerName}?</DialogTitle>
                <DialogDescription>
                  {providerName} will no longer be connected to your Bearxus account or available as a sign-in method.
                </DialogDescription>
              </DialogHeader>
              <form action={unlinkAction}>
                {unlinkState.error ? (
                  <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 outline-none">
                    <Text as="span" variant="small" className="leading-6 text-destructive">{unlinkState.error}</Text>
                  </p>
                ) : null}
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="ghost" className="min-h-11" />}>Cancel</DialogClose>
                  <DisconnectSubmitButton providerName={providerName} />
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <Text as="p" variant="muted" className="max-w-xs text-left text-xs sm:text-right">
            Add a password or another provider before disconnecting {providerName}.
          </Text>
        )
      ) : (
        <form action={connectOAuthProvider.bind(null, application.provider)}>
          <ConnectProviderButton providerName={providerName} />
        </form>
      )}
    </CardContent>
  );
}

function ConnectProviderButton({ providerName }: { providerName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="min-h-11 sm:shrink-0">
      {pending ? `Connecting to ${providerName}…` : `Connect ${providerName}`}
    </Button>
  );
}

function DisconnectSubmitButton({ providerName }: { providerName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending} className="min-h-11">
      {pending ? `Disconnecting…` : `Disconnect ${providerName}`}
    </Button>
  );
}

function ProviderMark({ provider }: { provider: OAuthProviderId }) {
  switch (provider) {
    case "github":
      return <GitHubMark />;
  }
}

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.76-.24.76-.54v-2.09c-3.12.68-3.78-1.32-3.78-1.32-.51-1.3-1.24-1.65-1.24-1.65-1.02-.7.08-.68.08-.68 1.12.08 1.72 1.15 1.72 1.15 1 1.72 2.62 1.22 3.26.93.1-.73.4-1.22.71-1.5-2.49-.28-5.1-1.24-5.1-5.54 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.13-1.45 3.07-1.15 3.07-1.15.61 1.53.23 2.67.12 2.95.71.78 1.14 1.78 1.14 3 0 4.31-2.62 5.25-5.12 5.53.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />
    </svg>
  );
}
