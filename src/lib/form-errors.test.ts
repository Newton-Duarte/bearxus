import { describe, expect, it } from "vitest";
import type { $ZodIssueBase } from "zod/v4/core";

import { getFirstFieldErrors } from "@/lib/form-errors";

describe("getFirstFieldErrors", () => {
  it("keeps the first message for each allowed field", () => {
    const issues: Array<Pick<$ZodIssueBase, "path" | "message">> = [
      { path: ["email"], message: "Enter an email address." },
      { path: ["email"], message: "Email is invalid." },
      { path: ["password"], message: "Password is too short." },
    ];

    expect(getFirstFieldErrors(issues, ["email", "password"])).toEqual({
      email: "Enter an email address.",
      password: "Password is too short.",
    });
  });

  it("ignores disallowed fields and uses the first path segment", () => {
    const issues: Array<Pick<$ZodIssueBase, "path" | "message">> = [
      { path: ["token"], message: "Token is invalid." },
      { path: ["password", "minLength"], message: "Password is too short." },
      { path: [], message: "Form is invalid." },
    ];

    expect(getFirstFieldErrors(issues, ["password"])).toEqual({ password: "Password is too short." });
  });
});
