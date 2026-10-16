# Email Verification on Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require verified email ownership for new and existing email/password accounts, with Resend delivery and a recoverable resend flow.

**Architecture:** Keep NextAuth credentials, GitHub OAuth, JWT sessions, and the existing `users.emailVerified` field. Add a purpose-specific verification table, separate from the Auth.js adapter's verification tokens, and server-only helpers for issuing and atomically consuming hashed tokens. Connect the existing registration API and auth pages to a small verification/resend page and Server Action.

**Tech Stack:** Next.js 16.4 App Router with Cache Components, React 19.3, NextAuth v5 beta, Drizzle PostgreSQL via Neon HTTP, Zod, Resend Node SDK, Node crypto, TypeScript, Tailwind CSS v4.

**Spec:** `context/current-feature.md`, including the defaults approved in conversation.

## Global Constraints

- Sender: `onboarding@resend.dev`; read `RESEND_API_KEY` server-side from the existing environment. Never expose, log, or commit its value.
- Require verification for every email/password account, including existing test accounts. Do not bulk-update existing accounts or delete users.
- Links expire after **24 hours**, work **once**, and never create a session. Successful verification returns the user to normal sign-in.
- Enforce a **60-second** resend cooldown in the database, not merely in the UI. A replacement link invalidates the previous link.
- Preserve GitHub OAuth, existing JWT user IDs, password validation/hashing, and safe callback handling. No password reset, automatic linking, magic-link login, or unrelated refactoring.
- All database activity must target development endpoint `ep-silent-bird-b59kwhec`. Before migrations/testing, verify the effective connection's hostname without printing credentials; `.env.production` can override `.env` during production builds. Stop on a different target. Never operate on production.
- Follow the repository's deferred-unit-test policy: demonstrate failing then passing HTTP/browser acceptance checks, storing scripts and sensitive fixtures under `/tmp/opencode/`, outside Tailwind's source scan. Do not install a test framework.
- Do not commit, push, merge, delete test data, or create a worktree without the applicable user permission. Worktree and execution approach are chosen at handoff.
- Real delivery from Resend's test sender is limited to the Resend account email. Do not promise delivery to arbitrary mock addresses or send messages to unrelated recipients.

## Review Focus

- Simultaneous resend or verification requests must not bypass the cooldown, consume a token twice, or mark a different user verified.
- A provider rejection, missing environment variable, or network interruption must not erase an account or strand it without a resend path.
- Malformed, tampered, expired, superseded, and replayed links must not verify a user or leak a raw token in the resulting page/redirect.
- Wrong passwords must retain generic errors; the unverified-account hint is shown only after checking the correct password. Unknown/verified/OAuth-only resend targets receive generic feedback.
- Existing test accounts, mixed-case email input, OAuth-only accounts, and the full registration-to-sign-in journey must retain their intended authentication behavior.

---

### Task 1: Persistent verification lifecycle and Resend delivery

**Files:** Modify `src/db/schema/auth.ts`, `package.json`, `pnpm-lock.yaml`, `.env.example`; create `src/lib/email.ts`, `src/lib/email-verification.ts`, `src/types/email-verification.ts`; generate migration and metadata under `drizzle/` with `pnpm db:generate`.

**Interfaces:** Export `sendVerificationEmail(email: string, verificationUrl: string): Promise<void>` from `src/lib/email.ts`. Export `requestEmailVerification(email: string): Promise<VerificationSendResult>` and `verifyEmailToken(token: string): Promise<VerificationResult>` from `src/lib/email-verification.ts`. Define `VerificationSendResult` as `{ status: "sent" | "cooldown" | "ineligible" | "failed"; retryAfterSeconds: number }`; define `VerificationResult` as `"verified" | "invalid"` in `src/types/email-verification.ts`.

