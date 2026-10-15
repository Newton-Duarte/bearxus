import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { activities } from "./activities";
import { users } from "./auth";
import { tasks } from "./tasks";

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "completed",
  "on-hold",
]);

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

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  stages: many(projectStages),
  tasks: many(tasks),
  activities: many(activities, { relationName: "projectActivity" }),
}));

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

export const projectStagesRelations = relations(
  projectStages,
  ({ one, many }) => ({
    user: one(users, {
      fields: [projectStages.userId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [projectStages.projectId],
      references: [projects.id],
    }),
    tasks: many(tasks, { relationName: "taskStage" }),
  }),
);
