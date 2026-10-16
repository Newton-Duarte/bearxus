# Forgot Password Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, neutral-response password recovery journey for Bearxus email/password accounts, from the sign-in link through a single-use password reset.

**Architecture:** Keep NextAuth credentials, GitHub OAuth, JWT sessions, and the existing `users.passwordHash` model. Add a purpose-specific `password_resets` table and server-only helpers that issue hashed tokens, send Resend emails, and atomically consume a token while updating the password. Connect those helpers to Server Actions and small auth pages that reuse `AuthShell`, `AuthField`, and the existing dark auth styling.

**Tech Stack:** Next.js 16.4 App Router with Cache Components, React 19.3, NextAuth v5 beta, Drizzle PostgreSQL via Neon HTTP, Zod, bcryptjs, Resend Node SDK, Node crypto, TypeScript, Tailwind CSS v4.

**Spec:** `context/current-feature.md`

## Global Constraints

- Password reset links expire after **24 hours**, are stored only as SHA-256 token hashes, and can be consumed exactly once.
- Valid reset requests always return the same neutral success response whether the address belongs to an eligible account, an OAuth-only account, no account, or delivery fails.
- Keep the existing `onboarding@resend.dev` sender, read `RESEND_API_KEY` only on the server, and never expose credentials, raw tokens, or password hashes.
- Normalize email input with the existing Zod conventions; enforce the existing 8-character/72-byte password rules and confirmation match.
- Preserve GitHub OAuth, existing credentials sign-in behavior, JWT session user IDs, email verification, safe redirects, and existing registration behavior.
- Use Server Actions for form mutations and Route Handler/page boundaries consistent with the existing App Router implementation. Query-driven pages must remain compatible with Cache Components and render async search parameters behind Suspense where needed.
- All database generation, migration, and fixture operations target development branch `ep-silent-bird-b59kwhec` only; production is off limits.
- Demonstrate failing then passing HTTP/browser acceptance checks using scratch files under `/tmp/opencode/`; do not install a test framework or commit secrets/fixtures.
- Do not commit, push, merge, delete user data, or alter unrelated auth behavior without explicit permission.

## Review Focus

- Unknown, OAuth-only, verified, mixed-case, and existing password accounts must receive indistinguishable valid-email recovery feedback; pin this to request-action and browser checks.
- Malformed, tampered, expired, superseded, and replayed tokens must never update a password or expose the raw token; pin this to token lifecycle checks.
- Concurrent requests and concurrent token consumption must have one authoritative winner and preserve the one-use/cooldown guarantees; pin this to development lifecycle checks.
- Invalid, short, oversized, multibyte, and mismatched new passwords must be rejected without consuming a valid token; pin this to reset-action checks.
- Resend/provider/configuration/database failures must not delete accounts, leak status, or leave a successful-looking reset link usable; pin this to delivery-failure checks.

---

### Task 1: Password-reset persistence and token lifecycle

**Files:**
- Modify: `src/db/schema/auth.ts`
- Create: `src/lib/password-reset.ts`
- Create: `src/types/password-reset.ts`
- Generate: `drizzle/<generated-password-reset-migration>.sql` and `drizzle/meta/*`

**Interfaces:**
- `PasswordResetSendResult = { status: "sent" | "cooldown" | "ineligible" | "failed"; retryAfterSeconds: number }`.
- `PasswordResetResult = "reset" | "invalid"`.
- `requestPasswordReset(email: string): Promise<PasswordResetSendResult>`.
- `resetPasswordToken(token: string, passwordHash: string): Promise<PasswordResetResult>`.

- [ ] **Step 1: Write the failing lifecycle checks**

  Create a scratch acceptance script under `/tmp/opencode/` that records the missing `password_resets` table/service contract and asserts the intended 64-hex token, hashed-at-rest, 24-hour expiry, one active reset per user, neutral eligibility, and atomic one-use behavior against development fixtures. Do not print connection strings, tokens, or email addresses.

- [ ] **Step 2: Run the checks to verify they fail for the missing feature**

  Run the scratch lifecycle command against the development app/database. Expected: the checks fail because the table and lifecycle helpers do not exist; no existing users are changed.

