import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const updatedTimestampWithTimezone = (name: string) =>
  timestampWithTimezone(name).$onUpdate(() => new Date());

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

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  sourceLinks: many(noteLinks, { relationName: "noteLinkSource" }),
  targetLinks: many(noteLinks, { relationName: "noteLinkTarget" }),
}));

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

export const noteLinksRelations = relations(noteLinks, ({ one }) => ({
  user: one(users, {
    fields: [noteLinks.userId],
    references: [users.id],
  }),
  note: one(notes, {
    fields: [noteLinks.noteId, noteLinks.userId],
    references: [notes.id, notes.userId],
    relationName: "noteLinkSource",
  }),
  linkedNote: one(notes, {
    fields: [noteLinks.linkedNoteId, noteLinks.userId],
    references: [notes.id, notes.userId],
    relationName: "noteLinkTarget",
  }),
}));
