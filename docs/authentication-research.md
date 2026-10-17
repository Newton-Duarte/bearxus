# Authentication Flow & Architecture

This document describes the authentication implementation currently present in Bearxus. It covers the NextAuth v5 configuration, email/password flows, GitHub OAuth, session behavior, recovery flows, rate limiting, UI integration, and the security boundaries that callers must preserve.

## 1. Architectural overview

### Authentication stack

| Concern | Implementation |
| --- | --- |
| Authentication framework | NextAuth/Auth.js v5 beta (`next-auth`) |
| OAuth provider | GitHub |
| Password provider | NextAuth Credentials provider backed by the `users` table |
| ORM and database | Drizzle ORM over Neon serverless PostgreSQL |
| Active session strategy | Signed/encrypted JWT session cookie |
| Auth adapter | `@auth/drizzle-adapter` |
| Password hashing | `bcryptjs`, cost factor 12 |
| Transactional email | Resend, server-only |
| Abuse protection | Upstash Redis with `@upstash/ratelimit` sliding windows |
| Input validation | Zod schemas in `src/lib/auth-validation.ts` |

The application uses a split NextAuth configuration:

- `src/auth.config.ts` contains the edge-compatible provider/page configuration. Its Credentials provider has an intentionally empty `authorize` implementation because the database is not imported into the lightweight configuration.
- `src/auth.ts` imports the database and adapter, replaces the placeholder Credentials provider with a database-backed implementation, enables JWT sessions, and exports `auth`, `handlers`, `signIn`, and `signOut`.
- `src/proxy.ts` imports only the lightweight configuration, allowing route protection to verify sessions without loading the database adapter.

### Core files and responsibilities

| File | Responsibility |
| --- | --- |
| `src/auth.config.ts` | Edge-safe providers, custom sign-in page, credential field metadata |
| `src/auth.ts` | Full NextAuth initialization, credential authorization, email-verification gate, JWT session callback |
| `src/proxy.ts` | Redirects unauthenticated `/dashboard/*` requests to `/sign-in` |
| `src/app/api/auth/[...nextauth]/route.ts` | Exposes NextAuth handlers and wraps credential callback POSTs with rate limiting |
| `src/db/auth-adapter.ts` | Maps Auth.js tables to the Drizzle schema |
| `src/db/index.ts` | Creates the Neon HTTP client and Drizzle database instance |
| `src/db/schema/auth.ts` | Auth.js tables, users, custom verification and reset tables, and user relations |
| `src/lib/auth-validation.ts` | Shared Zod validation for all password/email flows |
| `src/lib/auth-redirect.ts` | Validates callback paths and prevents open redirects |
| `src/lib/auth-errors.ts` | Typed `EmailNotVerifiedError` for Credentials sign-in |
| `src/lib/rate-limit.ts` | Upstash limiter construction, keys, fail-open behavior, and 429 responses |
| `src/lib/email.ts` | Resend email delivery for verification and password-reset links |
| `src/lib/email-verification.ts` | Hashed verification token issuance and atomic consumption |
| `src/lib/password-reset.ts` | Hashed reset token issuance, delivery gating, validation, and atomic consumption |
| `src/actions/*.ts` | Server Actions for sign-in/out, verification resend, recovery, and profile security changes |
| `src/app/api/auth/*` | JSON/API counterparts for registration, verification, and password recovery |

## 2. Database and session model

### Auth schema

`src/db/schema/auth.ts` defines these tables:

