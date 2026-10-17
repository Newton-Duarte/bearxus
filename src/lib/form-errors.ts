import type { $ZodIssueBase } from "zod/v4/core";

export function getFirstFieldErrors<T extends string>(
  issues: readonly Pick<$ZodIssueBase, "path" | "message">[],
  allowedFields: readonly T[],
): Partial<Record<T, string>> {
  const allowed = new Set(allowedFields);
  const fieldErrors: Partial<Record<T, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !allowed.has(field as T) || field in fieldErrors) continue;
    fieldErrors[field as T] = issue.message;
  }

  return fieldErrors;
}
