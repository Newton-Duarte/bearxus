# UI Component Migration & Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing authentication, profile, and dashboard UI to the configured shadcn/Base UI primitives, standardize typography with `Text`, and replace the misleading auth-scoped field with a reusable global `TextField`.

**Architecture:** Keep `Input` as the low-level Base UI control and add `TextField` as a focused composite for a labeled text input with description/error feedback. Migrate authentication and profile consumers to that component, while using the existing `Card`, `Dialog`, `DropdownMenu`, `Label`, `Separator`, and `Button` primitives directly where their structure requires composition. Preserve form actions, validation, focus behavior, and security semantics while replacing native/legacy UI structure.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS v4, shadcn/ui `base-nova`, Base UI React primitives, CVA, and existing Server Actions/API contracts.

**Spec:** `context/features/ui-component-migration.md`

## Global Constraints

- The application uses Next.js v16 and Tailwind CSS v4.
- Do not use legacy `@layer` directives or deprecated utility declarations.
- Use the configured purple OKLCH design tokens for light and dark themes; do not introduce hardcoded color values in migrated components.
- Base UI composition must use the native `render` prop pattern; do not introduce Radix `asChild` usage.
- Preserve existing authentication, validation, rate-limit, password, verification, redirect, and account-deletion behavior.
- Keep components focused, typed, accessible, and free of `any` types.
- Do not add a generic `AppInput`; the existing `src/components/ui/input.tsx` remains the low-level input primitive.
- Do not add a broad `Field` abstraction in this pass; reserve that for future non-text controls such as textareas, selects, and switches.

## Review Focus

- Generated field IDs must remain unique across repeated fields while explicit IDs remain stable; cover this in the `TextField` type/markup test and browser smoke checks.
- Field descriptions and errors must produce correct `aria-invalid` and `aria-describedby` relationships without losing caller-provided input attributes; cover this in the `TextField` test and auth browser checks.
- Native dialog/menu replacement must preserve keyboard focus, Escape handling, outside-close behavior, and form submission; cover this in profile/dashboard browser checks.
- Base UI composition must not regress into `asChild` or nested interactive controls; cover this with a repository search and browser interaction checks.
- Light/dark rendering must use the purple token system with readable contrast and no hardcoded legacy selectors; cover this with theme browser checks, contrast assertions, and `git diff --check`.

---

### Task 1: Add the global `TextField` composite

**Files:**
- Create: `src/components/ui/text-field.tsx`
- Create: `src/components/ui/text-field.test.tsx`
- Delete: `src/components/auth/AuthField.tsx` (all internal consumers now use the global field)

**Interfaces:**
- Consumes: `Input` from `src/components/ui/input.tsx`, `Label` from `src/components/ui/label.tsx`, `Text` from `src/components/ui/text.tsx`, and `cn` from `src/lib/utils`.
- Produces: exported `TextFieldProps` and `TextField`.
- `TextFieldProps` extends `React.ComponentProps<typeof Input>` and adds `label: React.ReactNode`, `description?: React.ReactNode`, and `error?: React.ReactNode`.
- `TextField` generates an ID with `useId()` when `id` is absent, defaults the input control to the existing form-friendly 44px height, forwards normal input props and `className`, and renders label/description/error text with token-based styling.
- No auth-scoped field alias remains after migration; all internal consumers import `TextField` directly.

- [x] **Step 1: Add the type-level failing coverage**

  Add compile-time assertions for standard input props, `label`, `description`, `error`, explicit IDs, and invalid element-only props. Add a markup fixture that exercises two fields without IDs so generated IDs can be checked by the browser acceptance pass.

- [x] **Step 2: Run the focused type check and verify the new contract is not implemented yet**

  Run: `pnpm exec tsc --noEmit`

  Expected: the new test fails because `text-field.tsx` and its exports do not exist yet.

- [x] **Step 3: Implement `TextField` in `src/components/ui/text-field.tsx`**

  Compose `Label` and the Base UI `Input`; render description and error with separate IDs, include both IDs in `aria-describedby` when present, set `aria-invalid` when `error` is provided, preserve caller-provided attributes, and use `Text` for all helper/error copy. Keep error text visible alongside the description rather than silently replacing it.

