import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { projects } from "./projects";
import { learningResources } from "./resources";
import { tasks } from "./tasks";

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

export type ActivityMetadata = Record<string, unknown>;

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

export const activitiesRelations = relations(activities, ({ one }) => ({
  owner: one(users, {
    fields: [activities.ownerId],
    references: [users.id],
    relationName: "activityOwner",
  }),
  actor: one(users, {
    fields: [activities.actorId],
    references: [users.id],
    relationName: "activityActor",
  }),
  project: one(projects, {
    fields: [activities.projectId, activities.ownerId],
    references: [projects.id, projects.userId],
    relationName: "projectActivity",
  }),
  task: one(tasks, {
    fields: [activities.taskId, activities.ownerId],
    references: [tasks.id, tasks.userId],
    relationName: "taskActivity",
  }),
  learningResource: one(learningResources, {
    fields: [activities.learningResourceId, activities.ownerId],
    references: [learningResources.id, learningResources.userId],
    relationName: "learningResourceActivity",
  }),
}));
