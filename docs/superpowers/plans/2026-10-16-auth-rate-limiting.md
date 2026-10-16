# Auth Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect Bearxus authentication and email-sending flows with serverless-compatible Upstash sliding-window limits, fail-open behavior, and clear 429 feedback.

**Architecture:** Add a server-only rate-limit utility that lazily creates one Upstash limiter per auth policy, extracts the client IP from request headers, and combines it with normalized email identifiers where required. Apply it to the existing registration and Auth.js callback boundaries, add POST route handlers for the existing password-recovery and verification use cases, and keep the Server Actions guarded for non-browser callers. Auth forms will use accessible inline alerts already established in the project rather than adding a new toast dependency.

**Tech Stack:** Next.js 16.4 App Router, NextAuth v5 beta, TypeScript, `@upstash/ratelimit`, `@upstash/redis`, React 19.3, Zod, existing Server Actions and Route Handlers.

**Spec:** `context/features/rate-limiting-spec.md`

## Global Constraints

- Use Upstash Redis with `@upstash/ratelimit` for serverless-compatible limiting.
- Use sliding window algorithm for smooth limiting.
- Rate limiting should fail open (allow request) if Upstash is unavailable.
- Extract IP from `x-forwarded-for` header (Vercel) or request.
- Combine IP + identifier (email) where applicable for tighter limits.
- `/api/auth/callback/credentials` (login): 5 attempts, 15 minutes, keyed by IP + email.
- `/api/auth/register`: 3 attempts, 1 hour, keyed by IP.
- `/api/auth/forgot-password`: 3 attempts, 1 hour, keyed by IP.
- `/api/auth/reset-password`: 5 attempts, 15 minutes, keyed by IP.
- `/api/auth/resend-verification`: 3 attempts, 15 minutes, keyed by IP + email.
- Required environment variables are `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- API 429 responses use `{ error: "Too many attempts. Please try again in X minutes." }` and include a `Retry-After` header.
- Preserve existing NextAuth, credentials, GitHub OAuth, email verification, password reset, neutral-response, and safe-redirect behavior.
- Do not log IP addresses, email identifiers, tokens, credentials, or Upstash secrets.
- Do not commit, push, merge, or alter production data; no database migration is needed.

## Review Focus

- Missing environment variables and Upstash outages must allow the request and never turn auth into a 500; pin this to utility and HTTP checks in Task 1.
- Blank, malformed, multi-valued, or whitespace-padded `x-forwarded-for` values must produce a stable safe key without throwing; pin this to IP extraction checks in Task 1.
- Mixed-case and whitespace-padded emails must use the same IP-plus-email bucket; pin this to identifier checks in Task 1 and the resend/login checks in Tasks 2–3.
- Direct Auth.js callback requests and the Server Action sign-in path must both be protected without counting one browser sign-in twice; pin this to credential callback/action checks in Task 2.
- Server Action invocation, malformed JSON, and direct route calls must not bypass password-reset or verification limits, and denied responses must preserve `Retry-After`; pin this to route/action checks in Task 3.

---

### Task 1: Shared Upstash rate-limit utility

**Files:**
- Create: `src/lib/rate-limit.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`

**Interfaces:**
- `AuthRateLimitName = "login" | "register" | "forgot-password" | "reset-password" | "resend-verification"`.
- `RateLimitDecision = { success: boolean; remaining: number; reset: number }`, where `reset` is a Unix timestamp in milliseconds.
- `getClientIp(headers: Headers): string`.
- `checkAuthRateLimit(name: AuthRateLimitName, headers: Headers, identifier?: string): Promise<RateLimitDecision>`.
- `getRetryAfterSeconds(reset: number, now?: number): number`.
- `getRateLimitMessage(decision: RateLimitDecision, now?: number): string`.
- `rateLimitResponse(decision: RateLimitDecision): Response`.

- [ ] **Step 1: Record failing utility and contract checks**

  Create a temporary check under `/tmp/opencode/` that exercises the exported policy names, exact limits/windows, email normalization, first `x-forwarded-for` extraction, `Retry-After` calculation, and fail-open behavior with no Upstash environment. Do not add a test framework or commit the scratch file.

- [ ] **Step 2: Run the checks to verify they fail**

  Run the temporary check before adding the dependency and utility. Expected: the module/dependency exports are unavailable and no application files are changed beyond the existing feature context and plan.

- [ ] **Step 3: Add the Upstash dependencies and environment documentation**

  Add `@upstash/ratelimit` and `@upstash/redis` with `pnpm add`, update `pnpm-lock.yaml`, and document `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.example` without values.

- [ ] **Step 4: Implement `src/lib/rate-limit.ts`**

  Define the five exact `Ratelimit.slidingWindow` policies, lazily construct `Redis.fromEnv()`/`Ratelimit` instances only when both variables exist, use a bounded Upstash timeout, and catch initialization/request failures as allow decisions. Build keys from the policy name, normalized client IP, and normalized identifier only for login/resend. Convert the Upstash millisecond reset to a minimum-one-second `Retry-After`, format the spec’s minute message, and return a 429 JSON `Response` with that header when `success` is false.

- [ ] **Step 5: Run the checks to verify they pass**

  Re-run the scratch utility checks. Expected: exact policy values, stable normalized keys, correct retry math/message, fail-open without configuration, and no secret/IP/email output.

### Task 2: Protect credentials login and registration

**Files:**
- Modify: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/actions/auth.ts`
- Modify: `src/components/auth/RegisterForm.tsx`

