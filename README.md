This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Database setup

Copy `.env.example` to `.env` and set `DATABASE_URL` to the Neon development branch:

```bash
cp .env.example .env
```

When the schema changes, generate a migration and apply it:

```bash
pnpm db:generate
pnpm db:migrate
```

Use generated migrations for schema changes; do not use `drizzle-kit push`.

### Clean up development test users

Preview users and owned records that would be removed:

```bash
pnpm db:cleanup-users
```

To permanently delete every user except `demo@bearxus.io`, along with their
content and authentication records:

```bash
pnpm db:cleanup-users --execute
```

The script lives at `scripts/cleanup-users.mjs` and loads `.env` from the project
root. Existing environment variables take precedence. It only accepts the
development endpoint `ep-silent-bird-b59kwhec`. Every delete excludes the
case-insensitive `demo@bearxus.io` identity and its content if present. If the
demo account is absent, cleanup removes all users and their content, with an
explicit warning in the preview. It does not create a demo user or seed content.

Apply migrations first, stop the app before deleting, and back up any test data
you need. The delete runs in one locked transaction; tasks are removed before
stage cascades to satisfy their restrictive foreign key. Auth.js verification
tokens without a user foreign key are cleaned separately. Other user-owned
records are removed through existing cascade constraints. Deletion is permanent;
there is no production override. Clear browser cookies afterward: database
cleanup does not revoke existing stateless JWT cookies.

## Authentication setup

Authentication uses NextAuth v5 beta with GitHub OAuth and email/password, the existing Drizzle
adapter, and JWT session cookies. Keep `DATABASE_URL` pointed at the Neon
development branch when testing.

1. Create a GitHub OAuth App with homepage URL `http://localhost:3000` and
   authorization callback URL `http://localhost:3000/api/auth/callback/github`.
2. Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` in `.env` to the app's client ID
   and client secret. Set `AUTH_SECRET` to a securely generated random value
   (at least 32 random bytes); never commit these values.
   Set `RESEND_API_KEY` when email verification is enabled, and `AUTH_URL` to
   the canonical origin users will open (locally, `http://localhost:3000`).
   `AUTH_URL` must be an HTTP(S) origin without a path, query, or credentials;
   outside development it is required for verification delivery. Only development
   falls back to `http://localhost:3000` when it is unset.
3. Run `pnpm dev` and open `http://localhost:3000/dashboard`. Unauthenticated
   visitors are redirected to the custom `/sign-in` page.
4. Click **Sign in with GitHub** and complete authorization. You should return
   to `/dashboard`, which displays your database user ID. Signing in again
   with the same account should retain that ID.

`/dashboard` and its nested paths are protected by `src/proxy.ts`. The dashboard
also checks the session on the server; future data access and mutations must
verify authentication and ownership at the point of access, not rely on proxy
alone. `/api/auth/session` exposes the authenticated session's `user.id`.

For self-hosted production, set `AUTH_URL` to the deployment's public origin
and register its `/api/auth/callback/github` URL with GitHub. Auth.js rejects
untrusted production hosts without the appropriate deployment configuration.
To smoke-test a local production build, run `pnpm build` followed by
`AUTH_URL=http://localhost:3000 pnpm start` (stop the dev server first).

### Email/password registration

Open `/register` to create an account, or use the JSON API:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
   -d '{"name":"Test","email":"your-resend-account@example.com","password":"password123","confirmPassword":"password123"}'
