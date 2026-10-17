# Authentication Flow & Architecture

## Output

`docs/authentication-research.md`

## Research

Document the complete authentication and security lifecycle of the application, including:
1. **Core Architecture & Configuration**: How NextAuth is initialized (`src/auth.ts` vs `src/auth.config.ts`), integration with Drizzle ORM (`src/db/auth-adapter.ts`), Neon database schema (`src/db/schema/auth.ts`), and session management strategy.
2. **Request Routing & Protection**: How route protection and redirection work via `src/proxy.ts` and `src/lib/auth-redirect.ts`.
3. **Authentication Flows & Server Actions**: Sign-in, sign-up, credential handling (`bcryptjs`), password hashing, and user profile management (`src/actions/auth.ts`, `src/actions/profile.ts`).
4. **Security & Rate Limiting**: Upstash Redis and `@upstash/ratelimit` integration for brute-force protection and rate limiting sensitive endpoints.
5. **Account Lifecycle & Security Utilities**: Email verification (`src/actions/email-verification.ts`, `src/lib/email.ts`) and password reset workflows (`src/actions/password-reset.ts`, `src/lib/password-reset.ts`), input validation (`src/lib/auth-validation.ts`), and custom error handling (`src/lib/auth-errors.ts`).
6. **UI Components & TypeScript Integration**: Overview of auth components (`src/components/auth/*`) and TypeScript type definitions / NextAuth module augmentations (`src/types/next-auth.d.ts`, `src/types/auth.ts`, etc.).

## Include

Per module / file group:
- **Core Files & Purpose**: What each file is responsible for in the auth lifecycle.
- **Data Flow & Logic**: Step-by-step breakdown of how user requests, database queries, and token verification execute.
- **Security Mechanisms**: Details on rate limiting (`@upstash/ratelimit`), password hashing (`bcryptjs`), token generation/validation, and error management.
- **External Integrations**: How NextAuth interacts with `@auth/drizzle-adapter`, Neon serverless database, Resend email service, and Upstash Redis.

Summaries:
- Architectural overview of session handling (JWT vs. Database sessions).
- Summary table of Server Actions, their inputs, validations, and side effects (e.g., dispatching emails via Resend).
- Security checklist outlining rate-limited endpoints, validation rules, and error handling patterns.

## Sources

- `src/auth.ts`
- `src/auth.config.ts`
- `src/proxy.ts`
- `src/db/auth-adapter.ts`
- `src/db/schema/auth.ts`
- `src/actions/auth.ts`
- `src/actions/email-verification.ts`
- `src/actions/password-reset.ts`
- `src/actions/profile.ts`
- `src/lib/auth-errors.ts`
- `src/lib/auth-redirect.ts`
- `src/lib/auth-validation.ts`
- `src/lib/email-verification-config.ts`
- `src/lib/email-verification.ts`
- `src/lib/email.ts`
- `src/lib/password-reset.ts`
- `src/lib/profile.ts`
- `src/types/auth.ts`
- `src/types/email-verification.ts`
- `src/types/password-reset.ts`
- `src/types/next-auth.d.ts`
- `src/types/profile.ts`
- `src/components/auth/*`