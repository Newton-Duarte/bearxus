# Current Feature: Drizzle ORM Schema Structure Refactor

<!-- Feature Name -->

## Status

Complete

## Goals

- Split `src/db/schema/workspace.ts` into domain-focused schema files for projects, tasks, notes, activities, resources, and transactions.
- Co-locate each domain's relation definitions with its table definitions, preserving the auth schema.
- Re-export all domain modules from `src/db/schema/index.ts` so Drizzle Kit and `db.query` continue to work.
- Update application imports that reference `workspace.ts` or `relations.ts` to use the schema barrel, then remove the obsolete files.
- Preserve the existing SQL schema exactly; `pnpm db:generate` must produce no new SQL migration files.
- Verify relational query type safety, avoid circular dependency execution issues, and ensure `pnpm build` passes without TypeScript errors.

## Notes

- Reference: `context/features/drizzle-orm-schema-refactor.md`.
- Target schema modules: `auth.ts`, `projects.ts`, `tasks.ts`, `notes.ts`, `activities.ts`, `resources.ts`, and `transactions.ts`, exported through `index.ts`.
- Import cross-domain tables directly from their domain files for foreign keys and relations.
- Do not change PostgreSQL table names, column names, data types, constraints, indexes, or foreign key rules; this is a structural TypeScript refactor only.
- Any database operations must use the development Neon branch (`ep-silent-bird-b59kwhec`); production is off limits.
- Implementation reviewed and verified on `feature/drizzle-orm-schema-refactor`; completion authorized by the user.
- Verification: type check, lint, production build, local relational SQL checks, cold module imports, and browser welcome-page smoke check passed. Drizzle generation reports no schema changes; migration artifacts are unchanged.
- Independent review found no issues. No live SQL was executed or migrations applied; the current welcome page does not exercise database queries.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
