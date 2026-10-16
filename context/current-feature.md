# Current Feature: Rate Limiting for Auth

## Status

In Progress

## Goals

- Add serverless-compatible rate limiting to the authentication endpoints.
- Use Upstash Redis with `@upstash/ratelimit` and a reusable `src/lib/rate-limit.ts` utility.
- Apply the specified sliding-window limits keyed by IP and, where applicable, email.
- Return `429 Too Many Requests` responses with a user-friendly error, `Retry-After`, and rate-limit metadata.
- Display rate-limit errors clearly on the frontend.
- Fail open when Upstash is unavailable.

## Notes

- Protect `/api/auth/callback/credentials` (5 attempts/15 minutes, IP + email), `/api/auth/register` (3/hour, IP), `/api/auth/forgot-password` (3/hour, IP), `/api/auth/reset-password` (5/15 minutes, IP), and `/api/auth/resend-verification` (3/15 minutes, IP + email).
- Extract IP from `x-forwarded-for` or the request and combine it with email identifiers where specified.
- Required environment variables: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- NextAuth credentials login may require a custom sign-in handler; middleware is a possible later refinement.
- 2026-10-16 implementation: added lazy Upstash sliding-window limiting with fail-open behavior, IP/email keys, 429 JSON responses, and `Retry-After` headers for registration, credentials login, password recovery, and verification resend. Added JSON recovery/verification route boundaries and migrated the three forms to accessible fetch-based feedback while retaining Server Action guards.
- 2026-10-16 verification: utility contract checks, live development Upstash HTTP limit checks, neutral unknown-email responses, mixed-case email bucket checks, unavailable-Upstash fail-open checks, desktop/320px browser checks, `pnpm lint`, `pnpm build`, `pnpm exec tsc --noEmit`, and `git diff --check` are passing. No database migration or Neon operation was needed. Real provider delivery and production Upstash behavior remain unverified.
- 2026-10-16 follow-up: Upstash sliding-window bucket resets could report only the remaining portion of a policy window (for example, 10 of 15 minutes). Denied decisions now expose the configured full cooldown for user messaging, `Retry-After`, and frontend countdowns: 15 minutes for login/reset/resend and 60 minutes for registration/forgot-password.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
- 2026-10-15: Refactored the Drizzle schema into domain modules with co-located relations, preserving the SQL schema and relational query API; verified build, lint, types, and zero migration drift.
- 2026-10-15: Added NextAuth v5 GitHub OAuth with the Drizzle adapter, JWT sessions, session user IDs, and protected dashboard routes; verified build, lint, types, eight HTTP checks, production host setup, independent review, and user-confirmed sign-in/sign-out with repeat-login ID retention.
- 2026-10-15: Added validated email/password registration and Credentials sign-in with bcryptjs, preserving GitHub OAuth and JWT user IDs; fixed case-variant account selection and a Tailwind/Turbopack dashboard reload loop. Verified build, lint, types, 43 HTTP checks, watcher/browser regressions, and user-confirmed GitHub repeat-login ID retention.
- 2026-10-15: Added custom sign-in/registration pages and a responsive sidebar account dropdown with reusable image/initials avatar. Verified build, lint, types, 164 initial browser assertions, 93 post-review/post-merge assertions, independent reviews, and user-confirmed GitHub/credentials acceptance. Deferred inline recovery for interrupted sign-in requests.
- 2026-10-16: Added Resend registration verification with hashed 24-hour single-use links, atomic verification, 60-second resend cooldown, neutral recovery responses, configurable automatic verification, and silent disabled-page redirects. Added development-only demo-preserving user cleanup with dry-run default. Verified build, lint, types, zero migration drift, 61 backend checks, 27 browser checks, 15 simulated cleanup safety checks, and independent reviews. Mail transport was stubbed; real inbox delivery, full live GitHub OAuth, and live cleanup execution remain unverified. Deferred minor: Resend SDK provider-error logging in development. Implementation and evidence: docs/superpowers/plans/2026-10-15-email-verification-on-registration.md.
- 2026-10-16: Added forgot-password recovery with hashed 24-hour single-use tokens, pending/ready delivery gating, neutral recovery responses, Resend email delivery, accessible forgot/reset pages, sign-in integration, token-history/referrer protections, and controlled failure handling. Applied migrations 0002 and 0003 only to development branch `ep-silent-bird-b59kwhec`. Verified lifecycle/action/page/integration checks, development-fixture pending/ready/replay behavior with original hash restoration, review regressions, lint, build, TypeScript, no schema drift, and clean runtime shutdown. Real inbox delivery, global/IP throttling, and callback preservation remain unverified/deferred. Implementation and evidence: `docs/superpowers/plans/2026-10-16-forgot-password-recovery.md`.
- 2026-10-16: Added the protected `/profile` page with account identity, GitHub-or-initials avatar fallback, account creation date, five user-scoped usage stats, credentials-only password changes, and accessible modal account deletion confirmation. Verified lint, TypeScript, production build, diff checks, protected redirects, live development-fixture password lifecycle, sign-out/sign-in, responsive 320px layout, keyboard focus, and no profile console errors. Account deletion was not executed; the existing dashboard crypto prerender warning remains deferred.
- 2026-10-16: Refined the profile password-change UX to match the existing auth forms: generic errors are top-of-form focusable alerts, controlled fields preserve values across validation/server errors, sensitive values clear when the dialog closes, and modal scroll chaining is contained. Verified browser preservation/error checks, lint, TypeScript, production build, and diff checks.
