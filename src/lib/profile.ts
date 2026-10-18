import "server-only";

import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { OAUTH_PROVIDER_IDS } from "@/lib/oauth-providers";
import {
  learningResources,
  notes,
  projects,
  tasks,
  transactions,
  users,
  accounts,
} from "@/db/schema";
import type { ProfileData } from "@/types/profile";

export async function getProfileData(userId: string): Promise<ProfileData | null> {
  const [user, linkedAccounts, [noteCount], [projectCount], [taskCount], [resourceCount], [transactionCount]] = await Promise.all([
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
    db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ total: count() }).from(notes).where(eq(notes.userId, userId)),
    db.select({ total: count() }).from(projects).where(eq(projects.userId, userId)),
    db.select({ total: count() }).from(tasks).where(eq(tasks.userId, userId)),
    db.select({ total: count() }).from(learningResources).where(eq(learningResources.userId, userId)),
    db.select({ total: count() }).from(transactions).where(eq(transactions.userId, userId)),
  ]);

  if (!user) return null;

  const linkedProviderIds = new Set(linkedAccounts.map(account => account.provider));
  const hasAlternativeSignIn = user.passwordHash !== null || linkedAccounts.length > 1;

  return {
    user: {
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      canChangePassword: user.passwordHash !== null,
    },
    authorizedApplications: OAUTH_PROVIDER_IDS.map(provider => ({
      provider,
      connected: linkedProviderIds.has(provider),
      canDisconnect: hasAlternativeSignIn,
    })),
    stats: {
      notes: Number(noteCount.total),
      projects: Number(projectCount.total),
      tasks: Number(taskCount.total),
      resources: Number(resourceCount.total),
      transactions: Number(transactionCount.total),
    },
  };
}
