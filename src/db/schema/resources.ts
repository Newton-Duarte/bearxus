import { relations, sql } from "drizzle-orm";
import {
  check,
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

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const updatedTimestampWithTimezone = (name: string) =>
  timestampWithTimezone(name).$onUpdate(() => new Date());

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

export const learningResourcesRelations = relations(
  learningResources,
  ({ one, many }) => ({
    user: one(users, {
      fields: [learningResources.userId],
      references: [users.id],
    }),
    activities: many(activities, { relationName: "learningResourceActivity" }),
  }),
);
