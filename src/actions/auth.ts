"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";
import { EmailNotVerifiedError } from "@/lib/auth-errors";
import { getAuthRedirect } from "@/lib/auth-redirect";
import { signInSchema } from "@/lib/auth-validation";
import { checkAuthRateLimit, getRateLimitMessage } from "@/lib/rate-limit";
import type { AuthFormState } from "@/types/auth";

export async function signInWithCredentials(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: AuthFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "password") fieldErrors[field] ??= issue.message;
    }
    return { success: false, data: null, error: "Check your email and password.", fieldErrors };
  }

  const rateLimit = await checkAuthRateLimit("login", await headers(), parsed.data.email);
  if (!rateLimit.success) {
    return { success: false, data: null, error: getRateLimitMessage(rateLimit) };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: getAuthRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    if (error instanceof EmailNotVerifiedError) {
      return {
        success: false, data: null,
        error: "Verify your email before signing in. You can request a new verification link.",
        requiresEmailVerification: true,
      };
    }
    return {
      success: false,
      data: null,
      error: error.type === "CredentialsSignin"
        ? "Email or password is incorrect. Try again."
        : "Unable to sign in right now. Please try again.",
    };
  }

  return { success: true, data: null, error: null };
}

export async function signInWithGitHub(formData: FormData): Promise<void> {
  try {
    await signIn("github", { redirectTo: getAuthRedirect(formData.get("callbackUrl")) });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    redirect("/sign-in?error=OAuthSignin");
  }
}

export async function signOutUser(): Promise<void> {
  await signOut({ redirectTo: "/sign-in" });
}
