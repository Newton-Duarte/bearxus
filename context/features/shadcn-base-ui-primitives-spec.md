# shadcn/ui + Base UI Setup

## Overview

Use the already configured shadcn/ui with the Base UI styling engine (`base-nova`), and implement a type-safe polymorphic `Text` primitive alongside the application core modules.

## Requirements

* **Unified Core Component Kit:** Install `button`, `card`, `dropdown-menu`, `dialog`, `sheet`, `select`, `input`, `label`, `separator`, and `tabs` via shadcn CLI pointing to the Base UI architecture.
* **Modern Composition Standard:** Transition completely to the **`render` prop** pattern for structural sub-element overriding instead of legacy Radix `asChild` methods.
* **Polymorphic Typography Primitive:** Implement a type-safe, flexible `<Text />` engine mapping semantic layout targets directly to our custom purple token balances.
* **Next.js v16 Compatibility:** Avoid runtime or build-time hydration mismatches by tracking clean token dependencies and native standard configurations.

---

### Step 1: Initial Infrastructure Generation

```bash
pnpm dlx shadcn@latest add button card dropdown-menu dialog sheet select input label separator tabs
```

---

### Step 2: Implement the Polymorphic Typography Engine

Create your production-ready, highly composable text framework inside your UI tree. It utilizes `class-variance-authority` (cva) to map responsive typography presets to your custom purple/neutral OKLCH theme keys.

`components/ui/text.tsx`
```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textVariants = cva("text-foreground antialiased", {
  variants: {
    variant: {
      h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-balance",
      h2: "scroll-m-20 border-b border-border pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-balance",
      h3: "scroll-m-20 text-2xl font-semibold tracking-tight text-balance",
      h4: "scroll-m-20 text-xl font-semibold tracking-tight text-balance",
      body: "leading-7 [&:not(:first-child)]:mt-4 text-base",
      lead: "text-xl text-muted-foreground font-normal",
      large: "text-lg font-semibold",
      small: "text-sm font-medium leading-none",
      muted: "text-sm text-muted-foreground",
      code: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-primary",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

// Leverage a clean generic parameter to dynamically evaluate valid HTML attributes based on the 'as' element
export type TextProps<T extends React.ElementType> = {
  as?: T;
} & VariantProps<typeof textVariants> &
  Omit<React.ComponentPropsWithoutRef<T>, "as" | "className"> & {
    className?: string;
  };

export function Text<T extends React.ElementType = "p">({
  className,
  variant,
  as,
  ...props
}: TextProps<T>) {
  // Infer smart HTML fallbacks when headings are requested without manual element declarations
  const Component = as || (variant && ["h1", "h2", "h3", "h4"].includes(variant) ? variant : "p");

  return (
    <Component
      className={cn(textVariants({ variant, className }))}
      {...props}
    />
  );
}

Text.displayName = "Text";
```