**Interfaces:** Consume `checkAuthRateLimit`, `rateLimitResponse`, and `getRateLimitMessage` from Task 1. Keep existing registration response contracts for non-rate-limited responses and existing `AuthFormState` behavior for the Server Action.

- [ ] **Step 1: Record failing login/registration HTTP checks**

  Create a temporary HTTP check that sends unique-IP requests to registration and `/api/auth/callback/credentials`, confirms the current routes do not return the required 429 contract, and records the existing frontend registration error behavior for a `{ error }` response.

- [ ] **Step 2: Run the checks to verify they fail**

  Start the development server with controlled development settings and run the check. Expected: the new rate-limit assertions fail while existing validation/auth behavior remains observable; do not create or delete development users.

- [ ] **Step 3: Guard the registration route**

  At the beginning of `POST` in `src/app/api/auth/register/route.ts`, call `checkAuthRateLimit("register", request.headers)`. Return `rateLimitResponse` before parsing or touching the database when denied; leave all existing 400/409/201/500 responses unchanged when allowed.

- [ ] **Step 4: Guard direct credentials callbacks**

  Wrap `POST` in `src/app/api/auth/[...nextauth]/route.ts`. Only for the `/api/auth/callback/credentials` pathname, read a clone’s form data to obtain the email without consuming the request, check `"login"` with the request headers and email, and return the shared 429 response before delegating to `handlers.POST`. If the clone cannot be parsed, use the IP plus an empty identifier and let Auth.js retain its normal validation response.

- [ ] **Step 5: Guard the Server Action sign-in path**

  After Zod validation and before `signIn("credentials", ...)` in `src/actions/auth.ts`, read the current request headers with `next/headers`, apply the same `"login"` policy, and return the existing form-state shape with `getRateLimitMessage` when denied. This protects the internal Auth.js call, which does not traverse the exported Route Handler, without double-counting browser sign-ins.

- [ ] **Step 6: Display registration throttling feedback**

  Extend `RegisterForm`’s response parsing to accept the 429 `{ error }` shape and display that message in the existing focusable `role="alert"`; retain the existing generic fallback for malformed/unexpected responses and preserve duplicate-submit prevention.

- [ ] **Step 7: Run the checks to verify they pass**

  Re-run the HTTP/browser checks with unique identifiers. Expected: allowed attempts remain unchanged, the next attempt returns status 429 with the exact JSON error and numeric `Retry-After`, direct and Server Action login paths are guarded, registration shows the user-facing message, and no account is created by throttled requests.

### Task 3: Add rate-limited password and verification API boundaries

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `src/app/api/auth/resend-verification/route.ts`
- Modify: `src/actions/password-reset.ts`
- Modify: `src/actions/email-verification.ts`
- Modify: `src/components/auth/ForgotPasswordForm.tsx`
- Modify: `src/components/auth/ResetPasswordForm.tsx`
- Modify: `src/components/auth/VerificationForm.tsx`

**Interfaces:**
- The three route handlers accept JSON POST bodies and return the existing `{ success, data, error }` state for allowed requests, or the shared `{ error }`/429 contract when denied.
- `POST /api/auth/forgot-password` accepts `{ email }`, remains neutral for every valid email, and uses the `"forgot-password"` IP policy.
- `POST /api/auth/reset-password` accepts `{ token, password, confirmPassword }`, uses the `"reset-password"` IP policy, and preserves the existing generic invalid-token/password behavior.
- `POST /api/auth/resend-verification` accepts `{ email }`, remains neutral for every valid email, and uses the `"resend-verification"` IP-plus-email policy.

