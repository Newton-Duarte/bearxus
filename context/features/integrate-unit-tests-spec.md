# Integrate Unit Tests: Server Logic & Utility Unit Testing Spec

## Overview
Implement an isolated backend unit testing layer using **Vitest** for our Next.js v16 server actions and global utility, keeping component rendering entirely out of scope.

## Requirements
- **Testing Architecture Framework:** Standardize completely on **Vitest**.
- **Server Action Validation Blocks:** Create tests for our core backend data handlers (`signInAction`, `registerAction`, etc.). Use `vi.mock` to intercept and bypass external dependencies, and Next.js internal calls (`next/navigation`, `next/headers`). Use `vi.useFakeTimers()` for time-dependent logic. Keep test files next to source files: `feature.test.ts`.
- **Utility Isolation:** Provide examples for testing isolated pure functions (e.g., currency parsers, data formatting maps, permission hooks) checking edge cases and payload matrices without browser environment contamination.
- **Project Context:** Update the project context (`context/*`) files if needed and any other docs that you see fit.

## Notes
Do not install `jsdom`, `@testing-library/react`, or any component-based dependencies. Keep the layout focused purely on fast, lightweight Node-based function execution.
