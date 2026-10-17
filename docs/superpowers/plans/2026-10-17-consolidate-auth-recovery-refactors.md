# Consolidate Auth Recovery Refactors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the approved authentication-recovery duplication without changing validation, authorization, neutral-response, rate-limit, or token-consumption behavior.

**Architecture:** Keep request parsing, rate limiting, and transport-specific response shaping in Server Actions and API routes. Move the shared password-reset token workflow into the existing server-only password-reset domain module, and expose one non-server-only cooldown constant for server and client fallbacks. Add a small typed field-error mapper that only collects explicitly allowed top-level fields.

**Tech Stack:** TypeScript, Next.js Server Actions and App Router route handlers, Vitest, Zod, bcryptjs, Drizzle ORM.

**Spec:** `context/current-feature.md`

## Global Constraints

- Use strict TypeScript with no `any` types.
- Preserve server/client boundaries and do not add database migrations.
- Keep authorization, rate limiting, validation order, status codes, and neutral recovery responses unchanged.
- Use Vitest for focused tests and keep tests colocated with the source they exercise.
- Do not implement the deferred shared test `formData()` helper or shared recovery type aliases.

## Review Focus

- An unusable, malformed, expired, or replayed reset token must not be hashed or mutate the database; cover in the password-reset domain helper tests.
- A token-consumption race or hashing/database failure must preserve existing action and API error behavior; cover in the boundary tests.
- Email-verification and password-reset callers must use service-provided retry values while retaining the 60-second fallback only for service exceptions; cover action and route tests.
- Field-error mapping must retain the first message per allowed field and ignore token/disallowed fields; cover the mapper unit tests and existing action/API response tests.
- API status codes and action return shapes must remain transport-specific after extraction; cover both password-reset route and Server Action tests.

---

### Task 1: Extract shared password-reset completion workflow

**Files:**
- Modify: `src/lib/password-reset.ts`
- Test: `src/lib/password-reset.test.ts`
- Modify: `src/actions/password-reset.ts`
- Test: `src/actions/password-reset.test.ts`
- Modify: `src/app/api/auth/reset-password/route.ts`
- Test: `src/app/api/auth/reset-password/route.test.ts`

**Interfaces:**
- Produces `completePasswordReset(token: string, password: string): Promise<PasswordResetResult>` from `src/lib/password-reset.ts`.
- The helper returns `"invalid"` for an unusable token or a failed atomic consume, hashes usable passwords with bcrypt cost `12`, and lets operational errors reach the existing caller-level catches.
- Callers continue to own input parsing, rate limiting, error messages, HTTP status codes, and Server Action state shapes.

- [ ] **Step 1: Add failing domain-helper tests**

  Add tests proving that `completePasswordReset` does not hash or consume an unusable token, hashes a usable token with cost `12` before consuming it, and returns `"invalid"` when atomic consumption loses a race. Mock only bcrypt and the existing domain dependencies at their boundaries.

- [ ] **Step 2: Run the focused domain tests and verify the expected failure**

  Run: `pnpm vitest run src/lib/password-reset.test.ts`

  Expected: the new tests fail because `completePasswordReset` is not yet exported.

- [ ] **Step 3: Implement the minimal domain helper**

  Add the helper to `src/lib/password-reset.ts`, reuse `isUsablePasswordResetToken` and `resetPasswordToken`, and import `hash` from `bcryptjs`. Do not catch errors in the helper because the action and API route have different existing error responses.

- [ ] **Step 4: Run the domain tests and verify they pass**

  Run: `pnpm vitest run src/lib/password-reset.test.ts`

- [ ] **Step 5: Migrate the Server Action and API route**

  Replace each duplicated `isUsablePasswordResetToken` → `hash` → `resetPasswordToken` sequence with `completePasswordReset`. Preserve the existing invalid-token messages, action return values, API `400` responses, and API `500` operational-error response. Update boundary mocks and assertions to target the shared helper while retaining behavior assertions.

- [ ] **Step 6: Run all affected password-reset tests**

  Run: `pnpm vitest run src/lib/password-reset.test.ts src/actions/password-reset.test.ts src/app/api/auth/reset-password/route.test.ts`

  Expected: all affected tests pass with no new warnings.

### Task 2: Centralize recovery cooldown and service retry values

