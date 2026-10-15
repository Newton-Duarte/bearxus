import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

export const credentialsFields = {
  email: { label: "Email", type: "email" },
  password: { label: "Password", type: "password" },
};

export default {
  pages: { signIn: "/sign-in" },
  providers: [
    GitHub,
    Credentials({
      credentials: credentialsFields,
      authorize: () => null,
    }),
  ],
} satisfies NextAuthConfig;
