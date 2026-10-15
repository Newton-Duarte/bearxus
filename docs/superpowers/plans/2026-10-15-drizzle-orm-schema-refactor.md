# Drizzle ORM Schema Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularize the Drizzle schema without changing its SQL representation or relational query API.

**Architecture:** Move existing definitions verbatim into their owning domain modules, with relations immediately below the corresponding tables. Use direct domain imports, lazy foreign-key callbacks, and deferred relation callbacks to avoid eager access across circular imports. Keep timestamp helpers private to the domain files that use them rather than adding another exported schema module.

**Tech Stack:** TypeScript, Drizzle ORM 0.45.x, Drizzle Kit 0.31.x, Next.js 16.4, pnpm.

**Spec:** `context/features/drizzle-orm-schema-refactor.md`

## Global Constraints

- No PostgreSQL table, column, enum, default, constraint, index, or foreign-key changes.
- `pnpm db:generate` must produce no new SQL migration files or migration metadata changes.
- Preserve every existing exported table, enum, relation, and `ActivityMetadata` type through `src/db/schema/index.ts`.
- All database operations must use development branch `ep-silent-bird-b59kwhec`; no migrations or live database changes are needed for this refactor.
- Do not add dependencies, a unit-test framework, or unrelated changes. Do not commit without permission.
- Preserve the existing untracked feature spec and existing feature history.

## Review Focus

- Cross-domain circular imports must initialize successfully through Drizzle Kit and the application build.
- Auth relations must retain accounts, sessions, workspace collections, and distinct activity owner/actor relations.
- Composite owner/stage references must retain their column order, relation names, and cascade/restrict rules.
- Note links must retain both named directions and composite ownership references.
- Enum exports, timestamp defaults/update callbacks, and nullable activity target types must remain unchanged.

## Task 1: Split the schema and preserve its public API

**Files:**
- Create: `src/db/schema/projects.ts` (project status enum, projects, stages, relations).
- Create: `src/db/schema/tasks.ts` (tasks and relations).
- Create: `src/db/schema/notes.ts` (notes, note links, relations).
- Create: `src/db/schema/activities.ts` (activity enum, metadata type, activities, relations).
- Create: `src/db/schema/resources.ts` (learning enums, resources, relations).
- Create: `src/db/schema/transactions.ts` (transaction enum, transactions, relations).
- Modify: `src/db/schema/auth.ts` (co-locate user, account, session relations without changing tables).
- Modify: `src/db/schema/index.ts` (re-export the seven domain files).
- Remove after migration: `src/db/schema/workspace.ts`, `src/db/schema/relations.ts` (explicitly requested by the spec).

**Interfaces:** Consume the existing definitions in `workspace.ts`, `relations.ts`, and `auth.ts`; produce the identical named exports and relation keys through the schema barrel.

- [x] Record baseline migration file hashes and run `pnpm db:generate`; expect no changes. Baseline `pnpm exec tsc --noEmit` already passed before implementation.
- [x] Create a temporary TypeScript compile fixture that imports all six new domain modules (fails before the split) and builds relational queries using a local Drizzle client without executing SQL. Cover users with accounts/sessions/ownedActivities/actedActivities, projects with stages/tasks/activities, tasks with stage/project/activities, notes with sourceLinks/targetLinks and their notes, resources with activities, and transactions with user. Assert `ActivityMetadata` and all five enum exports remain importable from the barrel.
- [x] Move table and enum definitions unchanged into the listed files, copying private timestamp helpers where needed. Move relations unchanged into their owning files; import referenced tables directly, never through the barrel. Keep all cross-domain table reads inside deferred callbacks.
- [x] Replace the barrel exports and remove the two obsolete files only once every definition has moved. Search the entire application for old schema imports and update any found to `@/db/schema`.
- [x] Run the compile fixture with `pnpm exec tsc --noEmit`; expect success with all nested relation keys inferred. Generate SQL locally from the fixture queries without executing them to exercise relation resolution and circular imports. Remove only the temporary fixture after verification.
- [x] Compare original and moved declarations for exact constraint names, reference ordering, enum values, column options, and runtime timestamp callbacks, including every Review Focus item.

## Task 2: Verify the integrated application

**Files:** No intended product changes; update this checklist with results. Leave feature status In Progress until the feature completion workflow.

**Interfaces:** Consume the unchanged schema API from Task 1; produce verification evidence and an uncommitted, reviewable diff.

- [x] Run `pnpm db:generate`; expect “No schema changes” and identical migration hashes, including metadata.
- [x] Run `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build`; expect exit code 0. Read the installed Next.js build documentation before running the build.
- [x] Smoke-test the app in the browser if a local server/browser is available; report that the current UI does not exercise database relations rather than claiming database integration coverage.
- [x] Run `git diff --check` and inspect the full diff for unrelated changes, missing exports, eager circular reads, and accidental SQL drift. Report checks and blockers; do not commit, push, merge, or mark Complete.

## Verification Results

- TypeScript, ESLint, production build, and browser smoke check pass. The welcome page does not use the database; no live database integration coverage is claimed.
- Drizzle generation reports no schema changes. SQL migration, snapshot, and journal hashes are unchanged.
- All 31 original declarations are preserved verbatim, including runtime timestamp helpers.
- Temporary typed fixture failed on the six missing domain imports before implementation, then passed compilation and nine nested relational SQL queries after the split; no SQL executed.
- Cold ESM imports of all eight schema entry points independently pass table configuration and direct-relation SQL generation for all 12 tables.
- The temporary fixture's SQL assertions were corrected for Drizzle's bound one-relation `LIMIT 1` parameters and reference-side-first equality; no production changes were needed. Generated JavaScript was moved outside the repository to avoid linting test artifacts.
- Implementation reviewed and verified on `feature/drizzle-orm-schema-refactor`. The user authorized the feature completion workflow after review.
- Independent read-only review found no Critical, Important, or Minor issues and independently confirmed baseline/current serialized-schema and relational SQL equality. Live database execution and deployed state remain unverified by design.