**Files:**
- Create: `src/lib/recovery.ts`
- Modify: `src/lib/email-verification.ts`
- Modify: `src/lib/password-reset.ts`
- Modify: `src/actions/email-verification.ts`
- Modify: `src/actions/password-reset.ts`
- Modify: `src/app/api/auth/resend-verification/route.ts`
- Modify: `src/app/api/auth/forgot-password/route.ts`
- Modify: `src/components/auth/VerificationForm.tsx`
- Modify: `src/components/auth/ForgotPasswordForm.tsx`
- Test: `src/lib/email-verification.test.ts`
- Test: `src/lib/password-reset.test.ts`
- Test: `src/actions/email-verification.test.ts`
- Test: `src/app/api/auth/resend-verification/route.test.ts`

**Interfaces:**
- Produces `RECOVERY_COOLDOWN_SECONDS = 60` from `src/lib/recovery.ts`; the module must remain client-safe because the two form components use it as a defensive fallback.
- `requestEmailVerification` and `requestPasswordReset` remain the authorities for successful/ineligible/cooldown retry values.

- [ ] **Step 1: Add failing tests for propagated verification retry values**

  Update/add action and API route tests so a mocked `requestEmailVerification` result with a non-default `retryAfterSeconds` is returned unchanged by the action and API route. Keep separate tests for service exceptions returning the neutral 60-second fallback.

- [ ] **Step 2: Run focused tests and verify the expected failure**

  Run: `pnpm vitest run src/actions/email-verification.test.ts src/app/api/auth/resend-verification/route.test.ts`

  Expected: the non-default retry-value assertions fail because both callers currently hardcode `60`.

- [ ] **Step 3: Implement the shared cooldown constant and service usage**

  Add the constant, replace service return literals and SQL cooldown intervals with it, and replace action/API fallback literals with it. Make the email-verification action and route capture and return the service result’s `retryAfterSeconds`; preserve their existing neutral success/error handling.

- [ ] **Step 4: Replace client fallback literals**

  Use `RECOVERY_COOLDOWN_SECONDS` instead of `60` when `Retry-After` is absent or invalid in `VerificationForm` and `ForgotPasswordForm`. Do not change values received from valid server responses.

- [ ] **Step 5: Run all recovery tests**

  Run: `pnpm vitest run src/lib/email-verification.test.ts src/lib/password-reset.test.ts src/actions/email-verification.test.ts src/actions/password-reset.test.ts src/app/api/auth/resend-verification/route.test.ts src/app/api/auth/forgot-password/route.test.ts`

  Expected: all recovery tests pass, including neutral failure and cooldown behavior.

### Task 3: Centralize typed Zod field-error mapping

**Files:**
- Create: `src/lib/form-errors.ts`
- Test: `src/lib/form-errors.test.ts`
- Modify: `src/actions/auth.ts`
- Modify: `src/actions/profile.ts`
- Modify: `src/actions/password-reset.ts`
- Modify: `src/app/api/auth/reset-password/route.ts`
- Test: `src/actions/auth.test.ts`
- Test: `src/actions/profile.test.ts`
- Test: `src/actions/password-reset.test.ts`
- Test: `src/app/api/auth/reset-password/route.test.ts`

**Interfaces:**
- Produces `getFirstFieldErrors<T extends string>(issues, allowedFields): Partial<Record<T, string>>` from `src/lib/form-errors.ts`.
- The helper considers only the first path segment, ignores fields not in `allowedFields`, and preserves the first message when multiple issues target one field.
- Callers retain their current field allowlists and user-facing summary messages.

- [ ] **Step 1: Add failing mapper tests**

  Add tests for first-message-wins behavior, disallowed-field filtering, and top-level field extraction using representative Zod issues.

- [ ] **Step 2: Run the mapper tests and verify the expected failure**

  Run: `pnpm vitest run src/lib/form-errors.test.ts`

  Expected: the tests fail because the helper does not yet exist.

- [ ] **Step 3: Implement the typed mapper**

  Implement the smallest generic helper using Zod issue path/message types. Avoid embedding action-specific messages or field names in the utility.

- [ ] **Step 4: Migrate all existing loops**

  Replace the repeated loops in the two actions, password-reset action, and reset-password API route with the helper and their existing allowlists. Preserve the token-specific invalid-link branch in both password-reset boundaries.

- [ ] **Step 5: Run the mapper, action, and route tests**

  Run: `pnpm vitest run src/lib/form-errors.test.ts src/actions/auth.test.ts src/actions/profile.test.ts src/actions/password-reset.test.ts src/app/api/auth/reset-password/route.test.ts`

  Expected: all tests pass with unchanged response shapes and messages.

### Final verification

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] Run the complete Vitest suite using the repository's configured test command.
- [ ] Review `git diff --check` and confirm no migration or unrelated files changed.
- [ ] Stop before committing and ask for permission, per repository instructions.