- [x] **Step 4: Remove the old auth-scoped field implementation**

  Delete `src/components/auth/AuthField.tsx` after all authentication and profile consumers import `TextField` directly.

- [x] **Step 5: Run the focused type check**

  Run: `pnpm exec tsc --noEmit`

  Expected: PASS, including the new `TextField` type assertions.

### Task 2: Migrate authentication pages and forms

**Files:**
- Modify: `src/components/auth/AuthShell.tsx`
- Modify: `src/components/auth/SignInForm.tsx`
- Modify: `src/components/auth/RegisterForm.tsx`
- Modify: `src/components/auth/ForgotPasswordForm.tsx`
- Modify: `src/components/auth/ResetPasswordForm.tsx`
- Modify: `src/components/auth/VerificationForm.tsx`
- Modify: `src/app/sign-in/page.tsx`
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/forgot-password/page.tsx`
- Modify: `src/app/reset-password/page.tsx`
- Modify: `src/app/verify-email/page.tsx`

**Interfaces:**
- Consumes: `TextField` from Task 1, existing `Button`, existing auth action/state contracts, and the existing `Text` primitive.
- Produces: the same routes, form names, submitted values, server-action/API requests, redirect parameters, validation messages, and pending states with migrated markup.

- [x] **Step 1: Replace all auth form field imports and usages**

  Change the five auth forms from `AuthField` to `TextField`; map the old `hint` prop to `description`; keep the existing names, autocomplete values, types, max lengths, controlled values, server field errors, and password guidance unchanged.

- [x] **Step 2: Standardize auth shell and form typography**

  Replace native headings, helper paragraphs, status/error copy, labels, loading fallbacks, and micro-descriptions in the targeted auth files with semantic `Text` variants/as-elements. Preserve inline link semantics and the existing accessible `aria-labelledby`, `role`, `tabIndex`, and focus behavior.

- [x] **Step 3: Align auth structure with configured primitives without adding visual churn**

  Use existing `Button`, `Input`-through-`TextField`, `Label`, and `Separator`/token styling where applicable. Do not add a card solely for migration if the current shell has no card container, and do not change authentication copy or action behavior.

- [x] **Step 4: Run static checks for auth migration**

  Run: `pnpm exec tsc --noEmit`

  Expected: PASS with no remaining authentication-form imports of `@/components/auth/AuthField`; `ProfileActions` may retain the compatibility adapter until Task 3.

### Task 3: Migrate profile, dashboard, sidebar, avatar, and account menu structure

**Files:**
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/profile/ProfileActions.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/user/UserAvatar.tsx`
- Modify: `src/components/user/UserMenu.tsx`

**Interfaces:**
- Consumes: `TextField` from Task 1 and existing Base UI `Card`, `Dialog`, `DropdownMenu`, `Button`, `Separator`, `Text`, and `UserAvatar` APIs.
- Produces: the same authenticated profile/dashboard data, password Server Action payloads, account deletion confirmation, navigation links, sign-out action, avatar fallback, and responsive layouts.

- [x] **Step 1: Convert profile password inputs to `TextField`**

  Replace the three `AuthField` usages in `ProfileActions` with `TextField`, preserving controlled values, clearing sensitive state on close, field error mapping, form names, autocomplete values, and pending/error/success behavior.

