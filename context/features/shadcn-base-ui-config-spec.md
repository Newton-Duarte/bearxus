# shadcn/ui + Base UI Setup

## Overview

Set up and configure shadcn/ui with the Base UI styling engine (`base-nova`).

## Requirements

- Configure shadcn/ui to use the **`base` / `base-nova` preset** so that all future component installations utilize `@base-ui-components/react` instead of Radix UI.
- Use **pnpm** as the package manager.
- Integrate custom theme CSS variables previously copied from the `shadcn/create` design playground.
- Configure Tailwind CSS to align with the new Base UI utility structures and token mapping.
- Standardize on the **`render` prop** architecture for component composition rather than the legacy Radix `asChild` pattern.

## References

- shadcn/ui Base Engine Documentation: https://ui.shadcn.com
- Base UI Primitives Reference: https://base-ui.com

## Notes

This project runs on **Next.js v16**. Ensure that initialized component layouts, types, and compositions do not introduce breaking patterns or outdated reference mappings.

The current shadcn/ui `base-nova` registry installs `@base-ui/react`; `@base-ui-components/react` is the older package name referenced in the requirement above.
