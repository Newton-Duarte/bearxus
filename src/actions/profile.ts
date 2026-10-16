"use server";

import { compare, hash } from "bcryptjs";
import { and, eq, isNotNull } from "drizzle-orm";

import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { changePasswordSchema } from "@/lib/auth-validation";
import type { ChangePasswordState } from "@/types/profile";

export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Your session has expired. Sign in again." };
  }

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: ChangePasswordState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "currentPassword" || field === "password" || field === "confirmPassword") {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { success: false, error: "Check the password fields below.", fieldErrors };
  }

  try {
    const user = await db.query.users.findFirst({
      columns: { passwordHash: true },
      where: eq(users.id, session.user.id),
    });
    if (!user?.passwordHash || !(await compare(parsed.data.currentPassword, user.passwordHash))) {
      return { success: false, error: "Your current password is incorrect." };
    }

    const passwordHash = await hash(parsed.data.password, 12);
    const [updatedUser] = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, session.user.id), isNotNull(users.passwordHash)))
      .returning({ id: users.id });

    if (!updatedUser) {
      return { success: false, error: "Unable to change your password right now." };
    }
  } catch {
    return { success: false, error: "Unable to change your password right now." };
  }

  return { success: true, error: null };
}

export async function deleteAccount(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    await signOut({ redirectTo: "/sign-in?callbackUrl=%2Fprofile" });
    return;
  }

  await db.delete(users).where(eq(users.id, session.user.id));
  await signOut({ redirectTo: "/sign-in?deleted=1" });
}
