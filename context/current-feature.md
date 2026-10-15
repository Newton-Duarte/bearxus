# Current Feature: Auth UI - Sign In, Register & Sign Out

## Status

Complete

## Goals

- Replace the default NextAuth sign-in page with a custom `/sign-in` page offering email/password sign-in, GitHub sign-in, a registration link, form validation, and error display.
- Add a `/register` page with name, email, password, and confirm-password fields; validate email format and matching passwords, submit to `/api/auth/register`, and redirect to sign-in on success.
- Update the bottom of the sidebar to display the signed-in user's avatar, name, and email.
- Create a reusable avatar component that uses the user's GitHub image when available and otherwise displays initials derived from their name.
- Clicking the sidebar avatar opens a dropdown with Profile (`/profile`), Settings (`/settings`), and Sign out.
- Verify custom page rendering, GitHub and credentials sign-in, avatar rendering, dropdown behavior, sign-out and redirect, and successful registration followed by a sign-in redirect.

## Notes

- Source spec: `context/features/auth-phase-3-spec.md`.
- Preserve the existing NextAuth GitHub OAuth, credentials authentication, and registration endpoint.
- Sidebar visual reference: `context/screenshots/bearxus-sidebar-example.jpg` (the source spec includes an extra `src/` prefix).
- Avatar fallback example: "Newton Duarte" → "ND".
- User clarification: the sidebar avatar opens a dropdown containing Profile, Settings, and Sign out. Profile navigation belongs in that dropdown, not directly on the avatar.
- Use the sidebar placement from the requirements and supplied screenshot, not the top-bar placement mentioned in the test list.
- The current dashboard is a session-check placeholder with no sidebar. Add the minimal sidebar/account area for this phase; Profile and Settings menu links do not include building those pages or unrelated workspace features.
- Branch: `feature/auth-ui-sign-in-register-sign-out`.
- Implementation plan: `docs/superpowers/plans/2026-10-15-auth-phase-3.md`.
- Implemented natively on the existing branch: custom auth pages, validated forms, protected custom redirects, reusable avatar, and sidebar account dropdown.
- Verification: build, lint, TypeScript, whitespace checks, 116 development browser assertions, and 48 local production-build assertions passed. Independent review findings fixed with failing-then-passing regressions for registration restoration, unique field IDs, and encoded callback queries.
- User-confirmed acceptance: real GitHub sign-in/sign-out/repeat sign-in preserves avatar/details and the same user ID. The user also confirmed creating and signing in with a separate demo credentials account. Credentials are intentionally not recorded here.
- Requested pre-completion review: no blocking findings, missing approved goals, or scope creep. Fresh build, lint, TypeScript, whitespace checks, and 93 browser assertions passed; manual acceptance is recorded above. User subsequently authorized completion via `/feature complete`.
- Nonblocking review finding: a failed sign-in Server Action transport request uses Next.js global error recovery rather than an inline retry message (`src/components/auth/SignInForm.tsx`). Reproduced by aborting the POST; deferred without product changes during this review.
- No schema changes, production database operations, or data deletions. Test accounts and scratch evidence are retained in development/local storage.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
- 2026-10-15: Refactored the Drizzle schema into domain modules with co-located relations, preserving the SQL schema and relational query API; verified build, lint, types, and zero migration drift.
- 2026-10-15: Added NextAuth v5 GitHub OAuth with the Drizzle adapter, JWT sessions, session user IDs, and protected dashboard routes; verified build, lint, types, eight HTTP checks, production host setup, independent review, and user-confirmed sign-in/sign-out with repeat-login ID retention.
- 2026-10-15: Added validated email/password registration and Credentials sign-in with bcryptjs, preserving GitHub OAuth and JWT user IDs; fixed case-variant account selection and a Tailwind/Turbopack dashboard reload loop. Verified build, lint, types, 43 HTTP checks, watcher/browser regressions, and user-confirmed GitHub repeat-login ID retention.
