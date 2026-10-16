# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected `/profile` page that presents account identity, user-owned usage totals, password management for credentials users, and safe account deletion.

**Architecture:** Keep the profile route as an authenticated Server Component that loads the user and five scoped aggregate counts in parallel through a server-only profile data helper. Keep mutations in authenticated Server Actions, with a focused client component providing the password form and native confirmation dialogs. Reuse the existing workspace shell, `UserAvatar`, `AuthField`, dark theme, and validation conventions.

**Tech Stack:** Next.js 16.4 App Router with Cache Components, React 19.3, NextAuth v5 beta, Drizzle ORM over Neon HTTP, Zod, bcryptjs, TypeScript, and Tailwind CSS v4.

**Spec:** `context/features/profile-page-spec.md`

## Global Constraints

- Create profile page at `/profile` route.
- Display user info: email, name, avatar (GitHub or initials), account creation date.
- Show usage stats: total notes, total projects, total tasks, total resources, total transactions.
- Add account actions: change password (email users only), delete account with confirmation.
- Follow existing codebase patterns for data fetching and components.
- Use the GitHub avatar from OAuth when available; otherwise generate initials from name/email.
- Show the change-password action only for users who signed up with email/password, not GitHub OAuth.
- Require confirmation before deleting an account.
- Re-authenticate inside every Server Action; page protection alone is insufficient.
- Scope every aggregate and mutation to the authenticated user ID; never expose another user’s data.
- Preserve existing GitHub OAuth, credentials sign-in, email verification, password recovery, and dashboard behavior.
- Do not add a database migration or dependency; use existing columns and tables.
- Do not commit, push, merge, or delete real user data without explicit permission.
- Database operations, if needed for verification, target development branch `ep-silent-bird-b59kwhec` only; production is off limits.

## Review Focus

- A signed-out request to `/profile` must redirect to sign-in with a `/profile` callback; pin this to the browser/HTTP checks in Task 3.
- A user with no name must receive useful initials from the email rather than `?`; pin this to the avatar/page checks in Task 3.
- OAuth-only users must not receive a password-change control, while credentials users must; pin this to fixture/browser checks in Task 3.
- Counts must be scoped to the current user and remain zero/valid when a user has no rows; pin this to the profile-data checks in Task 1.
- Direct unauthenticated or forged action submissions must not mutate or delete an account; pin this to action checks in Task 2.

---

### Task 1: Profile data and avatar identity

**Files:**
- Create: `src/types/profile.ts`
- Create: `src/lib/profile.ts`
- Modify: `src/components/user/UserAvatar.tsx`

**Interfaces:**
- `ProfileData = { user: { name: string | null; email: string; image: string | null; createdAt: Date; canChangePassword: boolean }; stats: { notes: number; projects: number; tasks: number; resources: number; transactions: number } }`.
- `getProfileData(userId: string): Promise<ProfileData | null>` returns `null` when the user no longer exists.
- `UserAvatar` accepts an optional `email: string | null` prop and uses trimmed name first, then email, for initials.

- [ ] **Step 1: Write the failing data/identity checks**

  Create a scratch script under `/tmp/opencode/` that exercises the profile data contract against development fixtures and asserts five user-scoped zero/non-zero counts, `createdAt`, `canChangePassword` from `passwordHash`, and email fallback initials. Do not print connection strings, password hashes, or personal data.

- [ ] **Step 2: Run the checks to verify they fail**

  Run the scratch checks before adding the helper. Expected: the profile helper/export and email-aware avatar behavior are missing; no fixtures are changed.

- [ ] **Step 3: Implement `getProfileData` in `src/lib/profile.ts`**

  Mark the module server-only. Select the user identity fields by ID, then start the five `count()` queries in parallel with `Promise.all`; each query must filter by its table’s `userId`. Return `canChangePassword: passwordHash !== null` without returning the hash.

- [ ] **Step 4: Update `UserAvatar`**

  Add the optional email prop, derive initials from name or email with the existing two-part convention, preserve GitHub image fallback/error behavior, and keep the component’s current call sites compatible.

- [ ] **Step 5: Run the checks to verify they pass**

  Re-run the same scratch script. Expected: PASS for user scoping, zero counts, credential eligibility, and name/email avatar fallback.

### Task 2: Authenticated account actions

**Files:**
- Modify: `src/lib/auth-validation.ts`
- Create: `src/types/profile.ts` (action state exports)
- Create: `src/actions/profile.ts`

**Interfaces:**
- `ChangePasswordState = { success: boolean; error: string | null; fieldErrors?: { currentPassword?: string; password?: string; confirmPassword?: string } }`.
- `initialChangePasswordState: ChangePasswordState`.
- `changePassword(previous: ChangePasswordState, formData: FormData): Promise<ChangePasswordState>`.
- `deleteAccount(): Promise<void>` redirects to `/sign-in?deleted=1` after successful deletion.

- [ ] **Step 1: Write the failing action checks**

  Extend the scratch checks with malformed password fields, wrong current password, OAuth-only account, valid credentials-user password change, unauthenticated action calls, and account deletion confirmation plumbing. Assert that invalid changes leave the stored password usable and that deletion targets only the authenticated user.

- [ ] **Step 2: Run the checks to verify they fail**

  Run the targeted action checks. Expected: the profile action exports do not exist and existing passwords/accounts remain unchanged.

- [ ] **Step 3: Add the change-password schema**

  Reuse the existing password rules for the new password and confirmation, require a non-empty current password, and attach mismatches to `confirmPassword` using the existing validation message convention.

