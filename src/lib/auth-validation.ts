import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(72, "Password must not exceed 72 UTF-8 bytes.")
  .refine((password) => new TextEncoder().encode(password).length <= 72, {
    error: "Password must not exceed 72 UTF-8 bytes.",
  });

export const verificationEmailSchema = z.object({
  email: z.string().trim().max(254).toLowerCase().pipe(z.email()),
});

export const signInSchema = verificationEmailSchema.extend({
  password: passwordSchema,
});

export const registrationSchema = signInSchema
  .extend({
    name: z.string().trim().min(1).max(100),
    confirmPassword: passwordSchema,
  })
  .refine((input) => input.password === input.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const passwordResetRequestSchema = verificationEmailSchema;

export const passwordResetSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/, "This reset link is invalid."),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((input) => input.password === input.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((input) => input.password === input.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });
