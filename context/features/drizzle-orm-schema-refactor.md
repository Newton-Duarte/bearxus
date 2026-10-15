# Drizzle ORM schema Structure Refactor

I want to refactor our current Drizzle ORM schema structure in `src/db/schema/` from a single monolithic file setup (`workspace.ts` + `relations.ts`) into a clean, modular, domain-driven structure with co-located relations.

### Objective
1. Split `src/db/schema/workspace.ts` into individual, feature-focused domain files inside `src/db/schema/`.
2. Move the relation definitions currently in `src/db/schema/relations.ts` into their corresponding domain schema files.
3. Remove `relations.ts` and `workspace.ts` once all definitions are migrated.
4. Export all domain modules from `src/db/schema/index.ts` so that Drizzle Kit and `db.query` continue to function without breaking.

---

### Target Directory Structure

```text
src/
  db/
    index.ts
    auth-adapter.ts
    schema/
      index.ts           # Barrel file re-exporting all schema files
      auth.ts            # Auth.js tables (users, accounts, sessions, verification tokens)
      projects.ts        # Projects & project stages tables + relations
      tasks.ts           # Tasks table + relations
      notes.ts           # Notes & note links table + relations
      activities.ts      # Activities table + relations
      resources.ts       # Learning resources table + relations
      transactions.ts    # Transactions table + relations
```

(Note: If any table cross-references another table for foreign keys or relations, import that table cleanly from its respective domain file).

### Step-by-Step Instructions

#### Step 1: Create Domain Schema Files with Co-Located Relations

For each domain file (e.g., `projects.ts`, `tasks.ts`, `notes.ts`, `activities.ts`, `resources.ts`, `transactions.ts`), include:

- Table definitions (pgTable, columns, constraints, enums, indexes).
- Corresponding `relations()` definitions co-located in the same file right below the table definition.

Example Pattern (`src/db/schema/projects.ts`):

```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tasks } from './tasks';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // ...other columns
});

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
}));
```

####  Step 2: Update `src/db/schema/index.ts`

Re-export all domain modules from `src/db/schema/index.ts`:

```ts
export * from './auth';
export * from './projects';
export * from './tasks';
export * from './notes';
export * from './activities';
export * from './resources';
export * from './transactions';
```

#### Step 3: Delete Obsolete Files

Remove `src/db/schema/workspace.ts` and `src/db/schema/relations.ts`.

#### Step 4: Verification Rules & Guardrails

1. Zero Database Drift: Do NOT change table names, column names, data types, constraints, or foreign key rules in PostgreSQL. The generated TypeScript output must strictly match the current SQL schema so that running `pnpm db:generate` produces no new SQL migration files.
2. Import Integrity: Update all imports across the application that previously referenced `workspace.ts`  or `relations.ts` to import from `@/db/schema` (or `src/db/schema`).
3. Type Safety: Ensure there are no circular dependency execution issues or broken TypeScript types in relational queries (`db.query.*`).

Please review the existing `workspace.ts` and `relations.ts` files, execute the split according to these rules, and verify that the app builds cleanly without TypeScript errors.