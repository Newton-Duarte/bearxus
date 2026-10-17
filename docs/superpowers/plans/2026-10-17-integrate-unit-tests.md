# Integrate Unit Tests: Server Logic & Utility Unit Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fast, isolated Vitest layer for Bearxus server actions, auth route handlers, and pure validation/utility logic without introducing browser or component-testing dependencies.

**Architecture:** Configure Vitest for the Node environment with an explicit `@` alias to `src`, then colocate `*.test.ts` files beside the server and utility modules they cover. External services, database access, Next.js request-context APIs, and auth integrations are mocked at module boundaries; pure validation, redirect, and rate-limit formatting logic runs against real implementations.

**Tech Stack:** Vitest, TypeScript, Next.js 16 server actions/route handlers, Zod, existing application dependencies.

**Spec:** `context/features/integrate-unit-tests-spec.md`

## Global Constraints

- Standardize completely on Vitest.
- Keep test files next to source files using the `feature.test.ts` convention.
- Use `vi.mock` for external dependencies and Next.js internals such as `next/navigation` and `next/headers`.
- Use `vi.useFakeTimers()` for time-dependent logic.
- Keep tests Node-based; do not install `jsdom`, `@testing-library/react`, or component-based dependencies.

## Review Focus

- FormData and JSON payloads with missing, malformed, whitespace, and mixed-case values must return the existing validation contract; cover in action and route-handler tests.
- Rate-limit denial, fail-open behavior, `Retry-After`, and clock-boundary messages must remain deterministic; cover in rate-limit and handler tests with fake timers.
- Auth, database, email, hashing, and delivery failures must preserve neutral user-facing responses and status codes; cover in the relevant action/route tests.
- Redirect callbacks must reject external, encoded, malformed, and auth-route destinations while preserving safe paths; cover in redirect utility tests and credential sign-in tests.
- Invalid, expired, replayed, and mismatched password-reset data must not mutate state or leak account information; cover in password-reset action and route tests through mocked token services.

---