- [ ] **Step 3: Add the schema and generate its migration**

  Add `passwordResets` with `userId` as a cascading users foreign-key primary key, a unique `tokenHash`, timezone-aware non-null `expiresAt`, and `lastSentAt`. Generate the migration with `pnpm db:generate`, inspect that it adds only the password-reset table/indexes, and verify no unrelated schema drift.

- [ ] **Step 4: Implement `requestPasswordReset`**

  Normalize the address, select only users with a non-null `passwordHash`, generate 32 random bytes as 64 lowercase hex characters, hash them with SHA-256, and build a validated `AUTH_URL` link to `/reset-password?token=<raw-token>`. Upsert one row per user with a 24-hour expiry and a database-enforced 60-second resend cooldown, replacing older tokens. Persist before delivery; if delivery fails, invalidate only the still-current token and return `failed`. Unknown/OAuth-only users return `ineligible` without creating a row.

- [ ] **Step 5: Implement atomic token consumption**

  Validate the raw token format before hashing. Use a single Drizzle data-modifying CTE to delete only the matching, unexpired reset row for a password account and update that user’s `passwordHash` and `updatedAt` with the supplied bcrypt hash. Return `reset` only when the update succeeds; return `invalid` for malformed, expired, superseded, replayed, or non-password-account tokens.

- [ ] **Step 6: Run the lifecycle checks to verify they pass**

  Re-run the same scratch script. Expected: PASS for hashing, expiry, cooldown, provider-failure invalidation, replacement-token invalidation, concurrent issuance/consumption, and no password/account changes on invalid input.

### Task 2: Reset request and completion actions

**Files:**
- Modify: `src/lib/auth-validation.ts`
- Create: `src/actions/password-reset.ts`
- Modify: `src/types/password-reset.ts`

**Interfaces:**
- `requestPasswordReset(previous: PasswordResetRequestState, formData: FormData): Promise<PasswordResetRequestState>`.
- `completePasswordReset(previous: PasswordResetFormState, formData: FormData): Promise<PasswordResetFormState>`.
- Request state contains `{ success: boolean; data: { retryAfterSeconds: number } | null; error: string | null; fieldErrors?: { email?: string } }`.
- Completion state contains `{ success: boolean; data: null; error: string | null; fieldErrors?: { token?: string; password?: string; confirmPassword?: string } }`.

- [ ] **Step 1: Add failing action checks**

  Extend the scratch acceptance script to submit malformed email, valid unknown email, valid eligible email, invalid token, short/oversized/multibyte/mismatched passwords, and valid reset data. Assert field errors, neutral valid-email responses, generic invalid-token feedback, and that the valid token remains usable after rejected password input.

- [ ] **Step 2: Run the action checks to verify they fail**

  Run the targeted scratch checks. Expected: the new actions/contracts are missing and all new behavior fails without changing existing sign-in or registration behavior.

- [ ] **Step 3: Add shared reset schemas**

  Reuse the existing normalized email schema and password rules. Add a reset request schema and a completion schema with a strict 64-hex token, `password`, and `confirmPassword`, returning the existing user-facing validation messages and attaching mismatches to `confirmPassword`.

- [ ] **Step 4: Implement the request Server Action**

  Validate `FormData`, map invalid email to an email field error, call `requestPasswordReset` for valid input, and return the same success state with a 60-second retry value for every valid address regardless of eligibility or delivery result. Catch unexpected failures without revealing account/provider status.

- [ ] **Step 5: Implement the completion Server Action**

  Validate token and password fields before hashing. Hash a valid password with bcrypt cost 12, call `resetPasswordToken`, and return a generic invalid/expired/used-link error when consumption fails. Return success only after the atomic update; do not sign the user in automatically and do not redirect with the token.

- [ ] **Step 6: Run the action checks to verify they pass**

  Re-run the targeted script. Expected: PASS for validation privacy, token preservation on invalid passwords, generic invalid-token handling, and successful one-time password replacement.

### Task 3: Email delivery and recovery pages