- [x] Establish the failing baseline: the development database has no purpose-specific verification table; no issuance/consume flow exists. Record checks without revealing connection secrets.
- [x] Add `emailVerifications` table in the auth schema: `userId` text primary key with users FK/cascade, `tokenHash` unique text, `expiresAt` and `lastSentAt` non-null timezone-aware date timestamps. Keep the adapter's `verificationTokens` unchanged. Generate and inspect the migration; apply only after confirming the development target. Verify the new table exists and migration generation reports no further drift.
- [x] Install `resend` using pnpm. Add blank `RESEND_API_KEY` and documented `AUTH_URL` configuration to `.env.example`, never edit/copy secret values. Implement server-only email delivery with lazy SDK construction, exact sender, plain-text and HTML bodies, 24-hour expiry copy, disabled click tracking where supported, explicit SDK `{ error }` handling, and a bounded request timeout. Do not log credentials, tokenized URLs, or full provider payloads.
- [x] Implement issuance: normalized email lookup resolves only an unverified account with `passwordHash`; generate 32 random bytes encoded as 64 hex characters, store only SHA-256 hash, set expiry to now plus 24 hours. Use a single conditional upsert keyed on user ID to enforce `lastSentAt <= now - 60 seconds`; one concurrent request wins. Gate the database write on continued eligibility. Do not delete or replace account credentials.
- [x] Build links from a validated configured `AUTH_URL` origin; use `http://localhost:3000` only in development. Reject missing production configuration or non-HTTP(S)/credential-bearing origins; never trust arbitrary request Host/Origin headers. Link target: `/api/auth/verify-email?token=<raw-token>`.
- [x] Persist before sending; on send failure return `failed`, retain the account, invalidate only that failed token if it is still current, and retain `lastSentAt` to preserve the 60-second cooldown. Keep this token invalidation compatible with the non-null schema by storing a fresh unreachable random hash. A later request after cooldown can recover.
- [x] Implement consumption with strict 64-hex validation and hashing. Use one Drizzle PostgreSQL data-modifying CTE to delete the matching unexpired row and update that row's user's `emailVerified` only if still unverified with a password. Set `updatedAt` explicitly if using SQL expressions. Neon HTTP does not support interactive transactions; do not split token consumption and user verification into uncoordinated calls. Return `verified` only for the successful update; otherwise `invalid`.
- [x] Verify on development fixtures: exactly 24-hour expiry, no raw token in DB, wrong/expired/superseded tokens rejected, one winner for concurrent consume and concurrent issuance, before/at 60-second resend boundaries, provider rejection/missing key/network failure recovery. Use a local transport stub outside product code for deterministic delivery tests; use controlled DB timestamps for expiry checks rather than waiting a day.

### Task 2: Registration integration and credentials enforcement

**Files:** Modify `src/app/api/auth/register/route.ts`, `src/auth.ts`, `src/actions/auth.ts`, `src/types/auth.ts`; create `src/lib/auth-errors.ts`.

**Interfaces:** Create `EmailNotVerifiedError extends CredentialsSignin` with code `email_not_verified`. Extend registration success data with `verificationEmailSent: boolean` while preserving existing ID/name/email fields. Add optional `requiresEmailVerification?: boolean` to `AuthFormState`. Consume Task 1's helpers.

- [x] Record failing HTTP checks: an existing unverified credentials fixture currently signs in successfully, and registration does not attempt delivery. Preserve all preexisting test records.
- [x] After registration inserts an unverified user, call `requestEmailVerification(email)`. Return 201 with `verificationEmailSent` indicating confirmed delivery; provider failure still means the account was created and can request another link. Preserve invalid-JSON/input 400, duplicate 409, bcrypt cost 12, and no automatic login. Never return a token or password/hash.
- [x] Include `emailVerified` in the credentials lookup. After a successful bcrypt password check, throw `EmailNotVerifiedError` if it is null; never return an authorized user for that account. Map this custom error in the credentials Server Action to clear verification guidance and `requiresEmailVerification: true`; keep wrong-password/unknown/OAuth-only errors generic and rethrow Next.js redirects.
- [x] Verify both direct Auth.js credentials HTTP calls and custom form actions reject unverified users without a session. Verify correct-password-only guidance, failed-password privacy, existing test account recovery, verified login/session ID retention, duplicate registration not overwriting credentials, mixed-case normalization, and unchanged GitHub initiation/account-linking behavior.

### Task 3: Verification completion, resend, and auth UI

**Files:** Create `src/app/api/auth/verify-email/route.ts`, `src/app/verify-email/page.tsx`, `src/components/auth/VerificationForm.tsx`, `src/actions/email-verification.ts`; modify `src/lib/auth-validation.ts`, `src/components/auth/RegisterForm.tsx`, `src/components/auth/SignInForm.tsx`, `src/app/sign-in/page.tsx`.

**Interfaces:** Export GET verification handler using Task 1's `verifyEmailToken`. Export `resendVerificationEmail(previous: VerificationFormState, formData: FormData): Promise<VerificationFormState>`. Define `VerificationFormState` in `src/types/email-verification.ts` with `{ success: boolean; data: { retryAfterSeconds: number } | null; error: string | null; fieldErrors?: { email?: string } }`. Export `VerificationForm()`; reuse existing `AuthShell` and `AuthField`.