- `users`: application identity. It contains `id`, `name`, unique `email`, `emailVerified`, OAuth `image`, optional `passwordHash`, and timestamps. A non-null `passwordHash` distinguishes a password-capable account from an OAuth-only account.
- `accounts`: Auth.js provider accounts, including GitHub access/refresh token fields. Rows reference `users.id` with cascade deletion and use `(provider, providerAccountId)` as the primary key.
- `sessions`: the standard Auth.js database-session table. It is retained for adapter compatibility but is not the active session store while JWT strategy is enabled.
- `verification_tokens`: the standard Auth.js verification-token table used by adapter-supported flows. The custom email/password verification flow uses a separate table.
- `email_verifications`: one row per unverified password account. It stores only a SHA-256 token hash, a 24-hour expiry, and the last-send timestamp. The user foreign key is also the primary key, so a new request replaces the prior token.
- `password_resets`: one row per password-capable user. It stores only a SHA-256 token hash, a 24-hour expiry, the last-send timestamp, and `deliveryStatus` (`pending` or `ready`).

The custom tables were added by migrations `drizzle/0001_cultured_slapstick.sql`, `drizzle/0002_amusing_moondragon.sql`, and `drizzle/0003_marvelous_kang.sql`. User-owned workspace data is related back to `users` with cascade behavior, so account deletion removes the associated workspace records.

### JWT sessions, not database sessions

`src/auth.ts` sets `session: { strategy: "jwt" }`. After a successful OAuth or Credentials login, Auth.js issues the session cookie containing the signed/encrypted token. The `session` callback copies `token.sub` into `session.user.id`, which is why server components and actions can use `session.user.id` for ownership checks.

The `sessions` table is not the source of truth for active sessions under this strategy. Consequently:

- signing out clears the current browser's Auth.js cookie;
- changing or resetting a password does not explicitly revoke other already-issued JWT cookies;
- deleting a user signs out the current browser but does not invalidate every previously issued stateless cookie. Database access must still verify the user and ownership at the point of use.

## 3. Request routing and authorization

### Proxy protection

`src/proxy.ts` creates an edge-compatible `auth` wrapper from `auth.config.ts` and applies it to the matcher `/dashboard/:path*`. When `request.auth` is absent, it redirects to:

```text
/sign-in?callbackUrl=<original pathname and query string>
```

The proxy is an early navigation guard, not the complete authorization boundary. `src/app/dashboard/page.tsx` and `src/app/profile/page.tsx` call `auth()` again on the server and redirect if there is no session user ID. Future data reads and mutations must continue to check both authentication and user ownership at the operation boundary.

### Callback URL validation

`src/lib/auth-redirect.ts` accepts only a same-origin relative path. It rejects:

- non-string values;
- values that do not begin with `/` or begin with `//`;
- whitespace, control characters, malformed percent-encoding, and decoded path traversal-like forms;
- absolute/cross-origin URLs;
- `/sign-in`, `/register`, and `/api` destinations.

Invalid values fall back to `/dashboard`. The helper is used by both Credentials and GitHub sign-in actions.

## 4. Core authentication flows

### 4.1 Email/password registration

The browser form is `src/components/auth/RegisterForm.tsx`; it submits JSON to `POST /api/auth/register`.

1. The route checks the IP-based registration limiter before parsing the body.
2. JSON is parsed and validated with `registrationSchema`.
3. The schema trims the name, normalizes the email to lowercase, validates the email length, enforces the password rules, and requires matching confirmation fields.
4. The route checks for an existing user using a case-insensitive email comparison. The database unique constraint is also protected with `onConflictDoNothing`.
5. The password is hashed with `bcryptjs.hash(password, 12)`; plaintext passwords are never stored.
6. The user is inserted with `emailVerified` set to `null` when verification is enabled, or to the current time when verification is explicitly disabled.
7. When verification is enabled, `requestEmailVerification()` attempts to create and send a verification link. Account creation remains successful if delivery fails, allowing recovery through the resend page.
8. The API returns `201` with the new user ID, name, email, `verificationRequired`, and `verificationEmailSent`. Registration never signs the user in.

The UI navigates to `/verify-email` when verification is required, otherwise to `/sign-in?registered=1`.

### 4.2 Credentials sign-in

