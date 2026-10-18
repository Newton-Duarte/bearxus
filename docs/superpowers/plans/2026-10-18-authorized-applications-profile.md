# Authorized Applications Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected `/profile` section that shows GitHub’s OAuth authorization state and lets users connect or safely disconnect it.

**Architecture:** Keep profile/account metadata in the existing server-side `getProfileData` query, exposing only provider status and whether disconnecting is allowed. Add authenticated Server Actions for starting the existing Auth.js GitHub flow and atomically removing the user’s GitHub account only when a password or another OAuth provider remains. Render the interactive connect/disconnect controls in a focused client component using the existing Base UI card, button, and dialog primitives.

**Tech Stack:** Next.js 16 App Router, React 19 Server Actions, Auth.js v5, Drizzle ORM with Neon HTTP, TypeScript, Tailwind CSS v4, Base UI/shadcn primitives, Vitest.

**Spec:** `context/current-feature.md`

## Global Constraints

- GitHub is the only supported OAuth provider today.
- Match the existing dark-first profile UI and shared shadcn/Base UI styling.
- This feature should not require a database schema change.
- Keep account linking within the existing authentication flow and do not enable `allowDangerousEmailAccountLinking`.
- Every Server Action must verify the authenticated session and user ownership server-side.
- OAuth tokens and provider account identifiers must not be sent to the client.
- Do not commit without explicit user permission.

## Review Focus

- Direct unauthenticated calls to connect or unlink must not mutate accounts and must return/redirect safely; test in the Server Action test task.
- A GitHub-only account must not be unlinkable, including through a direct crafted Server Action request; test the guarded delete result in the Server Action test task.
- A GitHub account must be unlinkable when a password or another OAuth provider remains; test both alternatives in the Server Action test task.
- An OAuth account already associated with another user must preserve Auth.js `OAuthAccountNotLinked` protection and show a safe profile error; test the connect error mapping in the Server Action test task.
- OAuth cancellation/provider failures and pending dialog submissions must not leave the controls ambiguous or expose raw errors; cover error mapping in the Server Action test task and verify pending/accessible UI behavior manually.

---

### Task 1: Expose Safe Authorized-Application Metadata

**Files:**
- Modify: `src/types/profile.ts`
- Modify: `src/lib/profile.ts`
- Test: `src/lib/profile.test.ts`

**Interfaces:**
- Produces `AuthorizedApplication` with `provider: "github"`, `connected: boolean`, and `canDisconnect: boolean`.
- Produces `ProfileData.authorizedApplications: AuthorizedApplication[]`.
- Keeps `ProfileData.user.canChangePassword` as the password-availability signal.

- [ ] **Step 1: Write failing profile-data tests**

  Extend the existing Drizzle mocks for the `accounts` table and add assertions that `getProfileData("user-1")` reports:
  - GitHub unlinked and not disconnectable when the user has no OAuth account and no password.
  - GitHub linked and disconnectable when the user has a password.
  - GitHub linked and not disconnectable when it is the only linked OAuth provider and no password exists.
  - GitHub linked and disconnectable when another OAuth provider is present, even without a password.

  Update the missing-user assertion for the additional account query without changing the existing user-scoping assertions.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm exec vitest run src/lib/profile.test.ts`

  Expected: FAIL because the profile data contract does not yet expose authorized applications.

- [ ] **Step 3: Implement the profile metadata contract**

  Add the `AuthorizedApplication` type and return one GitHub entry from `getProfileData`. Query only `accounts.provider` for the authenticated user, derive `connected` from the GitHub provider row, and derive `canDisconnect` from `passwordHash !== null` or the presence of any non-GitHub provider. Do not select token columns or provider account IDs.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm exec vitest run src/lib/profile.test.ts`

  Expected: PASS.

### Task 2: Add Secure Connect and Disconnect Server Actions

**Files:**
- Modify: `src/types/profile.ts`
- Modify: `src/actions/profile.ts`
- Test: `src/actions/profile.test.ts`

**Interfaces:**
- Consumes `AuthorizedApplication` metadata from Task 1 only through the UI; the actions independently re-check authorization.
- Produces `connectGitHub(): Promise<void>`.
- Produces `unlinkGitHub(previous: UnlinkGitHubState, formData: FormData): Promise<UnlinkGitHubState>`.
- Produces `UnlinkGitHubState` and `initialUnlinkGitHubState` in `src/types/profile.ts`.

