import { relations } from "drizzle-orm";
import {
  date as pgDate,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { activities } from "./activities";
import { users } from "./auth";
import { projects, projectStages } from "./projects";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const updatedTimestampWithTimezone = (name: string) =>
  timestampWithTimezone(name).$onUpdate(() => new Date());

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

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  stage: one(projectStages, {
    fields: [tasks.stageId, tasks.projectId, tasks.userId],
    references: [
      projectStages.id,
      projectStages.projectId,
      projectStages.userId,
    ],
    relationName: "taskStage",
  }),
  activities: many(activities, { relationName: "taskActivity" }),
}));
