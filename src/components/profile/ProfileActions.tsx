"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { changePassword, deleteAccount } from "@/actions/profile";
import { AuthField } from "@/components/auth/AuthField";
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
  const passwordDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const passwordTitleId = useId();
  const deleteTitleId = useId();

  useEffect(() => {
    const dialog = passwordDialogRef.current;
    if (passwordOpen && dialog && !dialog.open) dialog.showModal();
    if (!passwordOpen && dialog?.open) dialog.close();
  }, [passwordOpen]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (deleteOpen && dialog && !dialog.open) dialog.showModal();
    if (!deleteOpen && dialog?.open) dialog.close();
  }, [deleteOpen]);

  useEffect(() => {
    if (passwordOpen) {
      passwordDialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }
  }, [passwordOpen]);

  useEffect(() => {
    if (passwordState.error) alertRef.current?.focus();
  }, [passwordState.error]);

  useEffect(() => {
    if (deleteOpen) deleteDialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [deleteOpen]);

  function closePasswordDialog() {
    setPasswordOpen(false);
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h3 className="font-medium">Password</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            {canChangePassword
              ? "Update the password you use to sign in with your email."
              : "Your password is managed by your OAuth provider."}
          </p>
          {passwordState.success ? (
            <p role="status" className="mt-3 text-sm text-primary">Password updated.</p>
          ) : null}
        </div>
        {canChangePassword ? (
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="min-h-11 shrink-0 rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Change password
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h3 className="font-medium text-destructive">Delete account</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Permanently remove your profile and all workspace data. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="min-h-11 shrink-0 rounded-lg border border-destructive/50 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Delete account
        </button>
      </div>

      {canChangePassword && passwordOpen ? (
        <dialog
          ref={passwordDialogRef}
          aria-labelledby={passwordTitleId}
          onCancel={(event) => {
            event.preventDefault();
            closePasswordDialog();
          }}
          className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg overscroll-contain rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/70"
        >
          <div className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={passwordTitleId} className="text-xl font-semibold tracking-tight">Change password</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Use a password of at least 8 characters.</p>
              </div>
              <button
                type="button"
                aria-label="Close change password dialog"
                onClick={closePasswordDialog}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span aria-hidden="true" className="text-xl leading-none">×</span>
              </button>
            </div>
            <form action={passwordAction} className="mt-6 space-y-5">
              {passwordState.error ? (
                <p ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">{passwordState.error}</p>
              ) : null}
              <AuthField
                name="currentPassword"
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                error={passwordState.fieldErrors?.currentPassword}
              />
              <AuthField
                name="password"
                label="New password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                error={passwordState.fieldErrors?.password}
              />
              <AuthField
                name="confirmPassword"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                error={passwordState.fieldErrors?.confirmPassword}
              />
              {passwordState.success ? (
                <p role="status" aria-live="polite" className="text-sm text-primary">Password updated. You can close this dialog.</p>
              ) : null}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closePasswordDialog}
                  className="min-h-11 rounded-lg px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Cancel
                </button>
                <PasswordSubmitButton />
              </div>
            </form>
          </div>
        </dialog>
      ) : null}

      {deleteOpen ? (
        <dialog
          ref={deleteDialogRef}
          aria-labelledby={deleteTitleId}
          onCancel={(event) => {
            event.preventDefault();
            setDeleteOpen(false);
          }}
          className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg overscroll-contain rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/70"
        >
          <div className="p-6 sm:p-7">
            <h2 id={deleteTitleId} className="text-xl font-semibold tracking-tight">Delete your account?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This permanently deletes your profile, notes, projects, tasks, resources, and transactions. There is no undo.
            </p>
            <form action={deleteAccount} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="min-h-11 rounded-lg px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Keep account
              </button>
              <DeleteSubmitButton />
            </form>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

function PasswordSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-lg bg-destructive px-4 text-sm font-semibold text-background hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete permanently"}
    </button>
  );
}
