# Current Feature: Profile Page

## Status

In Progress

## Goals

- Create a protected `/profile` route.
- Display the user’s email, name, avatar, and account creation date.
- Show usage totals for notes, projects, tasks, resources, and transactions.
- Provide a change-password action for email/password users only.
- Provide account deletion with a confirmation dialog.
- Follow existing data-fetching and component patterns.

## Notes

- Use the GitHub avatar when available; otherwise generate initials from the user’s name or email.
- Hide the change-password action for GitHub OAuth users.
- Require confirmation before deleting an account.
- Source spec: `context/features/profile-page-spec.md`.
- Implementation plan: `docs/superpowers/plans/2026-10-16-profile-page.md`.
- Verification: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`, and `git diff --check` pass.
- Browser verification: protected redirect, profile identity/stats, credentials password failure and success, sign-out/sign-in with the updated password, delete confirmation, keyboard focus, and 320px layout passed against a development fixture. Account deletion was not submitted.
- The temporary development credentials fixture remains for review; no production database operation or real account deletion was performed.
- Profile uses Next.js `connection()` to avoid its Cache Components crypto prerender warning. The existing dashboard still shows that pre-existing warning and was not changed.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
- 2026-10-15: Refactored the Drizzle schema into domain modules with co-located relations, preserving the SQL schema and relational query API; verified build, lint, types, and zero migration drift.
- 2026-10-15: Added NextAuth v5 GitHub OAuth with the Drizzle adapter, JWT sessions, session user IDs, and protected dashboard routes; verified build, lint, types, eight HTTP checks, production host setup, independent review, and user-confirmed sign-in/sign-out with repeat-login ID retention.
- 2026-10-15: Added validated email/password registration and Credentials sign-in with bcryptjs, preserving GitHub OAuth and JWT user IDs; fixed case-variant account selection and a Tailwind/Turbopack dashboard reload loop. Verified build, lint, types, 43 HTTP checks, watcher/browser regressions, and user-confirmed GitHub repeat-login ID retention.
- 2026-10-15: Added custom sign-in/registration pages and a responsive sidebar account dropdown with reusable image/initials avatar. Verified build, lint, types, 164 initial browser assertions, 93 post-review/post-merge assertions, independent reviews, and user-confirmed GitHub/credentials acceptance. Deferred inline recovery for interrupted sign-in requests.
- 2026-10-16: Added Resend registration verification with hashed 24-hour single-use links, atomic verification, 60-second resend cooldown, neutral recovery responses, configurable automatic verification, and silent disabled-page redirects. Added development-only demo-preserving user cleanup with dry-run default. Verified build, lint, types, zero migration drift, 61 backend checks, 27 browser checks, 15 simulated cleanup safety checks, and independent reviews. Mail transport was stubbed; real inbox delivery, full live GitHub OAuth, and live cleanup execution remain unverified. Deferred minor: Resend SDK provider-error logging in development. Implementation and evidence: docs/superpowers/plans/2026-10-15-email-verification-on-registration.md.
- 2026-10-16: Added forgot-password recovery with hashed 24-hour single-use tokens, pending/ready delivery gating, neutral recovery responses, Resend email delivery, accessible forgot/reset pages, sign-in integration, token-history/referrer protections, and controlled failure handling. Applied migrations 0002 and 0003 only to development branch `ep-silent-bird-b59kwhec`. Verified lifecycle/action/page/integration checks, development-fixture pending/ready/replay behavior with original hash restoration, review regressions, lint, build, TypeScript, no schema drift, and clean runtime shutdown. Real inbox delivery, global/IP throttling, and callback preservation remain unverified/deferred. Implementation and evidence: `docs/superpowers/plans/2026-10-16-forgot-password-recovery.md`.
