import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { sendVerificationEmail } from "@/lib/email";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";
import type { VerificationResult, VerificationSendResult } from "@/types/email-verification";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function verificationUrl(token: string): string {
  const configured = process.env.AUTH_URL;
  if (!configured && process.env.NODE_ENV !== "development") {
    throw new Error("AUTH_URL is required for verification emails.");
  }
  const origin = new URL(configured || "http://localhost:3000");
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password
    || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("AUTH_URL must be an HTTP(S) origin.");
  }
  const url = new URL("/api/auth/verify-email", origin);
  url.searchParams.set("token", token);
  return url.href;
}

export async function requestEmailVerification(email: string): Promise<VerificationSendResult> {
  if (!isEmailVerificationEnabled()) return { status: "ineligible", retryAfterSeconds: 60 };
  const user = await db.query.users.findFirst({
    columns: { id: true, email: true },
    where: and(eq(users.email, email.trim().toLowerCase()), isNull(users.emailVerified), isNotNull(users.passwordHash)),
  });
  if (!user) return { status: "ineligible", retryAfterSeconds: 60 };

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  let url: string;
  try {
    url = verificationUrl(token);
  } catch {
    return { status: "failed", retryAfterSeconds: 60 };
  }

  const claimed = await db.execute(sql`
    insert into ${emailVerifications} (user_id, token_hash, expires_at, last_sent_at)
    select ${users.id}, ${tokenHash}, now() + interval '24 hours', now()
    from ${users}
    where ${users.id} = ${user.id} and ${users.emailVerified} is null and ${users.passwordHash} is not null
    on conflict (user_id) do update set
      token_hash = excluded.token_hash, expires_at = excluded.expires_at, last_sent_at = excluded.last_sent_at
    where ${emailVerifications.lastSentAt} <= now() - interval '60 seconds'
    returning user_id
  `);
  if (!claimed.rows.length) return { status: "cooldown", retryAfterSeconds: 60 };

  try {
    await sendVerificationEmail(user.email, url);
    return { status: "sent", retryAfterSeconds: 60 };
  } catch {
    await db.update(emailVerifications).set({ tokenHash: hashToken(randomBytes(32).toString("hex")) })
      .where(and(eq(emailVerifications.userId, user.id), eq(emailVerifications.tokenHash, tokenHash)));
    return { status: "failed", retryAfterSeconds: 60 };
  }
}

export async function verifyEmailToken(token: string): Promise<VerificationResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) return "invalid";

  const consumed = db.$with("consumed").as(
    db.delete(emailVerifications)
      .where(and(eq(emailVerifications.tokenHash, hashToken(token)), gt(emailVerifications.expiresAt, sql`now()`)))
      .returning({ userId: emailVerifications.userId }),
  );
  const verified = await db.with(consumed).update(users)
    .set({ emailVerified: sql`now()`, updatedAt: sql`now()` })
    .where(and(
      inArray(users.id, db.select({ userId: consumed.userId }).from(consumed)),
      isNull(users.emailVerified), isNotNull(users.passwordHash),
    ))
    .returning({ id: users.id });
  return verified.length ? "verified" : "invalid";
}