`src/components/auth/SignInForm.tsx` uses the `signInWithCredentials` Server Action in `src/actions/auth.ts`.

1. Form data is converted to an object and checked with `signInSchema`.
2. Invalid input returns a generic `Check your email and password.` message plus field-level errors.
3. The action applies the login rate limit using the request IP and normalized email.
4. It calls `signIn("credentials", ...)` with the validated credentials and a validated callback URL.
5. The database-backed Credentials provider in `src/auth.ts` selects only the needed user fields by normalized email.
6. `bcryptjs.compare()` checks the submitted password against `passwordHash`. Missing hashes and mismatches return `null`, producing a generic sign-in failure.
7. If email verification is enabled and `emailVerified` is null, the provider throws `EmailNotVerifiedError`. The action converts this to a user-facing verification message without exposing account details.
8. If verification is disabled, a correct password can atomically set `emailVerified` for a previously unverified password account. Wrong passwords and OAuth-only accounts are not auto-verified.
9. A successful authorization returns the stable database user ID, name, email, and image to Auth.js, which creates the JWT session.

The direct Auth.js Credentials callback is also protected in `src/app/api/auth/[...nextauth]/route.ts`. That wrapper extracts the email from a cloned form body and applies the same login limiter before delegating to `handlers.POST`.

### 4.3 GitHub OAuth

The GitHub button submits `signInWithGitHub` from `src/actions/auth.ts`. The action passes the validated callback URL to Auth.js. Auth.js handles the OAuth authorization and callback, then the Drizzle adapter persists or reuses the `users` and `accounts` records. The resulting JWT contains the stable user subject, which becomes `session.user.id` through the session callback.

Automatic linking between an existing password account and a GitHub account is not implemented. OAuth-only users have no `passwordHash` and cannot use Credentials sign-in or the password-change UI.

### 4.4 Sign-out

`signOutUser()` calls `signOut({ redirectTo: "/sign-in" })`. It clears the current Auth.js session cookie and navigates to the custom sign-in page. It does not revoke other stateless JWT cookies.

## 5. Email verification lifecycle

### Issuing a verification link

`src/lib/email-verification.ts` handles the server-only flow:

1. Verification is disabled only when `EMAIL_VERIFICATION_ENABLED` is exactly `"false"`; missing, empty, or invalid values keep verification enabled.
2. The email is normalized and looked up only if the user is unverified and has a password hash. Unknown, already verified, and OAuth-only accounts are ineligible.
3. `randomBytes(32)` creates a 64-character lowercase hexadecimal token. Only its SHA-256 hash is persisted.
4. The link origin comes from `AUTH_URL`. In development only, an unset value falls back to `http://localhost:3000`. The configured value must be an HTTP(S) origin without credentials, path, query, or fragment.
5. The token is upserted into `email_verifications` with a 24-hour expiry. The SQL conflict clause allows a resend only when the previous send is at least 60 seconds old.
6. Resend sends through `src/lib/email.ts` using Resend, a bounded 10-second timeout, plain text and HTML bodies, and `onboarding@resend.dev` as the current sender.
7. If delivery fails, the still-current token hash is replaced so the failed link cannot be used. Callers return neutral success-style responses rather than revealing whether an account exists.

Registration and `POST /api/auth/resend-verification` both use this service. The retained `resendVerificationEmail` Server Action uses the same service, validation, and limiter.

### Consuming a verification link

`GET /api/auth/verify-email` reads the token and calls `verifyEmailToken()`:

1. The token must match the 64-character lowercase hexadecimal format.
2. A data-modifying CTE deletes the matching, unexpired token hash and returns its user ID.
3. The same statement updates that user only if `emailVerified` is still null and `passwordHash` is non-null.
4. A successful update redirects with `303` to `/sign-in?verified=1`; invalid or expired tokens redirect to `/verify-email?status=invalid`.
5. Unexpected failures redirect to `/verify-email?status=error`.

