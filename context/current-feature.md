# Current Feature: Auth Setup - NextAuth + GitHub Provider

## Status

Complete

## Goals

- Install NextAuth v5 (`next-auth@beta`) and `@auth/drizzle-adapter`.
- Configure GitHub OAuth using split auth configuration for edge compatibility, a Drizzle adapter, and JWT sessions.
- Add the auth API route and extend the Session type with `user.id`.
- Protect `/dashboard/*` using Next.js 16 proxy, redirecting unauthenticated users to the default NextAuth sign-in page.
- Verify GitHub sign-in returns the user to `/dashboard` after authentication.

## Notes

- Source spec: `context/features/auth-phase-1-spec.md`.
- Branch: `feature/auth-setup-nextauth-github`.
- Implementation plan: `docs/superpowers/plans/2026-10-15-auth-phase-1.md`.
- Use Context7 to verify current configuration and conventions before implementation; read relevant installed Next.js documentation.
- Create `src/auth.config.ts` with providers only (no adapter), and `src/auth.ts` with the full Drizzle adapter configuration and `session: { strategy: 'jwt' }`.
- Create `src/app/api/auth/[...nextauth]/route.ts` to export auth handlers and `src/types/next-auth.d.ts` to extend Session.
- Place the proxy at `src/proxy.ts`, alongside `app/`, using the named export `export const proxy = auth(...)`.
- Use NextAuth's default pages for testing; do not configure custom `pages.signIn`.
- Required environment variables: `AUTH_SECRET`, `AUTH_GITHUB_ID`, and `AUTH_GITHUB_SECRET`.
- Browser verification: visit `/dashboard`, confirm the sign-in redirect, sign in with GitHub, and confirm the return to `/dashboard`.
- References: https://authjs.dev/getting-started/installation#edge-compatibility and https://authjs.dev/getting-started/adapters/drizzle.
- Implementation added; lint, TypeScript, build, and eight HTTP checks passed. Browser verified the default sign-in redirect and GitHub OAuth handoff.
- User confirmed real GitHub sign-in, dashboard return, and the same database user ID after signing out and signing in again. Auth acceptance checks are satisfied; completion requested.
- Independent review found no critical issues; its production host setup documentation finding is addressed with `AUTH_URL` instructions and an environment example. No outstanding code findings.
- User reported a hydration warning whose diff shows browser-injected `<body>` attributes (`data-new-gr-c-s-check-loaded`, `data-gr-ext-installed`, `cz-shortcut-listen`), absent from application source. Check with extensions disabled before considering application changes; do not suppress the warning globally.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
- 2026-10-15: Refactored the Drizzle schema into domain modules with co-located relations, preserving the SQL schema and relational query API; verified build, lint, types, and zero migration drift.
