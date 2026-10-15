# Drizzle + Neon PostgreSQL Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed Drizzle/Neon database foundation and generated migration for Bearxus's user-owned notes, projects, tasks, stages, activity, learning resources, transactions, and Auth.js adapter tables.

**Architecture:** Keep database code under `src/db`. Define Auth.js tables separately from Bearxus workspace tables, export them through one schema barrel, and create a server-only Drizzle client using Neon's HTTP driver. Use explicit PostgreSQL foreign keys, composite relationships, checks, and indexes for ownership and workflow integrity; represent activity targets with constrained nullable foreign keys rather than an unvalidated polymorphic ID.

**Tech Stack:** Next.js 16.4 App Router, TypeScript 5, PostgreSQL, Drizzle ORM, Drizzle Kit, `@neondatabase/serverless`, Auth.js/NextAuth, and `@auth/drizzle-adapter`.

**Spec:** `docs/superpowers/specs/2026-10-14-database-schema-design.md`

## Global Constraints

- Use Neon PostgreSQL (serverless).
- Use Drizzle ORM for all database operations.
- Use only the Neon development branch for local development and migration verification; production is off limits unless explicitly authorized.
- Generate versioned migrations with `drizzle-kit generate`; do not use `drizzle-kit push`.
- Keep each user's workspace isolated; do not add shared workspaces, memberships, invitations, or cross-user actions.
- Notes link only to notes; do not add direct note-to-project, note-to-task, or note-to-learning-resource links.
- Notes do not have comments or activity timelines.
- Projects, tasks, and learning resources have independent activity timelines; parent timelines do not roll up child activity.
- Do not log every field edit or Markdown save; activity is limited to meaningful workflow events and manual comments.
- Store no plaintext passwords.
- Follow strict TypeScript rules: no `any`, no unused imports or variables, and explicit types for exported interfaces where needed.
- Do not implement application UI, authentication screens, workflow services, command-palette search, exports, analytics, or content-studio behavior in this feature.
- Do not commit until the user explicitly authorizes it and all verification commands pass.

## Review Focus

- **Cross-project stage assignment:** a task referencing a stage from another project must be rejected by the database; verify with a failed insert in the development database after migration.
- **Note-link duplication and self-links:** self-links and both orderings of the same note pair must be rejected; verify with failed inserts after migration.
- **Activity target shape:** an activity row with zero targets or multiple targets must be rejected; verify the check constraint with failed inserts.
- **Deletion semantics:** deleting a stage with tasks must be restricted, while deleting a task/project/resource removes its dependent activity; verify each cascade/restrict path after migration.
- **Workspace isolation:** note links, task relationships, and activities must not connect records owned by different users; verify same-owner composite constraints or checks with failed inserts.

---

### Task 1: Add database dependencies and migration configuration

