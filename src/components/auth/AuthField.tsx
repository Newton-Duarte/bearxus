"use client";

import { useId, type InputHTMLAttributes } from "react";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}

export function AuthField({ id, name, label, error, hint, ...props }: AuthFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `${name}-${generatedId}`;
  const descriptionId = `${fieldId}-description`;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-sm font-medium">{label}</label>
      <input
        {...props}
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? descriptionId : undefined}
        className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60 aria-invalid:border-destructive sm:text-sm"
      />
      {error || hint ? <p id={descriptionId} className={`mt-2 text-xs leading-5 ${error ? "text-destructive" : "text-muted-foreground"}`}>{error || hint}</p> : null}
    </div>
  );
}
