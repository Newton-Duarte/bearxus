import { describe, expect, it } from "vitest";

import { getProfileApplicationError } from "@/lib/profile-errors";

describe("getProfileApplicationError", () => {
  it("explains that an already-linked GitHub account must use its existing sign-in", () => {
    expect(getProfileApplicationError("OAuthAccountNotLinked", "github")).toBe(
      "That GitHub account is already linked to another Bearxus account. Sign in with that account before trying again.",
    );
  });

  it("returns a generic message for known OAuth failures", () => {
    expect(getProfileApplicationError("OAuthSignin", "github")).toBe("Unable to connect GitHub right now. Please try again.");
  });

  it("does not expose arbitrary query-string values", () => {
    expect(getProfileApplicationError("https://evil.example/steal", "github")).toBeNull();
    expect(getProfileApplicationError(undefined, "github")).toBeNull();
  });
});
