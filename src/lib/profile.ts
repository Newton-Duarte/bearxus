import "server-only";

import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  learningResources,
  notes,
  projects,
  tasks,
  transactions,
  users,
} from "@/db/schema";
import type { ProfileData } from "@/types/profile";

export async function getProfileData(userId: string): Promise<ProfileData | null> {
  const [user, [noteCount], [projectCount], [taskCount], [resourceCount], [transactionCount]] = await Promise.all([
    db.query.users.findFirst({
      columns: {
        name: true,
        email: true,
        image: true,
        passwordHash: true,
        createdAt: true,
      },
      where: eq(users.id, userId),
    }),
    db.select({ total: count() }).from(notes).where(eq(notes.userId, userId)),
    db.select({ total: count() }).from(projects).where(eq(projects.userId, userId)),
    db.select({ total: count() }).from(tasks).where(eq(tasks.userId, userId)),
    db.select({ total: count() }).from(learningResources).where(eq(learningResources.userId, userId)),
    db.select({ total: count() }).from(transactions).where(eq(transactions.userId, userId)),
  ]);

  if (!user) return null;

  return {
    user: {
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      canChangePassword: user.passwordHash !== null,
    },
    stats: {
      notes: Number(noteCount.total),
      projects: Number(projectCount.total),
      tasks: Number(taskCount.total),
      resources: Number(resourceCount.total),
      transactions: Number(transactionCount.total),
    },
  };
}