```

Names are trimmed and must contain 1–100 characters. Emails are trimmed,
validated (maximum 254 characters), and stored lowercase. Passwords must
match, contain at least eight characters, and fit within 72 UTF-8 bytes (not
necessarily 72 characters). Password whitespace is significant. Passwords
are hashed with bcryptjs at cost 12; plaintext passwords are never stored.

Responses use `{ success, data, error }`: **201** returns the created user's
ID, name, email, `verificationRequired`, and `verificationEmailSent`; **400** indicates invalid JSON
or input; **409** means the email already exists; **500** indicates account
creation failed. Registration never signs in the user. With verification enabled,
the email remains unverified. If email delivery fails after creation, the response remains
**201** with `verificationEmailSent: false`; the account is retained and can
request another email.

With verification enabled, successful registration opens `/verify-email`, with an inbox notice or accurate
delivery-failure guidance. Click the email link to verify, then sign in normally.
Links expire after 24 hours, work once, and are replaced by a new resend link.
Tokens are stored only as SHA-256 hashes; verification never creates a session.

Every email/password account, including existing test users, needs verification
before its next credentials sign-in when verification is enabled. Open `/verify-email` (also linked from
sign-in) to request an email. Resends have a database-enforced 60-second cooldown,
including failed delivery attempts. Every valid email receives the same neutral
resend feedback, even if delivery fails, to avoid revealing account status.
Existing sessions are not revoked by this change.

#### Toggle email verification

Use a server-only environment variable; do not prefix it with `NEXT_PUBLIC_`:

```dotenv
# Default: require a verification email/link.
EMAIL_VERIFICATION_ENABLED=true

# For local testing without a verified Resend sending domain, use instead:
# EMAIL_VERIFICATION_ENABLED=false
```

Only the exact value `false` disables verification. Unset, empty, misspelled,
or other values leave it enabled. Restart the server after changing the value;
deployment environment variables and higher-priority `.env.*` files can override `.env`.

When disabled, new email/password accounts get an `emailVerified` timestamp
immediately, no verification email or token is created, and registration returns
to normal sign-in instead of the inbox page. `verificationRequired` and
`verificationEmailSent` are both `false`; registration still does not create a session.
Existing unverified accounts are marked verified only after a correct password
sign-in, never from an email-only request or a bulk update. Wrong passwords and
OAuth-only accounts remain unable to use password sign-in. Resend is disabled
server-side, auth pages omit verification prompts, and `/verify-email` redirects
directly to `/sign-in` without displaying configuration details in this mode.
`RESEND_API_KEY` and email-link `AUTH_URL` configuration are not needed for this
bypass, though GitHub's existing deployment configuration is unchanged.

Automatic verification is persistent: turning the flag back on does not unverify
accounts created or successfully signed in while it was off. Keep it enabled
before public launch if email ownership must be established. GitHub OAuth is
unaffected by this switch.

The temporary sender is **`onboarding@resend.dev`**. It can deliver only to the
email address associated with your Resend account, so replace the example email
above with that address for real inbox testing. Arbitrary mock addresses cannot
receive these emails. Before public launch, verify your own sending domain,
replace the sender, and disable click tracking for verification links in your
Resend domain settings. Apply the generated migration before starting the app.
If a link has expired or was consumed by an email scanner, request another.

Verification redirects strip the token, disable caching, and use a no-referrer
policy. Development request logging excludes verification URLs and disables
Server Function argument logging; configure production proxies/analytics to
redact token query strings too. Keep `.env` files private. For production-mode
testing, verify the effective `DATABASE_URL`: `.env.production` can override `.env`.
The Resend SDK itself logs provider error details in development; these may
contain recipient addresses, so do not share raw provider logs. Its production
logging behavior differs from development.

Open `http://localhost:3000/sign-in?callbackUrl=%2Fdashboard` and use
the email/password form. Sign-in keeps the same database-backed user ID
across sessions. GitHub remains available; OAuth-only accounts cannot sign
in with a password, and registration cannot overwrite an existing account.
Automatic account linking and password reset are not implemented. GitHub OAuth
is unchanged and does not use this email/password verification flow. Registration
and password sign-in still need general abuse protection before public launch;
the resend cooldown is not a substitute for global/per-IP rate limiting.

The dashboard sidebar shows the session user's name, email, and GitHub avatar
or initials. Clicking the account row opens Profile, Settings, and Sign out.
Sign out clears the session and redirects to `/sign-in`. Profile and Settings
link to `/profile` and `/settings`; those pages are not implemented in this phase.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
