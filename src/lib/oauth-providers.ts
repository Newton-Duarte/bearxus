export const OAUTH_PROVIDERS = {
  github: {
    name: "GitHub",
  },
} as const;

export type OAuthProviderId = keyof typeof OAUTH_PROVIDERS;

export const OAUTH_PROVIDER_IDS = Object.keys(OAUTH_PROVIDERS) as OAuthProviderId[];

export function isOAuthProviderId(value: unknown): value is OAuthProviderId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(OAUTH_PROVIDERS, value);
}
