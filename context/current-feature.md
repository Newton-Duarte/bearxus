# Current Feature: UI Component Migration & Audit

## Status

In Progress

## Goals

- Audit and update the targeted authentication pages and modular layout components to use the configured shadcn/ui, Base UI, and `Text` primitives.
- Replace legacy form fields, cards, dialogs, menus, and layout structures with the available core primitives.
- Standardize headings, helper text, labels, copy, and descriptions on the type-safe polymorphic `Text` primitive.
- Ensure custom wrappers, triggers, and external-link mappings use Base UI’s `render` pattern instead of Radix `asChild`.
- Remove residual hardcoded styling hooks and align all components with the custom purple OKLCH light/dark theme tokens.

## Notes

- Targeted pages: sign-in, register, forgot-password, reset-password, verify-email, profile, and dashboard.
- Targeted components: `components/auth/*` forms and shell/field components, plus `ProfileActions`, `UserAvatar`, and `UserMenu`.
- The application uses Next.js v16 and Tailwind CSS v4; do not use legacy `@layer` directives or deprecated utility declarations.
- Approved architecture decision: replace the misleading auth-scoped field with a global `TextField` composite under `src/components/ui/`, built from the existing `Input`, `Label`, and `Text` primitives; keep `Input` as the low-level control and reserve a future generic `Field` composition for non-text controls.
- Implementation plan: `docs/superpowers/plans/2026-10-17-ui-component-migration.md`.
- Implementation and verification evidence: added global `TextField`, removed the obsolete `AuthField`, migrated auth/profile/dashboard consumers to Base UI/shadcn primitives and `Text`, replaced native profile dialogs and account menu, fixed Base UI native-button menu composition, removed the legacy `auth-link`/`@layer` styling hooks, and verified `pnpm lint`, TypeScript, production build, `git diff --check`, auth route rendering, field ID/ARIA behavior, 320px overflow, dropdown keyboard focus, dialog focus/escape behavior, sign-out, protected redirects, and light/dark token interpolation. Protected interaction checks used a synthetic development account on the development server; account deletion was not executed. The production server’s registration endpoint used the repository’s placeholder production database and returned 500, so authenticated checks were run only against development. The existing dashboard `crypto.getRandomValues()` prerender warning remains deferred.

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
- 2026-10-16: Added Upstash Redis sliding-window rate limiting with fail-open behavior for registration, credentials login, password recovery, and verification resend; added 429/`Retry-After` API responses, protected retained Server Actions, and accessible frontend retry feedback. Denied requests use the configured full cooldown (15 minutes or 60 minutes) rather than the remaining sliding-window bucket. Verified live development HTTP/browser limits, neutral responses, mixed-case key normalization, fail-open behavior, cooldown messages/countdowns, lint, build, TypeScript, and diff checks. No database migration was needed; real provider delivery and production Upstash behavior remain unverified.
- 2026-10-17: Configured shadcn/ui `base-nova` with Base UI, added the generated Button component and `render`-compatible composition, consolidated global Tailwind v4 theme tokens, migrated auth actions, and added accessible purple light/dark OKLCH palettes. Verified shadcn configuration, lint, TypeScript, production build, browser theme switching, contrast ratios, and diff checks.
- 2026-10-17: Added the Base UI `base-nova` core primitives and a type-safe polymorphic `Text` primitive with semantic heading fallbacks and CVA typography variants. Verified TypeScript, lint, production build, browser sign-in smoke with zero console errors, diff checks, and no legacy `asChild` usage.
