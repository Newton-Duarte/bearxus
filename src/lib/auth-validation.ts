import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(72, "Password must not exceed 72 UTF-8 bytes.")
  .refine((password) => new TextEncoder().encode(password).length <= 72, {
    error: "Password must not exceed 72 UTF-8 bytes.",
  });

export const signInSchema = z.object({
  email: z.string().trim().max(254).toLowerCase().pipe(z.email()),
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