- [ ] **Step 1: Record failing route/action/browser checks**

  Extend the temporary checks to call all three routes and existing Server Actions with malformed input, valid unknown input, repeated unique-IP input, mixed-case email input, and valid recovery fixtures. Assert the missing 429 status/header/JSON behavior and current form flows before implementation.

- [ ] **Step 2: Run the checks to verify they fail**

  Run the route and browser checks. Expected: new route contracts are unavailable and existing forms still use their Server Actions; no reset token, password, or verification fixture is consumed by invalid checks.

- [ ] **Step 3: Implement the password-reset route handlers**

  Rate-limit `/forgot-password` and `/reset-password` by IP before expensive parsing/work. Reuse the existing Zod schemas and server-only helpers, keep forgot-password responses neutral for unknown/OAuth-only/provider-failure cases, hash accepted reset passwords at bcrypt cost 12, and return generic errors without exposing tokens or account status.

- [ ] **Step 4: Implement the resend-verification route handler**

  Validate and normalize the email first, rate-limit the IP-plus-email key before calling `requestEmailVerification`, swallow eligibility/delivery failures as the existing neutral success response does, and return the shared 429 response only when the policy denies the request.

- [ ] **Step 5: Guard the retained Server Actions**

  Add the matching checks to `requestPasswordReset`, `completePasswordReset`, and `resendVerificationEmail` using `next/headers`, so direct Server Action invocation cannot bypass the limits. Preserve their current state contracts; return a visible rate-limit error and retry data where each state type supports it, without changing neutral success behavior.

- [ ] **Step 6: Move the three auth forms to the API routes**

  Replace the form submissions with same-origin JSON `fetch` calls, parse the existing success/error shape plus the 429 `{ error }` shape, honor `Retry-After` for the displayed countdown, prevent duplicate submits, and keep the existing focusable `role="alert"`/`role="status"` accessibility behavior. Preserve reset-token removal from browser history and never render the raw token in errors.

- [ ] **Step 7: Run the checks to verify they pass**

  Re-run route, action, and browser checks at desktop and 320px widths. Expected: exact endpoint limits and 429 headers, neutral valid-email feedback, no action/API bypass, preserved one-use reset behavior, visible retry messaging, keyboard-accessible errors, and no raw-token/account-status disclosure.

### Task 4: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `context/current-feature.md`

**Interfaces:** Document the two Upstash variables, the five protected flows, fail-open behavior, and the 429/`Retry-After` contract without documenting secret values.

- [ ] **Step 1: Record the failing documentation/verification checklist**

  Capture the pre-change project checks and confirm the README still says global/per-IP auth rate limiting is deferred. Keep the evidence in `/tmp/opencode/`; do not commit secrets or live identifiers.

- [ ] **Step 2: Update project documentation**

  Add the Upstash environment setup and concise protected-endpoint behavior to the authentication section, replacing the outdated deferred-rate-limiting statement while retaining the existing development-branch and email-delivery warnings.

- [ ] **Step 3: Run the complete acceptance flow**

  With development-only fixtures and unique test identifiers, verify registration, credentials login, forgot password, reset password, and resend verification limits; verify fail-open with Upstash variables absent or unavailable; verify direct route status/headers and frontend messages; and verify existing GitHub OAuth, email verification, password reset lifecycle, redirects, and neutral responses remain intact.

- [ ] **Step 4: Run project verification**

  Run `pnpm lint`, `pnpm build`, `pnpm exec tsc --noEmit`, and `git diff --check`. Inspect the full diff for secret/token/IP/email logging, request-body consumption, client/server boundary violations, double counting, and unrelated changes. No database migration or Neon operation is expected.

- [ ] **Step 5: Record evidence**

  Update `context/current-feature.md` with the verification results, any unavailable live Upstash/inbox evidence, and deferred limitations. Keep status `In Progress` until the user explicitly authorizes feature completion; do not commit automatically.

## Planning Evidence

- Existing registration is already a Route Handler; credentials sign-in through the Server Action invokes Auth.js internally and does not pass through the exported Auth.js Route Handler, so both boundaries need guards.
- Existing forgot-password and resend-verification flows are Server Actions, so dedicated JSON Route Handlers are required to provide the spec’s real 429 status and `Retry-After` contract to browser/API callers.
- Existing auth forms use focusable inline alerts and no toast library; the plan preserves that accessible feedback pattern instead of adding an unrelated dependency.
- Upstash documentation confirms `Ratelimit.slidingWindow`, `Redis.fromEnv`, `limit()` metadata including `remaining`/`reset`, and a configurable timeout that allows requests on timeout; the utility additionally catches unavailable configuration/request errors.
- No database schema change, migration, Neon query, or production operation is needed for this feature.