The response uses `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. The verification page is non-indexable, and verification links are single-use and replaced by newer requests.

## 6. Password reset lifecycle

### Requesting a reset

The browser uses `src/components/auth/ForgotPasswordForm.tsx` and `POST /api/auth/forgot-password`.

1. The endpoint applies the IP-based forgot-password limiter.
2. The email is parsed with `passwordResetRequestSchema`.
3. Only users with a non-null `passwordHash` are eligible. Unknown and OAuth-only addresses do not create reset rows.
4. A 32-byte random token is generated; only the SHA-256 hash is stored.
5. A reset row is inserted or replaced with a 24-hour expiry and `deliveryStatus = "pending"`. A database condition enforces a 60-second resend cooldown.
6. Resend receives a link to `/reset-password?token=<raw-token>` built from the validated `AUTH_URL` origin.
7. Only after Resend succeeds is the row changed to `deliveryStatus = "ready"`. A pending token cannot be used. Provider or configuration failures return a neutral success response and do not disclose eligibility.

The frontend always presents the same “if an account exists” message. It starts a local cooldown countdown, while the server-side database cooldown remains authoritative.

### Completing a reset

`src/components/auth/ResetPasswordForm.tsx` posts to `POST /api/auth/reset-password`.

1. The endpoint applies the IP-based reset limiter.
2. The token must be a 64-character lowercase hexadecimal value; password and confirmation are checked with `passwordResetSchema`.
3. `isUsablePasswordResetToken()` requires a matching hash, `ready` delivery status, an unexpired row, and a current password-capable user.
4. The new password is hashed with bcrypt cost 12.
5. A CTE atomically deletes the matching reset row and updates the user password. If the token is missing, expired, already consumed, or races with another request, the operation returns the neutral invalid-token message.
6. Success returns JSON and the browser replaces the URL with `/sign-in?reset=1`, removing the raw token from the address bar. The reset page also sends a no-referrer policy through its metadata.

`src/actions/password-reset.ts` contains equivalent Server Actions for request and completion. The current reset UI uses the JSON API routes directly.

## 7. Profile and account lifecycle

### Profile reads

`src/app/profile/page.tsx` calls `auth()` on the server, redirects unauthenticated users to `/sign-in?callbackUrl=%2Fprofile`, and loads `getProfileData(userId)` from `src/lib/profile.ts`.

The profile query returns only non-secret identity fields and five user-scoped counts: notes, projects, tasks, learning resources, and transactions. It exposes a boolean `canChangePassword` rather than the password hash itself.

### Change password

`changePassword()` in `src/actions/profile.ts`:

1. Requires an authenticated session with a user ID.
2. Validates the current password, new password, and confirmation with `changePasswordSchema`.
3. Loads the current hash for that exact session user and compares it with bcrypt.
4. Hashes the replacement with cost 12 and updates `passwordHash` and `updatedAt`.
5. Returns generic operational errors and field-specific validation errors.

The client-side `ProfileActions` component clears sensitive field state when the dialog closes, focuses errors, and exposes password changes only for password-capable accounts.

### Delete account

`deleteAccount()` requires the current session user ID, deletes the matching `users` row, relies on foreign-key cascades for user-owned records, and signs out to `/sign-in?deleted=1`. If the session is already missing, it redirects back to sign-in instead. This action is not covered by the current Upstash auth limiter.

## 8. Rate limiting and abuse protection

`src/lib/rate-limit.ts` lazily creates one Upstash Redis client and caches one `Ratelimit` instance per limiter name. Each limiter uses the sliding-window algorithm and a one-second provider timeout.

| Name / endpoint | Limit | Window | Key |
| --- | ---: | --- | --- |
| `login` / Credentials callback | 5 | 15 minutes | IP + normalized email |
| `register` / `POST /api/auth/register` | 3 | 1 hour | IP |
| `forgot-password` / `POST /api/auth/forgot-password` | 3 | 1 hour | IP |
| `reset-password` / `POST /api/auth/reset-password` | 5 | 15 minutes | IP |
| `resend-verification` / `POST /api/auth/resend-verification` | 3 | 15 minutes | IP + normalized email |

IP extraction prefers the first value in `x-forwarded-for`, then `x-real-ip`, and otherwise uses `unknown`. The deployment proxy must sanitize forwarded headers; otherwise clients could influence the apparent IP.

When Upstash credentials are absent, Redis construction fails, or a limiter request errors, `checkAuthRateLimit()` fails open and returns an allow decision. This preserves availability but means production deployments must configure and monitor Upstash. Email verification and password reset still retain their independent database-enforced 60-second delivery cooldowns.

Denied API requests return:

- HTTP `429`;
- JSON `{ "error": "Too many attempts. Please try again in X minutes." }`;
- `Cache-Control: no-store`;
- numeric `Retry-After` seconds.

The client forms parse the response, focus accessible error alerts, and show retry countdowns. Registration, recovery, and verification APIs also return neutral responses for unknown accounts to reduce account enumeration.

## 9. Validation, error handling, and security controls

### Validation rules

`src/lib/auth-validation.ts` defines the shared rules:

- email: trim, lowercase, maximum 254 characters, valid email format;
- name: trim, 1–100 characters;
- password: 8–72 UTF-8 bytes, not merely 72 JavaScript characters;
- registration, reset, and change-password confirmation fields must match;
- recovery tokens: exactly 64 lowercase hexadecimal characters.

Passwords preserve whitespace and are never returned in action/API state. All server boundaries validate again instead of trusting client-side validation.

### Error policy

- Credentials failures use generic “email or password is incorrect” messaging.
- Verification resend and password-reset requests use neutral responses regardless of account eligibility or delivery result.
- Invalid, expired, and replayed reset/verification tokens share neutral messages.
- Provider details are not returned to clients. Resend calls are bounded and failures are caught at the lifecycle boundaries.
- `EmailNotVerifiedError` uses the Auth.js CredentialsSignin mechanism with code `email_not_verified`, allowing the sign-in page to render a recovery link without exposing internal details.

### Token and link protection

- Raw email/recovery tokens are generated with cryptographic randomness and are never stored in the database.
- Database rows store SHA-256 hashes only.
- Verification and reset consumption use atomic delete/update operations, making successful tokens single-use and resistant to concurrent replay.
- Reset tokens are persisted as `pending` before email delivery and become usable only after successful delivery.
- Link origins are built from validated `AUTH_URL`, never from arbitrary request Host or Origin headers.
- Verification responses are not cacheable and do not send referrers. The reset page removes the token from browser history after load.

### Important current boundaries

- JWT sessions are stateless. Password changes, password resets, and account deletion do not globally revoke already-issued cookies.
- The proxy covers `/dashboard/*`; server-side handlers must still call `auth()` and enforce ownership for every protected read or mutation.
- Upstash failure is deliberately fail-open. This should be treated as an availability/security tradeoff and monitored before public launch.
- The current Resend sender is `onboarding@resend.dev`, which is intended for development/test delivery. A verified production sending domain should replace it before launch.
- GitHub OAuth is unaffected by the email-verification toggle. Automatic account linking is not implemented.

## 10. UI and TypeScript integration

### Shared auth components

| Component | Role |
| --- | --- |
| `AuthShell` | Shared branded layout, heading, description, and footer for auth pages |
| `AuthField` | Accessible labeled input with generated IDs, error state, hint text, and `aria-describedby` |
| `SignInForm` | Credentials and GitHub sign-in, callback preservation, verification/recovery notices |
| `RegisterForm` | Client validation, registration API call, duplicate-submit prevention, navigation to verification/sign-in |
| `VerificationForm` | Verification resend API call and local cooldown countdown |
| `ForgotPasswordForm` | Neutral recovery request UI and local cooldown countdown |
| `ResetPasswordForm` | Password replacement UI, token syntax handling, token removal from URL, success navigation |

The auth pages are:

- `/sign-in` — custom sign-in page and safe callback handling;
- `/register` — email/password registration;
- `/verify-email` — resend form and status notices; redirects to sign-in when verification is disabled;
- `/forgot-password` — neutral reset request form;
- `/reset-password` — token-based password replacement.

### Type definitions

- `src/types/next-auth.d.ts` augments `Session.user` with required `id: string`.
- `src/types/auth.ts` defines auth action state and nullable account identity fields.
- `src/types/email-verification.ts` defines verification service results and form state.
- `src/types/password-reset.ts` defines reset service results and request/completion state.
- `src/types/profile.ts` defines profile data, usage statistics, and password-change state.

Client components use React `useActionState`, transitions, and typed Zod response parsing. Server Actions and JSON routes return structured success/data/error shapes. Error alerts use `role="alert"`, status messages use `role="status"`, and form fields expose invalid state through `aria-invalid`.

## 11. Configuration and external integrations

The relevant server configuration is:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon development-branch PostgreSQL connection used by Drizzle |
| `AUTH_SECRET` | Auth.js JWT/cookie signing and encryption secret |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth application credentials |
| `AUTH_URL` | Canonical HTTP(S) origin used in email links and production Auth.js setup |
| `RESEND_API_KEY` | Server-only Resend API credential |
| `EMAIL_VERIFICATION_ENABLED` | Verification toggle; only exact `false` disables it |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional Upstash rate-limiter credentials |

Secrets must remain server-side and must not be committed or exposed through client-prefixed environment variables. The Bearxus development workflow requires `DATABASE_URL` to point to the Neon development branch, not production.

## 12. Security checklist

- [x] NextAuth uses JWT sessions and propagates the stable database user ID into `session.user.id`.
- [x] GitHub OAuth and Credentials authentication share the Drizzle-backed user identity.
- [x] Passwords are validated and bcrypt-hashed at cost 12.
- [x] Password length is capped by UTF-8 byte size to match bcrypt limitations.
- [x] Verification and reset tokens are cryptographically random, hash-only at rest, time-limited, and single-use.
- [x] Verification and reset token consumption is atomic.
- [x] Reset links are unusable until email delivery is confirmed.
- [x] Callback URLs are constrained to safe same-origin paths.
- [x] Credential, registration, reset, and resend endpoints have explicit sliding-window limits.
- [x] Database delivery cooldowns remain in place when Redis is unavailable.
- [x] Rate-limit responses include HTTP 429 and `Retry-After`.
- [x] Unknown-account recovery and resend requests return neutral responses.
- [x] Verification links use no-store/no-referrer responses; reset pages remove raw tokens from the URL.
- [x] Protected pages repeat the session check on the server.
- [ ] Global revocation of stateless JWT cookies is not implemented.
- [ ] Upstash fail-open behavior requires production monitoring and operational review.
- [ ] Production email delivery should use a verified Resend sending domain instead of the test sender.

### Primary source files

`src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/db/auth-adapter.ts`, `src/db/schema/auth.ts`, `src/actions/auth.ts`, `src/actions/email-verification.ts`, `src/actions/password-reset.ts`, `src/actions/profile.ts`, `src/lib/auth-errors.ts`, `src/lib/auth-redirect.ts`, `src/lib/auth-validation.ts`, `src/lib/email-verification-config.ts`, `src/lib/email-verification.ts`, `src/lib/email.ts`, `src/lib/password-reset.ts`, `src/lib/profile.ts`, `src/lib/rate-limit.ts`, `src/types/auth.ts`, `src/types/email-verification.ts`, `src/types/password-reset.ts`, `src/types/next-auth.d.ts`, `src/types/profile.ts`, and `src/components/auth/*`.