- [ ] **Step 1: Write failing Server Action tests**

  Extend the existing action mocks and add tests that assert:
  - `connectGitHub` redirects an expired session to `/sign-in?callbackUrl=%2Fprofile` without calling Auth.js `signIn`.
  - `connectGitHub` calls `signIn("github", { redirectTo: "/profile" })` for an authenticated session.
  - Auth.js `OAuthAccountNotLinked` is mapped to a safe `/profile?error=OAuthAccountNotLinked` redirect while non-Auth errors are rethrown.
  - `unlinkGitHub` returns a session-expired error without querying or deleting for an unauthenticated request.
  - A successful delete returns `{ success: true, error: null }` and revalidates `/profile`.
  - A delete that returns no GitHub row returns a controlled error; the server-side delete predicate must require either a non-null password hash or a non-GitHub account, so a GitHub-only account cannot be removed.
  - Database failures return a controlled error rather than leaking the exception.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm exec vitest run src/actions/profile.test.ts`

  Expected: FAIL because the new action exports and state type do not exist.

- [ ] **Step 3: Implement `connectGitHub`**

  In `src/actions/profile.ts`, verify `auth()` first, then call the existing Auth.js `signIn` export with the GitHub provider and `/profile` redirect. Preserve framework redirect errors, map `OAuthAccountNotLinked` and other Auth.js failures to an allowlisted profile error query, and never enable automatic email-based account linking.

- [ ] **Step 4: Implement `unlinkGitHub` with an atomic guarded delete**

  Verify the session, then delete only the current user’s `accounts` row for `provider = "github"`. Because the project uses Neon HTTP and should not introduce an interactive transaction, put the alternative-sign-in requirement into the single SQL `DELETE ... WHERE` predicate: allow deletion only when the current user has a non-null password hash or another provider row. Use `returning` to distinguish a successful unlink from a missing/guarded row, call `revalidatePath("/profile")` after success, and return neutral typed errors for expired sessions, blocked unlinking, and database failures.

- [ ] **Step 5: Run the focused test to verify it passes**

  Run: `pnpm exec vitest run src/actions/profile.test.ts`

  Expected: PASS.

### Task 3: Build the Authorized Applications Profile UI

**Files:**
- Create: `src/components/profile/AuthorizedApplications.tsx`
- Modify: `src/app/profile/page.tsx`

**Interfaces:**
- Consumes `AuthorizedApplication` metadata and an optional safe profile error message.
- Uses `connectGitHub`, `unlinkGitHub`, and `initialUnlinkGitHubState` from Task 2.
- Renders a GitHub row with connect, connected, and guarded disconnect states.

- [ ] **Step 1: Implement the focused client component**

  Build the section with the exact heading **“Authorized applications”** and description **“OAuth applications you've approved”**. Always render the supported GitHub row. Use an accessible GitHub mark, status text, a pending-aware **Connect GitHub** form button when unlinked, and a connected state when linked. When `canDisconnect` is false, explain that a password or another provider is required instead of offering an unsafe disconnect action.

- [ ] **Step 2: Add the disconnect confirmation dialog**

  Reuse the existing Base UI `Dialog` and `DialogFooter` primitives. The dialog must explain that disconnecting removes GitHub as a sign-in method, provide a cancel action, submit `unlinkGitHub` only after confirmation, disable the submit button while pending, and expose returned errors with `role="alert"`. Refresh the profile data after a successful unlink so the row returns to the connect state.

- [ ] **Step 3: Integrate the section and safe OAuth errors into `/profile`**

  Pass the server-derived GitHub metadata from `ProfileSession` into `AuthorizedApplications`. Accept the profile page’s `searchParams` and map only known Auth.js connection errors to user-facing messages, including a specific safe explanation for `OAuthAccountNotLinked`; do not render arbitrary query-string values. Place the section between workspace activity and account security with the existing separator/layout rhythm.

- [ ] **Step 4: Run lint and type checking for the UI**

  Run: `pnpm lint && pnpm exec tsc --noEmit`

  Expected: PASS with no unused imports, unsafe types, or Server/Client boundary errors.

### Task 4: Verify the Complete Feature

**Files:**
- Verify: `src/lib/profile.test.ts`
- Verify: `src/actions/profile.test.ts`
- Verify: `src/types/profile.ts`
- Verify: `src/lib/profile.ts`
- Verify: `src/actions/profile.ts`
- Verify: `src/components/profile/AuthorizedApplications.tsx`
- Verify: `src/app/profile/page.tsx`

- [ ] **Step 1: Run the full unit suite**

  Run: `pnpm test`

  Expected: all existing and new Vitest tests pass.

- [ ] **Step 2: Run the production build**

  Run: `pnpm build`

  Expected: the Next.js 16 production build completes successfully without schema or route errors.

- [ ] **Step 3: Verify the protected browser flow**

  Start the app with `pnpm dev` and verify in a browser:
  - An unauthenticated visit to `/profile` still redirects to sign-in.
  - An authenticated credentials user sees the Authorized applications heading, GitHub row, and Connect GitHub action.
  - A linked GitHub user sees Connected and the confirmation dialog.
  - A GitHub-only user cannot disconnect and sees the remaining-sign-in-method explanation.
  - A user with a password or another provider can confirm disconnect and sees the row return to Connect GitHub.
  - Keyboard focus is trapped and restored by the confirmation dialog, pending buttons are disabled, and no console errors occur.

- [ ] **Step 4: Review the diff and feature status**

  Run: `git diff --check && git status --short`

  Confirm there is no migration file, no exposed OAuth token data, and no unrelated refactor. Do not commit until the user explicitly authorizes it.

---

## Approved Amendment: Provider Extensibility and Connected-Row Layout

The feature remains GitHub-only, but the implementation should not encode GitHub into the profile data contract, action API, or list rendering. The connected row should match the approved reference: the purple **Connected** label appears inline in `Connected to your Bearxus account.`, and the right side contains only the **Disconnect GitHub** action.

### Task 5: Introduce an Allowlisted OAuth Provider Registry

**Files:**
- Create: `src/lib/oauth-providers.ts`
- Modify: `src/types/profile.ts`
- Modify: `src/lib/profile.ts`
- Modify: `src/actions/profile.ts`
- Modify: `src/lib/profile-errors.ts`
- Tests: `src/lib/oauth-providers.test.ts`, `src/lib/profile.test.ts`, `src/actions/profile.test.ts`, `src/lib/profile-errors.test.ts`

**Interfaces:**
- Produces `OAuthProviderId`, `OAUTH_PROVIDERS`, `OAUTH_PROVIDER_IDS`, `isOAuthProviderId`, and provider display metadata; the registry contains only `github` for now.
- `AuthorizedApplication.provider` becomes `OAuthProviderId`.
- Produces `connectOAuthProvider(provider, formData)` and `unlinkOAuthProvider(provider, previous, formData)` with allowlist validation.

- [ ] **Step 1: Write failing registry and generic-action tests**

  Test allowlisted GitHub recognition, rejection of unknown provider values, provider-derived profile rows, generic connect behavior, generic unlink behavior, and provider-aware error copy. Preserve the existing last-sign-in-method assertions.

- [ ] **Step 2: Run focused tests to verify they fail**

  Run: `pnpm exec vitest run src/lib/oauth-providers.test.ts src/lib/profile.test.ts src/actions/profile.test.ts src/lib/profile-errors.test.ts`

  Expected: FAIL because the registry and generic action interfaces do not yet exist.

- [ ] **Step 3: Implement the provider registry and generic data/actions**

  Derive profile application rows from `OAUTH_PROVIDER_IDS`, calculate alternative sign-in availability from the password or any other linked account, validate provider inputs server-side, and parameterize the guarded unlink action by provider. Keep Auth.js automatic linking safeguards unchanged.

- [ ] **Step 4: Run focused and full tests**

  Run: `pnpm exec vitest run src/lib/oauth-providers.test.ts src/lib/profile.test.ts src/actions/profile.test.ts src/lib/profile-errors.test.ts && pnpm test`

  Expected: all focused and full tests pass.

### Task 6: Render All Authorized Applications and Refine the Connected Row

**Files:**
- Modify: `src/components/profile/AuthorizedApplications.tsx`
- Modify: `src/app/profile/page.tsx`

**Interfaces:**
- Consumes the full `AuthorizedApplication[]` list and provider display metadata from Task 5.
- Renders one provider row per allowlisted provider without a GitHub-only lookup or redirect fallback.

- [ ] **Step 1: Render the provider list through a stable row component**

  Map the application array into provider rows. Keep provider-specific icon handling explicit and statically analyzable. Use generic connect/disconnect action bindings while validating provider IDs on the server.

- [ ] **Step 2: Match the approved connected layout**

  Put the purple **Connected** label inline before `Connected to your Bearxus account.` in the description. Remove the separate stacked Connected status and leave only the Disconnect button on the right; retain the explanatory no-disconnect copy when no alternate sign-in method exists.

- [ ] **Step 3: Run UI verification**

  Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm build`.

  Verify the unlinked and connected layouts at desktop and 320px widths, including keyboard dialog behavior and safe OAuth errors.
