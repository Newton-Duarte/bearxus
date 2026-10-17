"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { changePassword, deleteAccount } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { TextField } from "@/components/ui/text-field";
import { Text } from "@/components/ui/text";
import {
  initialChangePasswordState,
  type ChangePasswordState,
} from "@/types/profile";

interface ProfileActionsProps {
  canChangePassword: boolean;
}

export function ProfileActions({ canChangePassword }: ProfileActionsProps) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, passwordAction] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    initialChangePasswordState,
  );
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (passwordState.error) alertRef.current?.focus();
  }, [passwordState.error]);

  function closePasswordDialog() {
    setPasswordOpen(false);
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <Card className="mt-6 divide-y divide-border gap-0 py-0">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <Text as="h3" variant="large" className="font-medium">Password</Text>
          <Text as="p" variant="muted" className="mt-1 max-w-xl leading-6">
            {canChangePassword
              ? "Update the password you use to sign in with your email."
              : "Your password is managed by your OAuth provider."}
          </Text>
          {passwordState.success ? (
            <Text as="p" variant="small" role="status" className="mt-3 text-primary">Password updated.</Text>
          ) : null}
        </div>
        {canChangePassword ? (
          <Dialog
            open={passwordOpen}
            onOpenChange={open => open ? setPasswordOpen(true) : closePasswordDialog()}
          >
            <DialogTrigger render={<Button variant="outline" className="min-h-11 shrink-0" />}>Change password</DialogTrigger>
            <DialogContent className="max-w-lg overscroll-contain">
              <DialogHeader>
                <DialogTitle>Change password</DialogTitle>
                <DialogDescription>Use a password of at least 8 characters.</DialogDescription>
              </DialogHeader>
              <form action={passwordAction} className="space-y-5">
                {passwordState.error ? (
                  <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"><Text as="span" variant="small" className="leading-6 text-destructive">{passwordState.error}</Text></p>
                ) : null}
                <TextField
                  name="currentPassword"
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                  error={passwordState.fieldErrors?.currentPassword}
                />
                <TextField
                  name="password"
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  error={passwordState.fieldErrors?.password}
                />
                <TextField
                  name="confirmPassword"
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  error={passwordState.fieldErrors?.confirmPassword}
                />
                {passwordState.success ? (
                  <Text as="p" variant="small" role="status" aria-live="polite" className="text-primary">Password updated. You can close this dialog.</Text>
                ) : null}
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="ghost" className="min-h-11" />}>Cancel</DialogClose>
                  <PasswordSubmitButton />
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardContent>

      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <Text as="h3" variant="large" className="font-medium text-destructive">Delete account</Text>
          <Text as="p" variant="muted" className="mt-1 max-w-xl leading-6">
            Permanently remove your profile and all workspace data. This cannot be undone.
          </Text>
        </div>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger render={<Button variant="destructive" className="min-h-11 shrink-0" />}>Delete account</DialogTrigger>
          <DialogContent className="max-w-lg overscroll-contain">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>This permanently deletes your profile, notes, projects, tasks, resources, and transactions. There is no undo.</DialogDescription>
            </DialogHeader>
            <form action={deleteAccount}>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="ghost" className="min-h-11" />}>Keep account</DialogClose>
                <DeleteSubmitButton />
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function PasswordSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="min-h-11"
    >
      {pending ? "Updating…" : "Update password"}
    </Button>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      className="min-h-11"
    >
      {pending ? "Deleting…" : "Delete permanently"}
    </Button>
  );
}
