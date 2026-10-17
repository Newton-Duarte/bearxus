"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type TextFieldProps = ComponentProps<typeof Input> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
};

export function TextField({
  id,
  label,
  description,
  error,
  className,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: TextFieldProps) {
  const generatedId = useId().replace(/:/g, "");
  const fieldId = id ?? `field-${generatedId}`;
  const hasDescription = description !== undefined && description !== null && description !== false;
  const hasError = error !== undefined && error !== null && error !== false;
  const descriptionId = hasDescription ? `${fieldId}-description` : undefined;
  const errorId = hasError ? `${fieldId}-error` : undefined;
  const describedBy = [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="text-field" className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        {...props}
        id={fieldId}
        aria-describedby={describedBy}
        aria-invalid={hasError ? true : ariaInvalid}
        className={cn("h-11", className)}
      />
      {hasDescription ? (
        <Text as="p" variant="muted" id={descriptionId} className="text-xs leading-5">
          {description}
        </Text>
      ) : null}
      {hasError ? (
        <Text as="p" variant="muted" id={errorId} className="text-xs leading-5 text-destructive">
          {error}
        </Text>
      ) : null}
    </div>
  );
}

TextField.displayName = "TextField";