- [x] **Step 2: Replace native profile dialogs with the configured Base UI dialog**

  Migrate password-change and account-deletion modal structure to `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, and `DialogClose`. Use Base UI `render` for custom `Button` composition, preserve explicit destructive confirmation, keep forms bound to the existing Server Actions, and ensure close/reset behavior is controlled through `onOpenChange` rather than manual native dialog calls.

- [x] **Step 3: Replace the custom account menu with `DropdownMenu`**

  Migrate `UserMenu` from manual open state, outside-pointer listeners, hidden nav markup, and custom Escape handling to the configured Base UI `DropdownMenu` primitives. Use `render` for Next `Link` items and the sign-out form button, retain the accessible account label, pending sign-out state, Profile/Settings destinations, destructive sign-out styling, and keyboard focus restoration.

- [x] **Step 4: Standardize dashboard/profile/sidebar/avatar typography and containers**

  Use `Text` for native headings, descriptions, stat labels/values, account copy, loading messages, brand text, and avatar initials. Use `Card` composition for profile stat/security containers where a card already exists conceptually, `Separator` for sidebar/menu divisions, and token-based classes for all surfaces and states. Keep `UserAvatar` fallback behavior and image failure handling unchanged.

- [x] **Step 5: Use Base UI render composition for navigational controls**

  Where a configured `Button` is used to present a link-like control, compose it with Next `Link` through `render`; do not introduce `asChild`. Keep ordinary navigation links as links where no button semantics are needed.

- [x] **Step 6: Run static checks for profile/dashboard migration**

  Run: `pnpm exec tsc --noEmit`

  Expected: PASS with no `AuthField` imports, no manual native menu/dialog implementation in the targeted components, and no new `asChild` usage.

### Task 4: Align global theme and remove residual legacy styling hooks

**Files:**
- Modify: `src/app/globals.css`
- Modify: any targeted auth/profile/dashboard component that still contains hardcoded or auth-only styling hooks after Tasks 2–3

**Interfaces:**
- Consumes: the existing purple OKLCH variables, Tailwind v4 `@theme inline` mappings, and component-level token utilities.
- Produces: one consistent token-based styling surface for light/dark mode with no conflicting legacy selectors.

- [x] **Step 1: Audit residual selectors and classes**

  Search the targeted tree for `@layer`, `auth-link`, hardcoded color utilities, inline styles, `asChild`, and old native field/menu/dialog patterns. Record each remaining match and classify it as generated primitive code, required global CSS, or migration residue.

- [x] **Step 2: Replace legacy global CSS declarations**

  Remove the remaining legacy `@layer` usage required by the feature spec by expressing the base border/outline/body rules through Tailwind v4-compatible plain CSS or supported theme/utility constructs. Rename or remove auth-only link hooks when their behavior is now expressible through token-based component classes, updating all consumers together.

- [x] **Step 3: Verify token interpolation in both themes**

  Confirm backgrounds, borders, focus rings, muted text, destructive states, inputs, cards, dialogs, dropdowns, separators, and avatar fallbacks resolve through the existing light/dark OKLCH variables without introducing new palette values.

- [x] **Step 4: Run the residual audit**

  Run: `pnpm exec tsc --noEmit`, `pnpm lint`, and repository searches for `AuthField`, `asChild`, `@layer`, and the removed styling hook.

  Expected: type check and lint pass; no product code mentions `AuthField`, and no targeted UI code uses `asChild` or forbidden legacy CSS.

### Task 5: Verify the migrated UI in production mode

**Files:**
- No new product files; update only the relevant evidence/feature context after verification.

**Interfaces:**
- Consumes: all completed migration tasks and the existing development fixture/auth flows.
- Produces: verified browser behavior and completion evidence for the feature.

- [x] **Step 1: Run repository quality checks**

  Run: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`, and `git diff --check`.

  Expected: all commands exit successfully.

- [x] **Step 2: Run browser checks against the production server**

  Verify sign-in, registration, forgot-password, reset-password, verification, profile, and dashboard routes. Assert responsive rendering at desktop and 320px widths, unique field IDs, visible labels, field error descriptions, pending button states, no console errors, and unchanged redirects/actions.

- [x] **Step 3: Verify interactive primitive behavior**

  Verify keyboard navigation and focus for the profile password/delete dialogs, account dropdown open/close/Escape/outside click, link navigation, sign-out pending state, and Base UI render-composed controls.

- [x] **Step 4: Verify theme and accessibility outcomes**

  Toggle light/dark mode and assert token-backed surfaces, focus indicators, error states, separator visibility, avatar fallback contrast, and readable text contrast. Confirm labels and descriptions are announced through the expected ARIA relationships.

- [x] **Step 5: Update feature evidence without committing**

  Add the verified migration summary and commands to `context/current-feature.md` while preserving its existing history. Do not commit or merge until the user explicitly requests the completion workflow.
