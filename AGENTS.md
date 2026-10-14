<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
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

- Project: `bearxus-dev` (ID: `TODO...`)
- **Always use the development branch** (`TODO...`) for all database operations
- Production branch (`TODO...`) is OFF LIMITS unless explicitly requested
- When running queries, migrations, or any database operations, always pass the development branch ID