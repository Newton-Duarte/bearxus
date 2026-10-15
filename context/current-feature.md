# Current Feature: Drizzle + Neon PostgreSQL Setup

<!-- Feature Name -->

## Status

Complete

## Goals

- Set up Drizzle ORM with Neon PostgreSQL using the development branch.
- Create the initial schema from the project data models.
- Include NextAuth models: Account, Session, and VerificationToken.
- Add appropriate indexes and cascade deletes.
- Create migrations with Drizzle Kit; do not push directly unless explicitly requested.

## Notes

- The schema is an initial version and will evolve during implementation.
- `DATABASE_URL` should point to the development Neon branch; production is off limits.
- Reference: `context/features/database-spec.md`.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-10-15: Added the Drizzle + Neon PostgreSQL schema and initial development migration.
