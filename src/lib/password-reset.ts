import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, exists, gt, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { sendPasswordResetEmail } from "@/lib/email";
import type { PasswordResetResult, PasswordResetSendResult } from "@/types/password-reset";

const RETRY_AFTER_SECONDS = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function resetUrl(token: string): string {
  const configured = process.env.AUTH_URL;
  if (!configured && process.env.NODE_ENV !== "development") {
    throw new Error("AUTH_URL is required for password reset emails.");
  }
  const origin = new URL(configured || "http://localhost:3000");
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password
    || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("AUTH_URL must be an HTTP(S) origin.");
  }
  const url = new URL("/reset-password", origin);
  url.searchParams.set("token", token);
  return url.href;
}

export async function requestPasswordReset(email: string): Promise<PasswordResetSendResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.query.users.findFirst({
    columns: { id: true, email: true },
    where: and(eq(users.email, normalizedEmail), isNotNull(users.passwordHash)),
  });
  if (!user) return { status: "ineligible", retryAfterSeconds: RETRY_AFTER_SECONDS };

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  let url: string;
  try {
    url = resetUrl(token);
  } catch {
    return { status: "failed", retryAfterSeconds: RETRY_AFTER_SECONDS };
  }

  const claimed = await db.execute(sql`
    insert into ${passwordResets} (user_id, token_hash, expires_at, last_sent_at, delivery_status)
    select ${users.id}, ${tokenHash}, now() + interval '24 hours', now(), 'pending'
    from ${users}
    where ${users.id} = ${user.id} and ${users.passwordHash} is not null
    on conflict (user_id) do update set
      token_hash = excluded.token_hash, expires_at = excluded.expires_at, last_sent_at = excluded.last_sent_at, delivery_status = excluded.delivery_status
    where ${passwordResets.lastSentAt} <= now() - interval '60 seconds'
    returning user_id
  `);
  if (!claimed.rows.length) return { status: "cooldown", retryAfterSeconds: RETRY_AFTER_SECONDS };

  try {
    await sendPasswordResetEmail(user.email, url);
    const ready = await db.update(passwordResets)
      .set({ deliveryStatus: "ready" })
      .where(and(eq(passwordResets.userId, user.id), eq(passwordResets.tokenHash, tokenHash)))
      .returning({ userId: passwordResets.userId });
    return ready.length
      ? { status: "sent", retryAfterSeconds: RETRY_AFTER_SECONDS }
      : { status: "failed", retryAfterSeconds: RETRY_AFTER_SECONDS };
  } catch {
    return { status: "failed", retryAfterSeconds: RETRY_AFTER_SECONDS };
  }
}

export async function isUsablePasswordResetToken(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;

  const [reset] = await db.select({ userId: passwordResets.userId })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(and(
      eq(passwordResets.tokenHash, hashToken(token)),
      eq(passwordResets.deliveryStatus, "ready"),
      gt(passwordResets.expiresAt, sql`now()`),
      isNotNull(users.passwordHash),
    ))
    .limit(1);
  return Boolean(reset);
}

export async function resetPasswordToken(token: string, passwordHash: string): Promise<PasswordResetResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) return "invalid";

  const consumed = db.$with("consumed").as(
    db.delete(passwordResets)
      .where(and(
        eq(passwordResets.tokenHash, hashToken(token)),
        eq(passwordResets.deliveryStatus, "ready"),
        gt(passwordResets.expiresAt, sql`now()`),
        exists(db.select({ id: users.id }).from(users).where(and(
          eq(users.id, passwordResets.userId),
          isNotNull(users.passwordHash),
        ))),
      ))
      .returning({ userId: passwordResets.userId }),
  );
  const updated = await db.with(consumed).update(users)
    .set({ passwordHash, updatedAt: sql`now()` })
    .where(inArray(users.id, db.select({ userId: consumed.userId }).from(consumed)))
    .returning({ id: users.id });
  return updated.length ? "reset" : "invalid";
}
