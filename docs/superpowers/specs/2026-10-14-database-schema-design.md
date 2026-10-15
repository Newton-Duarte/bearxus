# Bearxus Database Schema Design

## Intent

Set up the first durable data layer for Bearxus with Drizzle ORM and Neon PostgreSQL. The schema should support the connected workspace at the center of the product: Markdown notes, related-note links, projects, tasks, learning resources, and meaningful item activity.

This is a schema and migration foundation for the fresh Next.js 16 App Router application. It is not the implementation of the application UI or workflow services.

## Goals

- Connect the application to the Neon development branch through `DATABASE_URL`.
- Define the initial project data model from `context/project-overview.md`.
- Support NextAuth/Auth.js database models: User, Account, Session, and VerificationToken.
- Support mutual “related note” links with backlinks.
- Give projects, tasks, and learning resources independent activity timelines.
- Represent both meaningful workflow events and manual comments as activity entries.
- Enforce ownership, referential integrity, useful indexes, and safe cascade behavior.
- Generate versioned Drizzle migrations; never use direct schema push for this feature.

## Non-goals

- Building authentication screens or application UI.
- Implementing note, project, task, or activity workflows.
- Logging every field edit or every Markdown save.
- Adding direct note-to-project, note-to-task, or note-to-learning-resource links.
- Adding comments or activity timelines to notes.
- Building command-palette search, exports, analytics, or content-studio behavior.

## Core model

### User and authentication

Use the Auth.js/NextAuth adapter model as the authentication boundary:

- `users`: id, name, email, emailVerified, image, optional password hash, timestamps.
- `accounts`: provider account identity and OAuth token fields, cascading to the user.
- `sessions`: session token, user reference, expiration, cascading to the user.
- `verification_tokens`: provider token, identifier, and expiration using the adapter’s required uniqueness.

Passwords must never be stored in plaintext. The application may use a credentials provider later, but the database should store only a suitable password hash if password authentication is enabled.

Every user-owned Bearxus record must reference `users.id` and be inaccessible without an ownership check in application code.

For the first version, each user is the sole owner of an isolated workspace. Related records must belong to that same user: both notes in a note link, a task and its project/column, and an activity actor and target. Do not add shared workspaces, memberships, invitations, or cross-user actions yet. Keep the activity actor reference separate so a future collaboration model can distinguish the actor from the workspace owner.

### Projects and tasks

- `projects`: name, description, type, status, progress, user reference, timestamps.
- `project_stages`: name, color, position, project reference.
- `tasks`: title, description, priority, due date, project reference, stage reference, timestamps.

Tasks belong to a project and a project stage. A project deletion cascades to its stages, tasks, and related activity. A stage should not silently delete its tasks; deleting a stage must be restricted or require task reassignment.

The schema must also prevent a task from referencing a stage belonging to a different project. Use a composite relationship between the task's project and stage, or an equivalent database-enforced constraint, rather than relying only on application validation.

### Notes and note links

- `notes`: title, Markdown content, text-array tags, user reference, timestamps.
- `note_links`: one canonical row representing a mutual relationship between two notes.

Note links have no direction or relationship type in the first version. The database should prevent self-links and duplicate pairs. The application normalizes the two note IDs before insertion; queries should expose linked notes from either side. Deleting either note cascades to its links.

Notes do not have comments or activity timelines. Link creation/removal is represented by the current relationship, not by an activity event.

### Activity

Use one append-oriented `activities` table for the separate timelines of projects, tasks, and learning resources. A record contains:

- actor/user reference;
- exactly one target reference: project, task, or learning resource;
- an event type;
- optional human-readable content for manual comments;
- optional JSON metadata for structured before/after values;
- creation timestamp.

The target must be explicit and queryable. The schema must preserve referential integrity when an activity target is deleted, either with a constrained set of nullable foreign keys plus a check constraint or an equivalent strongly validated design; an unvalidated `entityType`/`entityId` pair alone is not sufficient.

Initial event types should cover meaningful workflow changes only:

- `comment`
- `created`
- `status_changed`
- `moved`
- `priority_changed`
- `due_date_changed`
- `completed`
- `reopened`
- `progress_changed`

The event writer is responsible for emitting these events. The schema does not need database triggers for the first version. Activity entries are historical and should not be updated as part of normal workflow edits. Project timelines show project activity only; task activity is not rolled up into its project timeline.

Activity belongs to its target item rather than serving as an independent audit archive. Deleting a project, task, or learning resource cascades to its activity entries.

### Learning resources

- `learning_resources`: title, type, status, progress percentage, user reference, timestamps.
- Learning resources use their own independent activity timeline. Status and progress changes are meaningful activity events; manual comments are `comment` activity entries.

### Transactions

Keep the initial financial model required by the project specification:

- `transactions`: income/expense type, numeric amount, category, date, notes, user reference, created timestamp.

Financial workflow behavior is outside this feature, but the table must be owned by a user and indexed for user/date queries.

## Integrity and indexes

- Use stable generated primary keys and UTC timestamps consistently across tables.
- Add foreign-key indexes for user, project, stage, task, and activity target lookups.
- Index activity timelines by target and descending creation time.
- Index note links from both note endpoints.
- Enforce bounded values such as progress percentages and valid enum values at the schema boundary where practical.
- Use unique constraints for user email, session tokens, account provider identities, and canonical note-link pairs.
- Use cascade deletes for user-owned records and note links; use restrictive behavior where cascading could silently destroy work, especially project stages with tasks.

## Migration and environment

- Add Drizzle ORM, Drizzle Kit, the Neon serverless driver, and the Auth.js Drizzle adapter as project dependencies where required by the chosen integration.
- Add a Drizzle configuration and schema module under the project’s existing `src` structure.
- Add a safe `.env.example` documenting `DATABASE_URL`; do not commit credentials.
- Generate an initial migration with `drizzle-kit generate` and verify it matches the schema.
- Use only the Neon development branch for local development and migration verification. Production is off limits unless explicitly authorized.
- Do not use `drizzle-kit push` for this feature.

## Success criteria

- The fresh application has a typed Drizzle schema for all required entities and relationships.
- NextAuth/Auth.js adapter tables are present and compatible with the selected adapter.
- Related-note links cannot self-link or duplicate and can be queried in either direction.
- Activity supports independent project, task, and learning-resource timelines with manual comments and meaningful workflow event metadata.
- Foreign keys, indexes, and deletion behavior reflect the rules above.
- A generated migration exists, is reviewable, and can be applied to the Neon development branch without modifying production.

## Builder decisions

The implementer may choose exact table naming, enum representation, ID generation strategy, Drizzle module layout, Neon driver wiring, and the concrete strongly validated representation for the activity target, provided the goals and integrity rules above remain true. The implementer should follow current package documentation and the repository’s Next.js 16 conventions.
