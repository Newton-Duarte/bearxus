"use server";

import { compare, hash } from "bcryptjs";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { changePasswordSchema } from "@/lib/auth-validation";
import { getFirstFieldErrors } from "@/lib/form-errors";
import { isOAuthProviderId, OAUTH_PROVIDERS } from "@/lib/oauth-providers";
import type { ChangePasswordState, UnlinkProviderState } from "@/types/profile";

export async function connectOAuthProvider(provider: unknown, _formData: FormData): Promise<void> {
  void _formData;

  if (!isOAuthProviderId(provider)) {
    redirect("/profile?error=OAuthSignin");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=%2Fprofile");
  }

  try {
    await signIn(provider, { redirectTo: "/profile" });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    redirect(error.type === "OAuthAccountNotLinked"
      ? `/profile?error=OAuthAccountNotLinked&provider=${provider}`
      : `/profile?error=OAuthSignin&provider=${provider}`);
  }
}

export async function unlinkOAuthProvider(
  provider: unknown,
  _previous: UnlinkProviderState,
  _formData: FormData,
): Promise<UnlinkProviderState> {
  void _previous;
  void _formData;

  if (!isOAuthProviderId(provider)) {
    return { success: false, error: "That application is not supported." };
  }

  const providerName = OAUTH_PROVIDERS[provider].name;

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Your session has expired. Sign in again." };
  }

  try {
    const [deletedAccount] = await db
      .delete(accounts)
      .where(and(
        eq(accounts.userId, session.user.id),
        eq(accounts.provider, provider),
        sql`(
          EXISTS (
            SELECT 1 FROM ${users}
            WHERE ${users.id} = ${accounts.userId}
              AND ${users.passwordHash} IS NOT NULL
          )
          OR EXISTS (
            SELECT 1 FROM ${accounts} AS other_accounts
            WHERE other_accounts.user_id = ${accounts.userId}
              AND other_accounts.provider <> ${accounts.provider}
          )
        )`,
      ))
      .returning({ provider: accounts.provider });

    if (!deletedAccount) {
      return { success: false, error: `${providerName} is not connected or is your only sign-in method.` };
    }

    revalidatePath("/profile");
    return { success: true, error: null };
  } catch {
    return { success: false, error: `Unable to disconnect ${providerName} right now.` };
  }
}

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
    const fieldErrors = getFirstFieldErrors(parsed.error.issues, ["currentPassword", "password", "confirmPassword"]);
    return { success: false, error: "Check the highlighted fields and try again.", fieldErrors };
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