- [x] Record failing checks: verify endpoint/page absent; existing registration success notice incorrectly invites immediate sign-in without verification.
- [x] Implement GET endpoint: validate/consume the token then redirect to `/sign-in?verified=1`, or `/verify-email?status=invalid` for malformed/expired/used links; service failure redirects to `/verify-email?status=error`. Add `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, including redirects. Never put the token in destination URLs, rendered error text, or analytics. Do not prefetch tokenized links.
- [x] Add normalized email-only Zod validation, shared with existing normalization where practical. Implement resend Server Action with input validation and the shared issuance service. For every valid email, including delivery/configuration/storage failures, return identical neutral feedback and a 60-second UI cooldown; the database is authoritative. Do not disclose account existence or auto-login. Client transport failures still receive inline retry guidance.
- [x] Implement the verification page with existing auth styling, email input, pending submit prevention, accessible labels/errors/status messages, resend cooldown, and sign-in link. Read async search parameters behind Suspense, as required by this app's Cache Components configuration. Distinguish check-inbox, delivery-failed, invalid/expired/used-link, and temporary-error notices without trusting query parameters as proof of verification.
- [x] Update registration response validation and redirect to `/verify-email?status=sent` only after confirmed send; use `status=delivery-failed` when creation succeeded but delivery did not. Do not put passwords or email addresses in query strings. Replace the old registered/sign-in-ready notice; show a verified notice on `/sign-in?verified=1`. Provide a verification/resend link on sign-in, including clear guidance for the custom unverified-credentials error.
- [x] Verify desktop and 320px mobile pages, keyboard navigation, error focus/live feedback, pending/double submits, invalid email, cooldown after refresh/bypassed client, unknown/OAuth-only/verified resend equivalence, interrupted requests, invalid statuses, and malformed/expired/replayed/superseded links. Confirm no horizontal overflow, raw-token display, new runtime errors, or dashboard reload loop.

### Task 4: Integrated acceptance, documentation, and review

**Files:** Update `README.md`, this plan's evidence, and `context/current-feature.md`.

- [x] Document `RESEND_API_KEY`, canonical `AUTH_URL`, the test sender's recipient restriction, registration response extension, existing-account verification requirement, resend access/cooldown, expiry, and provider failure recovery. Remove the obsolete claim that email verification is not implemented; do not claim broad abuse protection (per-IP/global limits remain out of scope).
- [x] Run the complete development journey: register, confirm credentials blocked, receive/capture link, click it, sign in, sign out, repeat sign-in retaining ID. Verify an existing unverified test user can request a link and complete the same journey. Do not delete fixtures without permission.
- [ ] Ask the user to register with their Resend account email, click the real message, and confirm successful sign-in. Use a transport stub for other deterministic checks, clearly distinguish simulated delivery from real delivery, and request user-assisted GitHub regression acceptance if needed.
- [x] Run `pnpm lint`, `pnpm build`, `pnpm exec tsc --noEmit`, and `git diff --check`; require zero failures. Inspect generated migration against the schema and confirm the effective database target for local production smoke tests before running them.
- [x] Review the whole diff for atomic consumption/cooldown, delivery failure recovery, auth bypasses, secret exposure, safe origins/redirects, Server Action validation, client/server boundaries, and accessibility. Use the independent whole-branch reviewer specified by the chosen execution workflow.
- [x] Record evidence and limitations; leave status In Progress until user-authorized completion. No automatic commit, push, merge, or cleanup.

## Planning Evidence

- Existing `users.emailVerified` is nullable and credentials currently ignore it. Existing registration creates accounts without a session and returns ID/name/email. Its UI currently redirects directly to sign-in.
- Existing `verificationTokens` is adapter-owned; the separate table avoids altering Auth.js semantics and allows one atomic resend slot per user.
- Read installed Next.js route/form documentation and current Context7 Resend, Drizzle Neon HTTP, and Auth.js custom CredentialsSignin guidance.
- Confirmed Resend's test-domain recipient restriction. The Neon HTTP driver requires atomic statements/batches, not interactive transaction callbacks.
- Created `feature/email-verification-on-registration`, preserving the previously loaded feature document. `pnpm lint` and `pnpm build` passed before product changes.
- Self-review: all approved requirements map to tasks; each Review Focus condition has acceptance coverage. No product code, dependency, environment-secret, or database changes have been made during planning.

## Execution Evidence

- User approved the plan, native execution, and working directly on the feature branch. No commits, push, merge, user deletion, secret edits, or production database operations occurred.
- Applied generated migration `0001_cultured_slapstick.sql` only to development endpoint `ep-silent-bird-b59kwhec`. Regeneration confirms zero schema drift; existing schema tables and Auth.js adapter token semantics are unchanged.
- Observed failing baselines for missing verification persistence/pages/contract, unverified credentials successfully creating a session, and verification URLs appearing in default development request logs. Each now passes its acceptance check.
- Passing automated acceptance: **33 lifecycle**, **33 integrated HTTP/Server Action**, **6 HTTP**, **5 review privacy regressions**, **66 development browser**, and **16 production browser** assertions. These exercise real app/database behavior with only Resend HTTP transport simulated; actual inbox delivery is not claimed. Production browser checks include keyboard navigation and duplicate-submit suppression under a held request.
- Browser acceptance covers 1440px, 375px, and 320px widths, validation/error focus, registration-to-verification-to-login/logout, cooldown across navigation/refresh, superseded/replayed links, provider-failure recovery, inline interrupted-resend recovery, and no new runtime errors/horizontal overflow/reload loop.
- Independent read-only whole-working-tree review found one Important account-status leak through resend delivery-failure responses, no Critical issues, and no Minor issues. Reproduced the finding against the actual action and development database (RED); made all valid-email resend responses neutral; five failure-equivalence regressions and the full suite then passed (GREEN). No re-review substituted for regression verification.
- Build, lint (zero warnings), TypeScript, whitespace, migration-drift, GitHub OAuth initiation/callback-origin, and verification-URL log-redaction checks passed. Build/production tests explicitly loaded development credentials because the existing `.env.production` contains a placeholder DB hostname; no environment files were edited.
- Implementation calls: new resend form catches transport errors inline; HEAD never consumes a token; framework development logs omit verification requests/action arguments; click tracking is a domain-level Resend setting, documented for a future verified sender. Generic public resend feedback deliberately does not expose provider/configuration/storage errors.
- Remaining acceptance: user registers/resends with their Resend account email using the normal unstubbed app, clicks the actual email, and confirms credentials login; full real GitHub sign-in remains user-assisted. Global/per-IP abuse protection is deferred; GET-based scanners can consume a link, with resend as recovery.
- Scratch evidence is retained outside tracked source, under `/tmp/opencode/` and the git-ignored plan workspace. Browser scripts wait for streamed content and scope locators to visible Activity pages; initial harness timing/locator failures did not require product changes.

## Approved Follow-ups and Completion Gate — 2026-10-16

- Added server-only `EMAIL_VERIFICATION_ENABLED`: enabled unless the exact value is `false`. Disabled registrations persist verification immediately without tokens/emails; existing accounts are auto-verified only after a correct password. Re-enabling does not revoke those timestamps. GitHub remains unchanged.
- Registration's response includes the authoritative `verificationRequired` value. Disabled-mode UI returns to normal sign-in; `/verify-email` redirects silently to `/sign-in` rather than exposing configuration. Local private `.env` explicitly disables verification; the checked-in example defaults to enabled.
- Added the requested development-only cleanup utility. Preview is the default, deletion requires `--execute`, all writes use a locked transaction, and every delete excludes `demo@bearxus.io` if present. Per the user's correction, missing demo accounts do not block cleanup. No actual cleanup deletion was run by the agent.
- User requested `/feature complete` and continuation. Fresh pre-integration verification passed: build, lint, TypeScript, whitespace, zero generated migration drift, **61 backend/lifecycle/config assertions**, **27 production browser assertions** across enabled/disabled runtime modes using one artifact, and **15 cleanup CLI/SQL-boundary assertions** with simulated transport. Cleanup's real command was exercised only in read-only preview mode.
- Earlier `/tmp/opencode/` scratch scripts were cleared by the environment. The final gate rebuilt its acceptance scripts and reran the checks rather than relying on earlier output; the ignored browser fixture remained available.
- Fresh whole-working-tree independent review found no Critical or Important findings and confirmed the migration snapshot adds only `email_verifications`. One minor remains deferred: Resend 6.33.0 logs full provider error objects in non-production environments, potentially including recipient addresses. Suppressing that upstream behavior without global/concurrent side effects is outside this completion pass; avoid sharing raw development provider logs. Production SDK error logging is disabled by the SDK.
- Integration does not assert actual inbox delivery, full live GitHub consent flow, or real cleanup deletion. Those remain explicitly unverified; general global/per-IP abuse protection and scanner-resistant multi-click verification remain outside scope.
