import { describe, expect, it } from "vitest";

import { getAuthRedirect } from "@/lib/auth-redirect";

describe("getAuthRedirect", () => {
  it.each([
    "/dashboard",
    "/profile?tab=security#password",
    "/projects/one",
  ])("preserves safe internal destination %j", (destination) => {
    expect(getAuthRedirect(destination)).toBe(destination);
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "dashboard",
    "/sign-in",
    "/register/invite",
    "/api/auth/session",
    "/dashboard%2Fsecret",
    "/dashboard%00",
    "/dashboard%20secret",
    "/dashboard%ZZ",
  ])("falls back for unsafe destination %j", (destination) => {
    expect(getAuthRedirect(destination)).toBe("/dashboard");
  });

  it("falls back for non-string values", () => {
    expect(getAuthRedirect(null)).toBe("/dashboard");
    expect(getAuthRedirect(undefined)).toBe("/dashboard");
    expect(getAuthRedirect({})).toBe("/dashboard");
  });
});