### Task 1: Vitest Node Test Foundation

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vitest.config.mts`
- Modify: `context/coding-standards.md`

**Interfaces:**
- Produces the `pnpm test` command, a Node-only Vitest environment, and `@/*` resolution for all colocated tests.

- [ ] **Step 1: Add the test dependency and scripts**

  Add `vitest` as a development dependency and define `test` as a non-watch `vitest run` command plus an optional `test:watch` command for local iteration. Do not add React/Vite component plugins, DOM environments, or testing-library packages.

- [ ] **Step 2: Create the Vitest configuration**

  Create `vitest.config.mts` using `defineConfig`, `environment: "node"`, the `src/**/*.test.ts` include pattern, and an explicit `@` alias resolving to `src`. Keep the configuration free of browser setup files.

- [ ] **Step 3: Document the repository testing convention**

  Add a testing subsection to `context/coding-standards.md` describing Vitest, Node-only tests, colocated filenames, and module-boundary mocking.

- [ ] **Step 4: Verify the foundation**

  Run `pnpm test -- --passWithNoTests` and confirm Vitest starts successfully without adding any forbidden dependency.

### Task 2: Pure Validation, Redirect, and Rate-Limit Utility Tests

**Files:**
- Create: `src/lib/auth-validation.test.ts`
- Create: `src/lib/auth-redirect.test.ts`
- Create: `src/lib/rate-limit.test.ts`

**Interfaces:**
- Consumes the existing schemas and exported utility functions from `src/lib/auth-validation.ts`, `src/lib/auth-redirect.ts`, and `src/lib/rate-limit.ts`.
- Produces fast examples of real pure-function execution, edge-case assertions, payload matrices, and fake-clock coverage.

- [ ] **Step 1: Write validation tests first**

  Cover normalized email output, invalid email, password length/UTF-8 byte boundaries, registration confirmation mismatch, reset-token shape, and change-password confirmation mismatch using `safeParse` payload matrices.

- [ ] **Step 2: Run the validation tests**

  Run `pnpm vitest run src/lib/auth-validation.test.ts`; confirm the tests execute against the existing schemas and any failure is due to an assertion or setup issue rather than a browser environment.

- [ ] **Step 3: Write redirect and rate-limit tests**

  Cover safe internal paths, query/hash preservation, external and auth/API route rejection, malformed/encoded/control-character input, client-IP precedence, fail-open decisions when Redis is unavailable, retry-after calculation, and message rounding. Use `vi.useFakeTimers()` with a fixed system time for time-dependent assertions.

- [ ] **Step 4: Run the utility tests**

  Run `pnpm vitest run src/lib/auth-validation.test.ts src/lib/auth-redirect.test.ts src/lib/rate-limit.test.ts`; expect all assertions to pass with no DOM globals.

### Task 3: Credential and Verification Server-Action Tests

**Files:**
- Create: `src/actions/auth.test.ts`
- Create: `src/actions/email-verification.test.ts`

**Interfaces:**
- Consumes `signInWithCredentials` and `resendVerificationEmail` with mocked `@/auth`, `next-auth`, `next/headers`, rate limiting, and email-verification services.
- Produces coverage for validation, rate-limit feedback, auth error mapping, safe callback redirects, neutral delivery behavior, and resend cooldown data.

- [ ] **Step 1: Write credential-action tests first**

  Assert invalid fields are returned without calling dependencies; denied rate limits return the configured message; credentials errors map to the existing generic message; `EmailNotVerifiedError` sets `requiresEmailVerification`; successful sign-in passes the safe redirect and returns the success state; unsafe callbacks fall back to `/dashboard`.

- [ ] **Step 2: Run the credential tests**

  Run `pnpm vitest run src/actions/auth.test.ts`; expect the existing behavior to pass without invoking any real auth or request-context dependency.

- [ ] **Step 3: Write verification-action tests first**

  Assert invalid email field errors, rate-limit retry data using a mocked decision, successful delivery returning a 60-second retry value, and delivery/storage exceptions remaining neutral and successful.

- [ ] **Step 4: Run the verification tests**

  Run `pnpm vitest run src/actions/email-verification.test.ts`; expect the existing behavior to pass, then keep the production implementation unchanged unless a test demonstrates an actual behavior defect.

- [ ] **Step 5: Verify both action suites**

  Run `pnpm vitest run src/actions/auth.test.ts src/actions/email-verification.test.ts` and expect all action assertions to pass.

### Task 4: Password, Profile, and Registration Handler Tests

**Files:**
- Create: `src/actions/password-reset.test.ts`
- Create: `src/actions/profile.test.ts`
- Create: `src/app/api/auth/register/route.test.ts`

**Interfaces:**
- Consumes the existing server actions and registration route through mocked database, auth, bcrypt, rate-limit, email, and token-service boundaries.
- Produces coverage for time-sensitive reset/retry behavior, session/password mutations, neutral errors, registration status contracts, and verification gating.

- [ ] **Step 1: Write password-reset action tests first**

  Assert invalid email and password/token field errors, rate-limit responses, unusable/replayed tokens, successful hashing and token consumption, service failures, and the neutral success response for password-reset request failures. Use fake timers for retry values where the action falls back to its cooldown.

- [ ] **Step 2: Run the password-reset tests**

  Run `pnpm vitest run src/actions/password-reset.test.ts`; expect the existing behavior to pass with token and hashing services mocked.

- [ ] **Step 3: Write profile-action tests first**

  Assert expired sessions, validation errors, wrong current passwords, successful password updates, update failures, unauthenticated deletion redirect, and authenticated deletion/sign-out behavior.

- [ ] **Step 4: Run the profile tests**

  Run `pnpm vitest run src/actions/profile.test.ts`; confirm the tests are isolated from the real database and auth session.

- [ ] **Step 5: Write registration-route tests first**

  Assert invalid JSON, schema validation, duplicate users, successful registration with verification enabled/disabled, verification delivery failure after account creation, rate-limit responses, and unexpected database failures with exact status/body contracts.

- [ ] **Step 6: Run the handler tests**

  Run `pnpm vitest run src/actions/password-reset.test.ts src/actions/profile.test.ts src/app/api/auth/register/route.test.ts`; expect all tests to pass without network or database access.

### Task 5: Recovery Route Handler Tests and Full Verification

**Files:**
- Create: `src/app/api/auth/forgot-password/route.test.ts`
- Create: `src/app/api/auth/reset-password/route.test.ts`
- Create: `src/app/api/auth/resend-verification/route.test.ts`

**Interfaces:**
- Consumes the three existing recovery route handlers through mocked validation dependencies, token/email services, hashing, and rate limiting.
- Produces complete route-level status, JSON, header, neutral-response, and replay/failure coverage for the authentication recovery surface.

- [ ] **Step 1: Write recovery route tests first**

  Cover invalid JSON and payloads, neutral forgot-password success on service failure, reset-token invalidity and mismatch errors, successful reset response, resend verification’s validation-before-rate-limit order, delivery failure neutrality, and 429 `Retry-After` responses.

- [ ] **Step 2: Run the recovery route tests**

  Run `pnpm vitest run src/app/api/auth/forgot-password/route.test.ts src/app/api/auth/reset-password/route.test.ts src/app/api/auth/resend-verification/route.test.ts`; expect the existing route contracts to pass with all external services mocked.

- [ ] **Step 3: Run the complete unit-test suite**

  Run `pnpm test` and expect every colocated test to pass without jsdom or component-test packages.

- [ ] **Step 4: Run repository verification**

  Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`; fix only test/config/type issues introduced by this feature and preserve unrelated existing warnings.

- [ ] **Step 5: Review dependency and diff scope**

  Confirm `package.json` contains Vitest but no `jsdom`, `@testing-library/react`, or component-testing dependencies; inspect `git diff --check` and `git status --short` before reporting the feature ready for review.
