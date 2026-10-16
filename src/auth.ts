import { compare } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig, { credentialsFields } from "@/auth.config";
import { db } from "@/db";
import { authAdapter } from "@/db/auth-adapter";
import { users } from "@/db/schema";
import { EmailNotVerifiedError } from "@/lib/auth-errors";
import { signInSchema } from "@/lib/auth-validation";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";

const providers = authConfig.providers.map((provider) => {
  if (typeof provider === "function" || provider.id !== "credentials") {
    return provider;
  }

  return Credentials({
    credentials: credentialsFields,
    async authorize(credentials) {
      const parsed = signInSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const { email, password } = parsed.data;
      const user = await db.query.users.findFirst({
        columns: { id: true, name: true, email: true, image: true, passwordHash: true, emailVerified: true },
        where: eq(users.email, email),
      });
      if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
        return null;
      }
      if (!user.emailVerified) {
        if (isEmailVerificationEnabled()) throw new EmailNotVerifiedError();
        const [verified] = await db.update(users)
          .set({ emailVerified: sql`coalesce(${users.emailVerified}, now())` })
          .where(eq(users.id, user.id))
          .returning({ id: users.id });
        if (!verified) return null;
      }

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  });
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  adapter: authAdapter,
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
});