- [ ] **Step 4: Implement `changePassword`**

  Re-check `auth()` inside the action, validate `FormData`, load only the current user’s `passwordHash`, reject OAuth-only users and incorrect current passwords with a generic error, hash the new password with bcrypt cost 12, and update only the authenticated user. Return the existing `{ success, error, fieldErrors }` style without exposing hashes or account-provider details.

- [ ] **Step 5: Implement `deleteAccount`**

  Re-check `auth()`, delete only the authenticated `users.id` (allowing existing cascading foreign keys to remove owned records), and call `signOut({ redirectTo: "/sign-in?deleted=1" })`. An unauthenticated invocation must redirect/sign out without deleting anything.

- [ ] **Step 6: Run the checks to verify they pass**

  Re-run the action checks. Expected: PASS for validation, wrong-password protection, OAuth eligibility, successful replacement, authenticated deletion, cascade behavior, and no mutation when unauthenticated.

### Task 3: Protected profile route and interactive UI

**Files:**
- Create: `src/app/profile/page.tsx`
- Create: `src/components/profile/ProfileActions.tsx`
- Modify: `src/components/layout/Sidebar.tsx` only if needed to mark `/profile` as the active account context without regressing dashboard navigation.

**Interfaces:**
- `ProfileActions({ canChangePassword }: { canChangePassword: boolean }): JSX.Element`.
- `ProfilePage` consumes `getProfileData`, `Sidebar`, `UserAvatar`, `AuthField`, `changePassword`, and `deleteAccount`.

- [ ] **Step 1: Write the failing browser checks**

  Add scratch browser/HTTP assertions for protected redirect behavior, identity fields, GitHub image/name-email initials, all five stats, credentials-only password control, OAuth-only omission, password dialog labels/status/pending state, delete confirmation dialog, keyboard focus visibility, and a 320px layout. Run them before the route exists.

- [ ] **Step 2: Run the browser checks to verify they fail**

  Start the development server with the development environment and run the checks at desktop and mobile widths. Expected: `/profile` is unavailable or redirects without the required profile content.

- [ ] **Step 3: Implement the protected page**

  Follow the dashboard shell: call `auth()`, redirect unauthenticated users to `/sign-in?callbackUrl=%2Fprofile`, fetch profile data for the session ID, pass the safe account shape to `Sidebar`, and render a responsive identity header, stat ledger, security section, and danger zone. Format `createdAt` with a stable server-rendered locale-independent date format.

- [ ] **Step 4: Implement `ProfileActions`**

  Use `useActionState` for the password action and `useFormStatus` for pending controls. Render the password action only when `canChangePassword` is true; use accessible native dialog surfaces for password entry and deletion confirmation, reuse `AuthField`, announce errors/success with status regions, prevent duplicate submits, and preserve visible focus styles. Keep the delete dialog explicit about permanent data removal and only submit after confirmation.

- [ ] **Step 5: Apply the profile visual system**

  Keep the existing dark workspace palette and Geist typography. Use a left-aligned identity rail with the large avatar as the one memorable element, a single horizontal stat ledger that stacks on narrow screens, and a visually quieter security/danger separation rather than a grid of identical cards. Do not add new decorative gradients, dependencies, or theme tokens.

- [ ] **Step 6: Run the browser checks to verify they pass**

  Re-run the same checks. Expected: PASS for protection, content, provider-specific controls, accessible interactions, confirmation, responsive layout, and no secret/hash/token exposure.

### Task 4: Full verification and feature evidence

**Files:**
- Modify: `context/current-feature.md`
- Update: `README.md` only if the existing route/configuration documentation needs the profile page documented.

**Interfaces:** Consume Tasks 1–3 without changing unrelated auth providers, migrations, or dashboard behavior.

- [ ] **Step 1: Run project verification with development configuration**

  Run `pnpm lint`, `pnpm build`, `pnpm exec tsc --noEmit`, and `git diff --check` with the development `DATABASE_URL` available. The current clean worktree baseline has lint passing; build requires the missing database environment to be supplied.

- [ ] **Step 2: Run the final browser/action checks**

  Confirm the full profile journey, password-change lifecycle, delete confirmation, signed-out redirect, existing sign-in/sign-out flows, and mobile layout. Do not execute real account deletion unless explicitly authorized; use isolated development fixtures.

- [ ] **Step 3: Inspect the complete diff**

  Check server/client boundaries, user scoping, action re-authentication, accessibility, responsive behavior, no raw credential exposure, and no unrelated changes. Do not commit automatically.

- [ ] **Step 4: Record evidence**

  Update `context/current-feature.md` with completed goals, verification results, limitations, and the missing live-environment/browser evidence if configuration remains unavailable. Keep status `In Progress` until the user authorizes completion.

## Planning Evidence

- The existing dashboard provides the authenticated workspace shell and redirect pattern; `UserMenu` already links to `/profile`.
- The existing user schema stores `createdAt`, `image`, and nullable `passwordHash`, while all five usage tables have indexed `userId` columns and cascading user ownership.
- The existing `UserAvatar` supports GitHub image fallback but currently derives initials only from `name`, so the profile requirement needs an email fallback.
- The installed Next.js package does not include the repository-referenced `node_modules/next/dist/docs/` guides; current Next.js App Router authentication/action guidance was consulted through Context7 instead.
- No migration, new dependency, or production database operation is planned.
