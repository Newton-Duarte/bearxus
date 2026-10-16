# Current Feature: Forgot Password Recovery

<!-- Feature Name -->

## Status

In Progress

## Goals

- Add a visible Forgot password link to the existing credentials sign-in flow.
- Let users request a password-reset email using their email address.
- Send secure, single-use, time-limited reset links without revealing whether an account exists.
- Let users choose and confirm a new password from the reset link.
- Preserve existing GitHub OAuth and credentials authentication behavior.

## Notes

- Implement within the existing Next.js App Router, NextAuth, Drizzle, and Resend patterns.
- Use the existing email delivery configuration and hashed token storage conventions where applicable.
- Validate email and password inputs server-side and provide user-friendly form feedback.
- Default flow assumption: reset links expire after 24 hours and become invalid after successful use.
- Do not add unrelated account-management features.
- Added a separate `password_resets` table with migrations `drizzle/0002_amusing_moondragon.sql` and `drizzle/0003_marvelous_kang.sql`; both applied only to development branch `ep-silent-bird-b59kwhec`.
- Added neutral request/completion Server Actions, Resend reset delivery, responsive forgot/reset pages, single-use atomic token consumption, and the sign-in recovery link/status.
- Verified scratch lifecycle/action/page/integration checks, live unknown-account neutral feedback, invalid-token handling, temporary-fixture reset/replay behavior with original hash restoration, lint, build, TypeScript, whitespace, and zero migration drift. Real inbox delivery remains user-assisted/unverified.
- Hardened delivery failure handling with pending/ready token states, added `no-referrer` reset-page metadata, and rejected unusable tokens before bcrypt work. Deferred uniform timing and callback URL preservation as out of scope for this feature.
- Review hardening added no-store/referrer response headers, reset-route log suppression, browser-history token scrubbing, and controlled unexpected-failure feedback. Global/IP throttling remains a future security-hardening task.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
- 2026-10-15: Refactored the Drizzle schema into domain modules with co-located relations, preserving the SQL schema and relational query API; verified build, lint, types, and zero migration drift.
- 2026-10-15: Added NextAuth v5 GitHub OAuth with the Drizzle adapter, JWT sessions, session user IDs, and protected dashboard routes; verified build, lint, types, eight HTTP checks, production host setup, independent review, and user-confirmed sign-in/sign-out with repeat-login ID retention.
- 2026-10-15: Added validated email/password registration and Credentials sign-in with bcryptjs, preserving GitHub OAuth and JWT user IDs; fixed case-variant account selection and a Tailwind/Turbopack dashboard reload loop. Verified build, lint, types, 43 HTTP checks, watcher/browser regressions, and user-confirmed GitHub repeat-login ID retention.
- 2026-10-15: Added custom sign-in/registration pages and a responsive sidebar account dropdown with reusable image/initials avatar. Verified build, lint, types, 164 initial browser assertions, 93 post-review/post-merge assertions, independent reviews, and user-confirmed GitHub/credentials acceptance. Deferred inline recovery for interrupted sign-in requests.
- 2026-10-16: Added Resend registration verification with hashed 24-hour single-use links, atomic verification, 60-second resend cooldown, neutral recovery responses, configurable automatic verification, and silent disabled-page redirects. Added development-only demo-preserving user cleanup with dry-run default. Verified build, lint, types, zero migration drift, 61 backend checks, 27 browser checks, 15 simulated cleanup safety checks, and independent reviews. Mail transport was stubbed; real inbox delivery, full live GitHub OAuth, and live cleanup execution remain unverified. Deferred minor: Resend SDK provider-error logging in development. Implementation and evidence: docs/superpowers/plans/2026-10-15-email-verification-on-registration.md.