**Files:**
- Modify: `src/lib/email.ts`
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/reset-password/page.tsx`
- Create: `src/components/auth/ForgotPasswordForm.tsx`
- Create: `src/components/auth/ResetPasswordForm.tsx`

**Interfaces:**
- Export `sendPasswordResetEmail(email: string, resetUrl: string): Promise<void>` from `src/lib/email.ts`.
- Export `ForgotPasswordForm()` and `ResetPasswordForm({ token }: { token: string })`.

- [ ] **Step 1: Record failing page/browser checks**

  Add scratch browser assertions for the missing `/forgot-password` and `/reset-password` routes, accessible forms, validation/status regions, loading prevention, mobile layout, and no raw-token rendering in invalid-link notices.

- [ ] **Step 2: Run browser checks to verify they fail**

  Start the development server and run the checks at desktop and 320px widths. Expected: the new routes/link targets are unavailable before implementation.

- [ ] **Step 3: Add Resend password-reset delivery**

  Follow the existing server-only Resend helper: use the configured API key, the existing sender, plain text plus escaped HTML, a 24-hour/one-use explanation, the reset URL, and a bounded request timeout. Throw on missing configuration/provider failure without logging secrets or full payloads.

- [ ] **Step 4: Build the forgot-password page/form**

  Render `AuthShell` with a clear recovery description and a client form using `useActionState`, `AuthField`, accessible errors/status, pending state, duplicate-submit prevention, and the 60-second retry display. Show only neutral “if an account exists, check your inbox” feedback and provide a sign-in link.

- [ ] **Step 5: Build the reset-password page/form**

  Read the token from async `searchParams` behind Suspense, pass only a strict-format token to the client form, and render a no-index auth page. Provide new-password/confirmation fields, password guidance, pending/error focus behavior, generic invalid-link handling, and on success navigate to `/sign-in?reset=1` without retaining the token in the destination.

- [ ] **Step 6: Run browser checks to verify they pass**

  Re-run the page checks. Expected: PASS for route rendering, keyboard navigation, labels, status/error announcements, pending/double-submit behavior, 320px layout, and token privacy.

### Task 4: Sign-in integration and end-to-end verification

**Files:**
- Modify: `src/components/auth/SignInForm.tsx`
- Modify: `src/app/sign-in/page.tsx`
- Modify: `context/current-feature.md`
- Update: `README.md` only if the repository’s auth configuration documentation needs the new reset flow.

**Interfaces:** Consume the Task 2 actions and Task 3 routes without changing NextAuth provider configuration or callback handling.

- [ ] **Step 1: Record the failing integration checks**

  Extend the browser/HTTP checks to assert the sign-in page lacks the recovery link and reset-success notice, then record the full register/request/reset/sign-in journey against preserved development fixtures.

- [ ] **Step 2: Add the sign-in link and success notice**

  Place a visible, keyboard-focusable `Forgot password?` link beside the credentials form and render a safe success status for `/sign-in?reset=1`. Preserve callback URL handling, OAuth controls, verification messaging, and generic credential errors.

- [ ] **Step 3: Run the integrated journey**

  Use a controlled development fixture and mail transport capture to request a reset, confirm no raw token is persisted, follow the captured link, set a new password, sign in with the new password, confirm the old password fails, and confirm the reset link cannot be replayed. Check unknown/OAuth-only/provider-failure equivalence and existing GitHub/email-verification regressions.

- [ ] **Step 4: Run project verification**

  Run `pnpm lint`, `pnpm build`, `pnpm exec tsc --noEmit`, `git diff --check`, and `pnpm db:generate`/migration-drift verification against the development target. Inspect the complete diff for secret/token exposure, atomicity, client/server boundaries, accessibility, and unrelated changes.

- [ ] **Step 5: Record evidence**

  Update `context/current-feature.md` with the completed goals, verification results, limitations, and any user-assisted real inbox delivery still pending. Leave status `In Progress` until the user authorizes completion; do not commit automatically.

## Planning Evidence

- Existing credentials sign-in, registration, email verification, Resend delivery, hashed 24-hour token storage, and auth UI provide reusable patterns.
- Auth.js adapter `verificationTokens` remains unchanged; password recovery gets a separate table to preserve adapter semantics and support one active reset per user.
- Next.js form guidance confirms `useActionState` for Server Action state/pending UI; route-handler redirect guidance confirms the existing redirect style remains appropriate. The installed package did not expose the repository-referenced `node_modules/next/dist/docs/` files, so current Context7 Next.js documentation was consulted.
- No production code, migration, dependency, environment-secret, or database changes are included in this plan.
