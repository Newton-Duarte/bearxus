# Current Feature: Email Verification on Registration

## Status

Complete

## Goals

- When verification is enabled, send a verification email when a user registers with an email and password.
- When verification is enabled, require the user to click the verification link in their email before they can sign in with credentials.
- Mark the user's email as verified after a valid verification link is used.
- Handle invalid, expired, and already-used verification links safely with clear feedback.
- Preserve the existing GitHub OAuth sign-in flow.
- Allow existing unverified email/password test accounts to request a verification email.
- Enforce a 24-hour single-use verification link and a server-side 60-second resend cooldown.
- Return users to normal sign-in after verification; do not automatically sign them in.
- Support server-only `EMAIL_VERIFICATION_ENABLED`, enabled by default. With literal `false`, auto-verify new password registrations without email delivery and auto-verify existing unverified accounts only after a correct password sign-in.

## Notes

- Use Resend to send verification emails.
- The `RESEND_API_KEY` is already available in `.env`; keep it server-side and never expose or commit its value.
- Use `onboarding@resend.dev` as the sender address for now.
- Build on the existing NextAuth, Drizzle, and custom registration/sign-in pages.
- Approved defaults: require verification for existing test accounts without marking them verified in bulk; links expire after 24 hours and work once; sign in normally after verification; resend cooldown is 60 seconds; GitHub remains unchanged.
- Resend's `onboarding@resend.dev` test sender delivers only to the Resend account's own email address. Use that inbox for manual end-to-end acceptance; arbitrary mock addresses cannot receive real messages.
- Implementation branch: `feature/email-verification-on-registration`.
- Implementation plan: `docs/superpowers/plans/2026-10-15-email-verification-on-registration.md`.
- User approved the plan and native implementation on the current branch without a separate worktree.
- Added and applied the generated verification-table migration only to the development database; no users were deleted or bulk-verified.
- Implementation and independent review are finished. The review's resend-response privacy finding was reproduced and fixed, with failure-response equivalence regressions passing.
- Verification: 33 lifecycle, 33 integrated HTTP/Server Action, 6 HTTP, 5 privacy-regression, 66 development browser, and 16 production browser assertions passed with Resend transport stubbed. Build, lint, TypeScript, whitespace checks, and migration-drift checks passed.
- Real inbox delivery/click-through and full real GitHub regression remain user-assisted acceptance items. No actual email delivery is claimed by the automated tests.
- User authorized completion through `/feature complete` on 2026-10-16. Fresh verification and final review passed before integration. No production database operation, agent-run test-account cleanup, or bulk email-verification update occurred.
- Added requested `scripts/cleanup-users.mjs` / `pnpm db:cleanup-users` utility for verification test setup. It previews by default; `--execute` explicitly deletes non-demo users/content in a development-only transaction. Per user clarification, it preserves `demo@bearxus.io` if present but proceeds with a warning if absent, meaning all users/content can be removed. No real deletion was run.
- Cleanup utility verification: 15 CLI/SQL-boundary safety assertions pass with Neon transport simulated, including missing-demo preview/execution and preservation exclusions. Initial independent script/schema review found no Critical, Important, or Minor issues. After the requested missing-demo behavior change, lint and whitespace checks pass and the live read-only preview succeeds (61 removable users; no demo). Live deletion/cascade execution remains deliberately untested because only the script update was authorized.
- Approved follow-up: server-only `EMAIL_VERIFICATION_ENABLED`, safe enabled default; literal `false` skips sending/token issuance, auto-verifies new registrations, and auto-verifies existing unverified accounts only after checking the correct password. UI follows the server's policy. Auto-verified timestamps persist when verification is re-enabled; GitHub is unchanged. No bulk verification or cleanup deletion is part of this change.
- Toggle checklist: [x] failing registration baseline, [x] registration/config/service checks, [x] runtime sign-in checks for enabled/disabled environments, [x] browser flows, [x] independent review, [x] final verification/documentation.
- Toggle verification: 33 registration/config/service assertions (including disabled operation without Resend key or email-link origin), 22 HTTP/auth assertions, and 27 browser assertions against the same production artifact under enabled/disabled server environments passed. Another 7 browser checks passed against the normal unstubbed local app with verification disabled, including real registration, sign-in, and sign-out without email delivery. Enabled lifecycle (33), integrated HTTP/action (33), resend privacy (5), and cleanup safety (15) regressions passed; build/lint/types/whitespace checks passed.
- Toggle review found no blocking issues and one disabled-mode shell-copy inconsistency. Reproduced it, changed the shell copy to be neutral, and verified the regression plus the browser suite. No review findings remain deferred.
- Local `.env` now explicitly sets `EMAIL_VERIFICATION_ENABLED=false`; only this nonsecret setting was added, and the normal development server was restarted on port 3000. `.env.example` documents the safe enabled default. No schema changes, bulk account verification, deletion, commits, pushes, or merges were performed for this follow-up.
- User refinement: when verification is disabled, `/verify-email` redirects to `/sign-in` instead of rendering a disabled-state notice; do not disclose the configuration on that page.
- Redirect refinement verified RED→GREEN: default, sent-status, and invalid-status requests all reach sign-in without a disabled notice. Fresh 27-check production browser suite passes in both modes; build, lint, types, and whitespace checks pass. Normal local `.env` remains disabled and the unstubbed development server stays on port 3000.
- Completion gate (2026-10-16): fresh build, lint, types, whitespace, zero migration drift, 61 backend/lifecycle/config checks, 27 production browser checks across both runtime modes, and 15 simulated cleanup safety checks passed. No cleanup deletion or real email delivery was performed. Local private `.env` remains disabled and is excluded from the commit.
- Final review: no Critical/Important findings. Deferred minor: Resend 6.33.0's SDK logs full provider error objects outside production; those may contain recipient addresses. Application errors remain sanitized, verification URLs are excluded from framework logs, and production SDK logging is disabled by the SDK. Real inbox delivery and full live GitHub OAuth remain unverified.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
- 2026-10-15: Refactored the Drizzle schema into domain modules with co-located relations, preserving the SQL schema and relational query API; verified build, lint, types, and zero migration drift.
- 2026-10-15: Added NextAuth v5 GitHub OAuth with the Drizzle adapter, JWT sessions, session user IDs, and protected dashboard routes; verified build, lint, types, eight HTTP checks, production host setup, independent review, and user-confirmed sign-in/sign-out with repeat-login ID retention.
- 2026-10-15: Added validated email/password registration and Credentials sign-in with bcryptjs, preserving GitHub OAuth and JWT user IDs; fixed case-variant account selection and a Tailwind/Turbopack dashboard reload loop. Verified build, lint, types, 43 HTTP checks, watcher/browser regressions, and user-confirmed GitHub repeat-login ID retention.
- 2026-10-15: Added custom sign-in/registration pages and a responsive sidebar account dropdown with reusable image/initials avatar. Verified build, lint, types, 164 initial browser assertions, 93 post-review/post-merge assertions, independent reviews, and user-confirmed GitHub/credentials acceptance. Deferred inline recovery for interrupted sign-in requests.
