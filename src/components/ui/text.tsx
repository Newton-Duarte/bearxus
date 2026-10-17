import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textVariants = cva("text-foreground antialiased", {
  variants: {
    variant: {
      h1: "scroll-m-20 text-4xl font-extrabold tracking-tight text-balance lg:text-5xl",
      h2: "scroll-m-20 border-b border-border pb-2 text-3xl font-semibold tracking-tight text-balance first:mt-0",
      h3: "scroll-m-20 text-2xl font-semibold tracking-tight text-balance",
      h4: "scroll-m-20 text-xl font-semibold tracking-tight text-balance",
      body: "text-base leading-7 [&:not(:first-child)]:mt-4",
      lead: "text-xl font-normal text-muted-foreground",
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

type TextOwnProps<T extends React.ElementType> = {
  as?: T;
  className?: string;
} & VariantProps<typeof textVariants>;

export type TextProps<T extends React.ElementType = "p"> = TextOwnProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof TextOwnProps<T>>;

const headingVariants = new Set(["h1", "h2", "h3", "h4"]);

export function Text<T extends React.ElementType = "p">({
  className,
  variant,
  as,
  ...props
}: TextProps<T>) {
  const Component =
    as ?? (variant && headingVariants.has(variant) ? variant : "p");

  return React.createElement(Component, {
    ...props,
    className: cn(textVariants({ variant, className })),
  });
}

Text.displayName = "Text";

export { textVariants };
