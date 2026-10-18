import { describe, expect, it } from "vitest";

import {
  isOAuthProviderId,
  OAUTH_PROVIDER_IDS,
  OAUTH_PROVIDERS,
} from "@/lib/oauth-providers";

describe("OAuth provider registry", () => {
  it("contains GitHub as the currently supported provider", () => {
    expect(OAUTH_PROVIDER_IDS).toEqual(["github"]);
    expect(OAUTH_PROVIDERS.github.name).toBe("GitHub");
    expect(isOAuthProviderId("github")).toBe(true);
  });

  it("rejects provider values outside the allowlist", () => {
    expect(isOAuthProviderId("google")).toBe(false);
    expect(isOAuthProviderId(undefined)).toBe(false);
  });
});
