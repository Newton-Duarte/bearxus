# Current Feature: Auth Credentials - Email/Password Provider

## Status

Complete

## Goals

- Add email/password authentication with a Credentials provider while preserving GitHub OAuth.
- Ensure the User model has a password field; add it through a migration if needed.
- Add a placeholder Credentials provider in `auth.config.ts` and override it in `auth.ts` with bcryptjs password validation.
- Create `POST /api/auth/register` accepting name, email, password, and confirmPassword.
- Validate matching passwords, check for existing users, hash passwords with bcryptjs, create users, and return success/error responses.
- Verify registration via curl, email/password sign-in at `/api/auth/signin`, redirect to `/dashboard`, and continued GitHub OAuth functionality.

## Notes

- Source spec: `context/features/auth-phase-2-spec.md`.
- Use `bcryptjs` for password hashing.
- Preserve the split auth configuration pattern: `authorize: () => null` in `auth.config.ts`, with actual bcrypt validation in `auth.ts`.
- Perform all database operations on the development branch (`ep-silent-bird-b59kwhec`); production is off limits unless explicitly requested.
- Credentials provider reference: https://authjs.dev/getting-started/authentication/credentials
- Branch: `feature/auth-credentials-email-password`.
- Implementation plan: `docs/superpowers/plans/2026-10-15-auth-phase-2.md` (approved; implemented natively).
- Before implementation: `users.passwordHash` already existed in the schema and initial migration; bcryptjs was missing and Zod was transitive only. Both are now direct dependencies.
- Added bcryptjs/Zod dependencies, validated registration, and Credentials sign-in while retaining GitHub OAuth and JWT session IDs. No schema or migration changes.
- Verification: 43 development HTTP/database checks, browser credentials login/sign-out/repeat-login ID retention, production sign-in checks, build, lint, and TypeScript passed.
- Independent review found one account-selection ambiguity; reproduced it with case-variant users and fixed credentials lookup to use exact equality against normalized lowercase email. Three regression checks passed. No deferred minor findings.
- Fresh production checks passed; stale dev hot-reload metadata omitted credential fields until the dev server was restarted. The full development HTTP suite then passed without further product changes.
- Acceptance confirmed by the user: real GitHub login → sign out → login again retains the same user ID. All acceptance checks are satisfied; the user authorized `/feature complete`.
- Final completion verification passed build, lint, non-incremental TypeScript, 43 HTTP checks, the Tailwind watcher regression, and whitespace checks. Verification scripts and development-only test users are retained. Application rate limiting, registration UI, email verification/reset, and account linking remain outside this phase.
- Local dashboard reload-loop fix: Tailwind's repository-wide automatic scan registered generated log/browser artifact directories as Turbopack dependencies. Restricted `src/app/globals.css` scanning to `src/` with `source("../")`; restarted the dev server to clear old watches and moved dev output to `/tmp/opencode/bearxus-auth-phase2-dev.log`.
- Reload regression: reproduced 40 document requests in five seconds before the fix, then zero after the fix, including while writing three runtime artifact changes. Loader verification confirms only app source directories are watched and dashboard utilities are still generated. Authentication/session redirects were not the cause.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
- 2026-10-15: Refactored the Drizzle schema into domain modules with co-located relations, preserving the SQL schema and relational query API; verified build, lint, types, and zero migration drift.
- 2026-10-15: Added NextAuth v5 GitHub OAuth with the Drizzle adapter, JWT sessions, session user IDs, and protected dashboard routes; verified build, lint, types, eight HTTP checks, production host setup, independent review, and user-confirmed sign-in/sign-out with repeat-login ID retention.
