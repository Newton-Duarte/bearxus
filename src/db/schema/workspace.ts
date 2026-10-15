import { sql } from "drizzle-orm";
import {
  check,
  date as pgDate,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "completed",
  "on-hold",
]);

export const learningResourceTypeEnum = pgEnum("learning_resource_type", [
  "book",
  "course",
  "doc",
]);

export const learningResourceStatusEnum = pgEnum("learning_resource_status", [
  "to-start",
  "in-progress",
  "completed",
]);

export const activityEventTypeEnum = pgEnum("activity_event_type", [
  "comment",
  "created",
  "status_changed",
  "moved",
  "priority_changed",
  "due_date_changed",
  "completed",
  "reopened",
  "progress_changed",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
]);

export type ActivityMetadata = Record<string, unknown>;

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const updatedTimestampWithTimezone = (name: string) =>
  timestampWithTimezone(name).$onUpdate(() => new Date());

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    status: projectStatusEnum("status").notNull().default("active"),
    progress: integer("progress").notNull().default(0),
    createdAt: timestampWithTimezone("created_at"),
    updatedAt: updatedTimestampWithTimezone("updated_at"),
  },
  (table) => [
    unique("projects_id_user_id_unique").on(table.id, table.userId),
    check(
      "projects_progress_range_check",
      sql`${table.progress} between 0 and 100`,
    ),
    index("projects_user_id_idx").on(table.userId),
    index("projects_user_status_idx").on(table.userId, table.status),
  ],
);

export const projectStages = pgTable(
  "project_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    foreignKey({
      name: "project_stages_project_owner_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }).onDelete("cascade"),
    unique("project_stages_id_project_user_unique").on(
      table.id,
      table.projectId,
      table.userId,
    ),
    unique("project_stages_project_position_unique").on(
      table.projectId,
      table.position,
    ),
    index("project_stages_user_id_idx").on(table.userId),
    index("project_stages_project_id_idx").on(table.projectId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").notNull(),
    dueDate: pgDate("due_date"),
    createdAt: timestampWithTimezone("created_at"),
    updatedAt: updatedTimestampWithTimezone("updated_at"),
  },
  (table) => [
    foreignKey({
      name: "tasks_project_owner_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "tasks_stage_project_owner_fk",
      columns: [table.stageId, table.projectId, table.userId],
      foreignColumns: [
        projectStages.id,
        projectStages.projectId,
        projectStages.userId,
      ],
    }).onDelete("restrict"),
    unique("tasks_id_user_id_unique").on(table.id, table.userId),
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_stage_id_idx").on(table.stageId),
    index("tasks_project_stage_idx").on(table.projectId, table.stageId),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestampWithTimezone("created_at"),
    updatedAt: updatedTimestampWithTimezone("updated_at"),
  },
  (table) => [
    unique("notes_id_user_id_unique").on(table.id, table.userId),
    index("notes_user_id_idx").on(table.userId),
  ],
);

export const noteLinks = pgTable(
  "note_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noteId: uuid("note_id").notNull(),
    linkedNoteId: uuid("linked_note_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "note_links_note_owner_fk",
      columns: [table.noteId, table.userId],
      foreignColumns: [notes.id, notes.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "note_links_linked_note_owner_fk",
      columns: [table.linkedNoteId, table.userId],
      foreignColumns: [notes.id, notes.userId],
    }).onDelete("cascade"),
    check(
      "note_links_canonical_pair_check",
      sql`${table.noteId} < ${table.linkedNoteId}`,
    ),
    unique("note_links_canonical_pair_unique").on(
      table.noteId,
      table.linkedNoteId,
    ),
    index("note_links_user_id_idx").on(table.userId),
    index("note_links_note_id_idx").on(table.noteId),
    index("note_links_linked_note_id_idx").on(table.linkedNoteId),
  ],
);

export const learningResources = pgTable(
  "learning_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: learningResourceTypeEnum("type").notNull(),
    status: learningResourceStatusEnum("status")
      .notNull()
      .default("to-start"),
    progressPct: integer("progress_pct").notNull().default(0),
    createdAt: timestampWithTimezone("created_at"),
    updatedAt: updatedTimestampWithTimezone("updated_at"),
  },
  (table) => [
    unique("learning_resources_id_user_id_unique").on(
      table.id,
      table.userId,
    ),
    check(
      "learning_resources_progress_range_check",
      sql`${table.progressPct} between 0 and 100`,
    ),
    index("learning_resources_user_id_idx").on(table.userId),
    index("learning_resources_user_status_idx").on(
      table.userId,
      table.status,
    ),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
    taskId: uuid("task_id"),
    learningResourceId: uuid("learning_resource_id"),
    type: activityEventTypeEnum("type").notNull(),
    content: text("content"),
    metadata: jsonb("metadata").$type<ActivityMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "activities_project_owner_fk",
      columns: [table.projectId, table.ownerId],
      foreignColumns: [projects.id, projects.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "activities_task_owner_fk",
      columns: [table.taskId, table.ownerId],
      foreignColumns: [tasks.id, tasks.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "activities_learning_resource_owner_fk",
      columns: [table.learningResourceId, table.ownerId],
      foreignColumns: [learningResources.id, learningResources.userId],
    }).onDelete("cascade"),
    check(
      "activities_one_target_check",
      sql`num_nonnulls(${table.projectId}, ${table.taskId}, ${table.learningResourceId}) = 1`,
    ),
    check(
      "activities_actor_owner_check",
      sql`${table.actorId} = ${table.ownerId}`,
    ),
    index("activities_owner_id_idx").on(table.ownerId),
    index("activities_project_created_at_idx").on(
      table.projectId,
      table.createdAt.desc(),
    ),
    index("activities_task_created_at_idx").on(
      table.taskId,
      table.createdAt.desc(),
    ),
    index("activities_learning_resource_created_at_idx").on(
      table.learningResourceId,
      table.createdAt.desc(),
    ),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category").notNull(),
    date: pgDate("date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("transactions_user_id_idx").on(table.userId),
    index("transactions_user_date_idx").on(table.userId, table.date),
  ],
);