**Files:**
- Modify: `package.json` (dependencies and database scripts)
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`
- Create: `drizzle.config.ts`
- Create: `.env.example`

**Interfaces:**
- Produces the `db:generate` and `db:migrate` package scripts used by later tasks.
- Produces a Drizzle Kit configuration reading `DATABASE_URL`, targeting `src/db/schema/index.ts`, and writing migrations to `drizzle/`.

- [ ] **Step 1: Add the runtime dependencies**

Run:

```bash
pnpm add drizzle-orm @neondatabase/serverless next-auth @auth/drizzle-adapter
pnpm add -D drizzle-kit dotenv
```

Keep the existing Next.js, React, TypeScript, Tailwind, and ESLint versions unchanged unless a peer-dependency resolution requires a documented compatible patch.

- [ ] **Step 2: Add migration scripts in `package.json`**

Add:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 3: Create `drizzle.config.ts`**

Export a `defineConfig` configuration with:

- `schema: "./src/db/schema/index.ts"`
- `out: "./drizzle"`
- `dialect: "postgresql"`
- `dbCredentials.url` sourced from `process.env.DATABASE_URL`

Load local environment variables for the CLI without embedding credentials in the repository. Fail clearly when `DATABASE_URL` is absent.

- [ ] **Step 4: Create `.env.example`**

Document only a placeholder development connection string:

```text
DATABASE_URL="postgresql://user:password@development-branch.neon.tech/neondb"
```

Do not add a real Neon URL. Keep `.env*` ignored while adding an explicit `!.env.example` exception to `.gitignore` so the safe template can be committed.

- [ ] **Step 5: Verify dependency and CLI setup**

Run:

```bash
pnpm install --frozen-lockfile
pnpm exec drizzle-kit --version
```

Expected: the lockfile is accepted and Drizzle Kit prints its installed version.

### Task 2: Define Auth.js and Bearxus Drizzle schemas

**Files:**
- Create: `src/db/schema/auth.ts`
- Create: `src/db/schema/workspace.ts`
- Create: `src/db/schema/relations.ts`
- Create: `src/db/schema/index.ts`
- Create: `src/db/index.ts`
- Create: `src/db/auth-adapter.ts`

**Interfaces:**
- `src/db/schema/auth.ts` exports `users`, `accounts`, `sessions`, and `verificationTokens` with the columns required by `DrizzleAdapter`.
- `src/db/schema/workspace.ts` exports the project, stage, task, note, note-link, activity, learning-resource, and transaction tables plus their PostgreSQL enums.
- `src/db/schema/index.ts` re-exports every table and enum for Drizzle Kit and callers.
- `src/db/index.ts` exports `db`, a server-side Drizzle database instance backed by `@neondatabase/serverless` and the complete schema.
- `src/db/auth-adapter.ts` exports `authAdapter`, created with `DrizzleAdapter(db, { usersTable, accountsTable, sessionsTable, verificationTokensTable })`.

- [ ] **Step 1: Define Auth.js tables in `src/db/schema/auth.ts`**

Use text IDs for `users.id` to match the Auth.js adapter contract. Define the standard adapter fields for account provider identity, OAuth token data, sessions, and verification tokens. Use:

- `users.email` unique and not null;
- `accounts` composite primary key `(provider, providerAccountId)`;
- `sessions.sessionToken` primary key;
- `verificationTokens` composite primary key `(identifier, token)`;
- cascading `userId` foreign keys from accounts and sessions;
- optional `passwordHash`, never a plaintext password;
- timezone-aware timestamps for `emailVerified`, session expiration, verification expiration, and user timestamps.

- [ ] **Step 2: Define workspace enums and tables in `src/db/schema/workspace.ts`**

Use UUID primary keys with database-generated defaults for Bearxus domain records and timezone-aware `createdAt`/`updatedAt` columns.

Define:

- `projects`: `id`, `userId`, `name`, `description`, `type`, lifecycle `status`, integer `progress`, timestamps. Add unique `(id, userId)` support for ownership-scoped composite references. Use the known lifecycle values `active`, `completed`, and `on-hold`; keep project type extensible if an enum would make future project types unnecessarily migration-heavy.
- `projectStages`: `id`, `userId`, `projectId`, `name`, `color`, integer `position`. Add unique `(id, projectId, userId)` support for composite references and unique `(projectId, position)` ordering.
- `tasks`: `id`, `userId`, `projectId`, `stageId`, `title`, `description`, `priority`, nullable `dueDate`, timestamps. Add unique `(id, userId)` support for activity targets, a project foreign key, and a composite `(stageId, projectId, userId)` foreign key to `projectStages`, preventing cross-project stage assignment. Deleting a stage is restricted while tasks reference it.
- `notes`: `id`, `userId`, `title`, Markdown `content`, text-array `tags`, timestamps. Add a unique `(id, userId)` support key for ownership-scoped note links.
- `noteLinks`: `id`, `userId`, canonical `noteId`, canonical `linkedNoteId`, and `createdAt`. Add same-owner composite foreign keys to both notes, a check that the IDs differ and are in canonical order, and a unique canonical pair. Delete links when either note is deleted.
- `activities`: `id`, `ownerId`, `actorId`, nullable `projectId`, `taskId`, `learningResourceId`, `type`, nullable `content`, typed JSONB `metadata`, and `createdAt`. Add an exactly-one-target check, owner-scoped composite target foreign keys, `actorId`/`ownerId` equality for the current single-owner model, meaningful event enum values, and cascading deletion from each target.
- `learningResources`: `id`, `userId`, `title`, `type`, `status`, integer `progressPct`, timestamps. Add unique `(id, userId)` support for activity targets. Use the defined resource types `book`, `course`, and `doc`, and statuses `to-start`, `in-progress`, and `completed`.
- `transactions`: `id`, `userId`, income/expense `type`, `numeric(12, 2)` amount, category, date, notes, and `createdAt`.

Add checks for progress values in the inclusive range 0–100 and the activity target invariant. Do not add note comments or note activity fields.

- [ ] **Step 3: Add indexes and deletion actions**

Add indexes for user ownership, project/stage/task foreign-key lookups, note-link endpoints, activity targets plus descending `createdAt`, learning-resource user/status, and transaction user/date. Use cascade deletion for user-owned records and note links; keep stage deletion restrictive when tasks exist.

- [ ] **Step 4: Define Drizzle relations in `src/db/schema/relations.ts`**

Expose relations for user-owned collections, project stages/tasks/activity, task project/stage/activity, note links from both endpoints, learning-resource activity, and transaction ownership. Keep relations aligned with the database foreign keys; do not introduce cross-entity note relations that are not represented by `noteLinks`.

- [ ] **Step 5: Create the schema barrel and database client**

In `src/db/schema/index.ts`, re-export all auth tables, workspace tables, enums, and relations. In `src/db/index.ts`, create the Neon HTTP client from `DATABASE_URL` and pass the complete schema to Drizzle. Keep the module server-only by convention and avoid opening a connection during unrelated static page builds when the database is not used.

- [ ] **Step 6: Wire the adapter compatibility object**

In `src/db/auth-adapter.ts`, pass the custom table definitions to `DrizzleAdapter` using the current Auth.js custom-schema API. Do not add providers, routes, sign-in UI, or session configuration in this feature.

- [ ] **Step 7: Run static verification**

Run:

```bash
pnpm lint
pnpm build
```

Expected: both commands exit successfully with no TypeScript, import, or unused-code errors.

### Task 3: Generate and verify the initial migration

**Files:**
- Create: `drizzle/0000_*.sql` and generated Drizzle metadata files
- Modify: generated migration files only if a reviewed schema correction requires regeneration

**Interfaces:**
- Consumes the schema and `drizzle.config.ts` from Tasks 1–2.
- Produces an applyable PostgreSQL migration containing all tables, enums, foreign keys, checks, indexes, and deletion actions from the design.

- [ ] **Step 1: Generate the migration**

With `DATABASE_URL` set to the Neon development branch, run:

```bash
pnpm db:generate
```

Expected: Drizzle Kit creates a new migration under `drizzle/` and reports no schema parsing errors.

- [ ] **Step 2: Review generated SQL against the design**

Confirm the migration contains:

- Auth.js tables and required composite/unique keys;
- all Bearxus tables, including `project_stages`, `note_links`, and `activities`;
- project/stage/task composite integrity;
- canonical note-link, progress, activity-target, and owner/actor checks;
- indexes for ownership, timelines, links, and dates;
- cascade actions for owned records and activity targets;
- restrictive stage deletion while tasks reference a stage.

If the generated SQL does not express a requirement, correct the TypeScript schema and regenerate rather than hand-editing the migration.

- [ ] **Step 3: Apply the migration to development**

Run:

```bash
pnpm db:migrate
```

Expected: the migration applies successfully to the development Neon branch. Do not run this command with a production connection string.

- [ ] **Step 4: Verify integrity behavior against development**

Using a temporary SQL verification session or disposable script that cleans up its test rows, verify that:

- a task cannot reference a stage from another project;
- a stage with tasks cannot be deleted;
- deleting a task removes its activity;
- deleting a project removes its stages, tasks, and activity;
- a note cannot link to itself or duplicate an existing pair in reverse order;
- an activity cannot have zero or multiple targets;
- records owned by different users cannot be connected through note links, task relationships, or activity targets.

Expected: invalid operations fail with a foreign-key or check/unique constraint error, and valid cascade operations remove only dependent records.

### Task 4: Final repository verification and handoff

**Files:**
- Modify: `README.md` with database setup and migration commands, if the existing starter README remains the only developer setup documentation

**Interfaces:**
- Documents `DATABASE_URL`, `pnpm db:generate`, and `pnpm db:migrate` without including credentials or production instructions.

- [ ] **Step 1: Document local database setup**

Add a concise README section that points developers to `.env.example`, states that `DATABASE_URL` must use the Neon development branch, and explains that schema changes require generated migrations rather than `drizzle-kit push`.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
pnpm lint
pnpm build
pnpm db:generate
```

Expected: all commands exit with code 0, and regeneration does not create an unexpected second migration when the schema is unchanged.

- [ ] **Step 3: Review the final diff and migration state**

Confirm no credentials, tracked `.env` files other than `.env.example`, generated build output, unrelated UI changes, or production database references are present. Confirm the generated migration and metadata are tracked.

- [ ] **Step 4: Commit only after explicit user authorization**

Once the user authorizes a commit and all verification passes:

```bash
git add package.json pnpm-lock.yaml .gitignore drizzle.config.ts .env.example src/db drizzle README.md
git commit -m "feat: add drizzle neon database schema"
```
