import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isEmailVerificationEnabled } from "@/lib/email-verification-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isEmailVerificationEnabled", () => {
  it.each([undefined, "true", "TRUE", "1"])("defaults to enabled for %j", (value) => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", value);

    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it("disables verification only for an explicit false value", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "false");

    expect(isEmailVerificationEnabled()).toBe(false);
  });
});
