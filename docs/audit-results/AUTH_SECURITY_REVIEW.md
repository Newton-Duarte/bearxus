# Authentication Security Review

Last audit date: 2026-10-16

## Scope and Method

Inspected the authentication provider and callbacks, Credentials and GitHub sign-in, registration, password change and deletion, email verification, password recovery, rate-limit enforcement, protected profile routing, authentication forms, schema, migrations, environment example, and deployment documentation. Used repository Glob, Grep, and Read discovery/inspection. No dependency behavior requiring external documentation was relied upon.

## Executive Summary

One confirmed MEDIUM-severity issue: rate limiting is fail-open, so absent Upstash configuration or a Redis error disables all application rate limits on sensitive unauthenticated paths. No other confirmed issues were found in the reviewed scope.

## Findings

### [MEDIUM] Authentication rate limits are bypassed when Upstash is unconfigured or unavailable

- **Evidence:** `src/lib/rate-limit.ts:41-42,61-67,73-94`; reachable consumers include `src/actions/auth.ts:28-31`, `src/app/api/auth/[...nextauth]/route.ts:7-20`, and the registration, recovery, reset, and resend routes. Missing either Upstash environment variable returns `null` and `checkAuthRateLimit` returns an allow decision; any limiter exception also returns an allow decision. `README.md:84-86` documents this fail-open behavior.
- **Why this is an actual issue:** An unauthenticated attacker can repeatedly invoke the credentials callback to guess passwords, and can repeatedly trigger registration or email delivery endpoints, whenever configuration is missing or Upstash is unavailable. These requests are accepted without a distributed limit; repeated password guesses enable account compromise when a password is guessed, while repeated mail requests can cause unwanted delivery and provider cost. The paths are directly reachable and the absent-enforcement branch is explicit in code.
- **Impact:** Increased risk of credentials account takeover and authentication/email abuse during misconfiguration or provider outages.
- **Specific fix:** Fail closed for credential attempts when the shared limiter cannot be initialized or reached, and provide a production startup/readiness check requiring both Upstash settings. For availability-sensitive email actions, use a durable local/shared fallback limiter rather than allowing unlimited requests.
- **Validation:** With each Upstash variable missing in turn and with limiter calls forced to throw, verify credentials, registration, forgot-password, reset-password, and resend-verification requests are rejected or constrained rather than receiving an allow decision. Confirm normal distributed limits still work when Upstash is healthy.

## Passed Checks

- Registration, credential sign-in, password reset, and password change validate password inputs; registration/reset/change hash new passwords with bcrypt cost 12, and credential login compares against the stored hash. Oversized UTF-8 password input is rejected by `src/lib/auth-validation.ts:3-9`.
- Registration returns only selected safe user fields and protects duplicate creation with a database unique constraint plus `onConflictDoNothing` (`src/app/api/auth/register/route.ts:37-55`). Invalid credentials and OAuth-only users without password hashes do not authenticate (`src/auth.ts:26-31`).
- Credentials sign-in is rate-limited at both the Server Action and the actual NextAuth credentials callback route (`src/actions/auth.ts:28-31`; `src/app/api/auth/[...nextauth]/route.ts:7-20`). The configured Upstash windows and key normalization are implemented in `src/lib/rate-limit.ts:6-11,69-90`; availability/failure behavior is the finding above.
- Verification and reset tokens use 32 cryptographically random bytes, store SHA-256 hashes, and enforce expiry during server-side consumption. Verification consumes the token and marks the eligible account verified in one database statement (`src/lib/email-verification.ts:39-40,70-85`); reset consumption and password update share a database CTE (`src/lib/password-reset.ts:40-41,75-111`).
- Verification and reset email requests use neutral responses; delivery is gated before a reset token becomes usable, and failed verification delivery invalidates its token (`src/lib/password-reset.ts:49-72`; `src/lib/email-verification.ts:48-66`; route response handling).
- Profile reads and mutations derive the user ID from the server session. Password change verifies the current password and scopes its update to that session user; account deletion is likewise scoped to that ID (`src/actions/profile.ts:16-47,59-67`; `src/app/profile/page.tsx:25-35`).
- The profile page performs its own server-side session check; dashboard protection is enforced in the proxy (`src/app/profile/page.tsx:25-35`; `src/proxy.ts:8-19`).
- NextAuth-managed CSRF protection, cookie flags/transport defaults, and OAuth state/anti-CSRF are explicitly excluded from findings; no application-level defect in those managed protections was asserted.

## Out of Scope / Unverified

- Production environment configuration and live Upstash outage behavior were not exercised; the reported fail-open behavior is established directly by the repository code.
- Real Resend inbox delivery and production provider configuration were not exercised.
- NextAuth-managed CSRF, cookie flags, and OAuth state are managed protections and were not independently audited or reported as application findings.
