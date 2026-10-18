import { isOAuthProviderId, OAUTH_PROVIDERS } from "@/lib/oauth-providers";

export function getProfileApplicationError(error: unknown, provider: unknown): string | null {
  const providerName = isOAuthProviderId(provider) ? OAUTH_PROVIDERS[provider].name : "this provider";

  if (error === "OAuthAccountNotLinked") {
    return `That ${providerName} account is already linked to another Bearxus account. Sign in with that account before trying again.`;
  }

  if (error === "OAuthSignin") {
    return `Unable to connect ${providerName} right now. Please try again.`;
  }

  return null;
}
