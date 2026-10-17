import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  passwordResetSchema,
  passwordSchema,
  registrationSchema,
  verificationEmailSchema,
} from "@/lib/auth-validation";

describe("verificationEmailSchema", () => {
  it.each([
    ["  User@Example.COM ", "user@example.com"],
    ["admin+alerts@bearxus.dev", "admin+alerts@bearxus.dev"],
  ])("normalizes %j to %j", (input, expected) => {
    const result = verificationEmailSchema.safeParse({ email: input });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe(expected);
  });

  it.each(["", "not-an-email", "missing-domain@", "@missing-user.com"])(
    "rejects invalid email %j",
    (email) => {
      expect(verificationEmailSchema.safeParse({ email }).success).toBe(false);
    },
  );
});

describe("passwordSchema", () => {
  it.each([
    ["12345678", true],
    ["1234567", false],
    ["é".repeat(36), true],
    ["é".repeat(37), false],
    ["😀".repeat(18), true],
    ["😀".repeat(19), false],
  ])("validates UTF-8 password payload %j as %j", (password, valid) => {
    expect(passwordSchema.safeParse(password).success).toBe(valid);
  });
});

describe("registrationSchema", () => {
  it("rejects a confirmation mismatch at confirmPassword", () => {
    const result = registrationSchema.safeParse({
      name: "Bear",
      email: "bear@example.com",
      password: "password123",
      confirmPassword: "different123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["confirmPassword"], message: "Passwords do not match." }),
      );
    }
  });
});

describe("passwordResetSchema", () => {
  it.each([
    ["a".repeat(64), true],
    ["A".repeat(64), false],
    ["a".repeat(63), false],
  ])("validates reset token shape %j as %j", (token, valid) => {
    expect(passwordResetSchema.safeParse({
      token,
      password: "password123",
      confirmPassword: "password123",
    }).success).toBe(valid);
  });
});

describe("changePasswordSchema", () => {
  it("rejects a new password confirmation mismatch", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old-password",
      password: "new-password",
      confirmPassword: "different-password",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["confirmPassword"], message: "Passwords do not match." }),
      );
    }
  });
});
