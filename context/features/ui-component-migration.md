# UI Component Migration & Audit Specification

## Overview

Audit and update all existing authentication pages and modular layout components to utilize our newly configured core primitives (shadcn/ui + Base UI + `Text` framework) while standardizing styling to work seamlessly with our custom purple OKLCH design tokens.

## Requirements

- **Primitive Component Replacement:** Systematically replace all legacy form fields, card containers, dialog structures, menus, and layout grids with our newly initialized shadcn/Base UI tools (`button`, `card`, `dropdown-menu`, `input`, `label`, `separator`, etc.).
- **Typography Standardization:** Migrate all native header markers (`<h1>`-`<h4>`), helper text spans, copy lines, labels, and micro-descriptions to use our new type-safe, polymorphic `<Text />` primitive.
- **Base UI Structural Overhaul:** Ensure all custom component wrappers, triggers, or external link mappings conform to Base UI's native **`render` prop** pattern rather than legacy Radix `asChild` composition models.
- **Theme Variable Alignment:** Remove any residual hardcoded styling hooks or conflicting selectors to ensure complete background and element interpolation across light and dark color schemes.

## References

### Targeted Pages
- `app/(auth)/sign-in/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/(auth)/verify-email/page.tsx`
- `app/(dashboard)/profile/page.tsx`
- `app/(dashboard)/dashboard/page.tsx`

### Targeted Components
- `components/auth/AuthField.tsx`
- `components/auth/AuthShell.tsx`
- `components/auth/SignInForm.tsx`
- `components/auth/RegisterForm.tsx`
- `components/auth/ForgotPasswordForm.tsx`
- `components/auth/ResetPasswordForm.tsx`
- `components/auth/VerificationForm.tsx`
- `components/profile/ProfileActions.tsx`
- `components/profile/UserAvatar.tsx`
- `components/profile/UserMenu.tsx`

## Notes

This application relies on **Next.js v16** and **Tailwind CSS v4**. Do not use legacy `@layer` directives or deprecated utility declarations when optimizing component properties. 