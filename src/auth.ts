import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import { authAdapter } from "@/db/auth-adapter";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
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
