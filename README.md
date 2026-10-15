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

## Authentication setup

Authentication uses NextAuth v5 beta with GitHub OAuth and email/password, the existing Drizzle
adapter, and JWT session cookies. Keep `DATABASE_URL` pointed at the Neon
development branch when testing.

1. Create a GitHub OAuth App with homepage URL `http://localhost:3000` and
   authorization callback URL `http://localhost:3000/api/auth/callback/github`.
2. Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` in `.env` to the app's client ID
   and client secret. Set `AUTH_SECRET` to a securely generated random value
   (at least 32 random bytes); never commit these values.
3. Run `pnpm dev` and open `http://localhost:3000/dashboard`. Unauthenticated
   visitors are redirected to NextAuth's default sign-in page.
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

Register using the JSON API (there is no registration UI yet):

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@test.com","password":"password123","confirmPassword":"password123"}'
```

Names are trimmed and must contain 1–100 characters. Emails are trimmed,
validated (maximum 254 characters), and stored lowercase. Passwords must
match, contain at least eight characters, and fit within 72 UTF-8 bytes (not
necessarily 72 characters). Password whitespace is significant. Passwords
are hashed with bcryptjs at cost 12; plaintext passwords are never stored.

Responses use `{ success, data, error }`: **201** returns the created user's
ID, name, and email; **400** indicates invalid JSON or input; **409** means
the email already exists; **500** indicates a server failure. Registration
does not sign in the user or mark their email as verified.

Open `http://localhost:3000/api/auth/signin?callbackUrl=%2Fdashboard` and use
the email/password form. Sign-in keeps the same database-backed user ID
across sessions. GitHub remains available; OAuth-only accounts cannot sign
in with a password, and registration cannot overwrite an existing account.
Automatic account linking, password reset, and email verification are not
implemented. Registration and password sign-in currently have no application
rate limiting; add abuse protection before exposing them publicly.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
