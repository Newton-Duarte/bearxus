# Drizzle + Neon PostgreSQL Setup

## Overview

Set up Drizzle ORM with Neon PostgreSQL database.

## Requirements

- Use Neon PostgreSQL (serverless)
- Create initial schema based on data models in `project-overview.md` (this will evolve)
- Include `NextAuth` models (Account, Session, VerificationToken)
- Add appropriate indexes and cascade deletes

## References

- Initial data models: `@context/project-overview.md`
- Drizzle docs: https://orm.drizzle.team/docs/overview

## Notes

We will have a development branch that we work on that will be in DATABASE_URL and then we will have a production branch. So we ALWAYS create migrations and never push directly unless specified.

You can also look at the setup guide here - https://orm.drizzle.team/docs/get-started/neon-new