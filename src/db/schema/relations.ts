import { relations } from "drizzle-orm";

import { accounts, sessions, users } from "./auth";
import {
  activities,
  learningResources,
  noteLinks,
  notes,
  projectStages,
  projects,
  tasks,
  transactions,
} from "./workspace";

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  projects: many(projects),
  projectStages: many(projectStages),
  tasks: many(tasks),
  notes: many(notes),
  noteLinks: many(noteLinks),
  ownedActivities: many(activities, { relationName: "activityOwner" }),
  actedActivities: many(activities, { relationName: "activityActor" }),
  learningResources: many(learningResources),
  transactions: many(transactions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  stages: many(projectStages),
  tasks: many(tasks),
  activities: many(activities, { relationName: "projectActivity" }),
}));

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

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  sourceLinks: many(noteLinks, { relationName: "noteLinkSource" }),
  targetLinks: many(noteLinks, { relationName: "noteLinkTarget" }),
}));

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

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));
