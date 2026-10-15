<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bearxus

Centralized Personal Command Center for notes, projects, finances, learning progress, and content creation.

## Context Files

Read the following to get the full context of the project:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Commands

- **Dev server**: `pnpm dev` (runs on http://localhost:3000)
- **Build**: `pnpm build`
- **Production server**: `pnpm start`
- **Lint**: `pnpm lint`

## Neon Database

- Project: `bearxus-dev` (ID: `br-lucky-star-b584yeor`)
- **Always use the development branch** (`ep-silent-bird-b59kwhec`) for all database operations
- Production branch is OFF LIMITS unless explicitly requested
- When running queries, migrations, or any database operations, always pass the development branch ID