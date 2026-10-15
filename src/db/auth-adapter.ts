import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { db } from "./index";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "./schema";

export const authAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});
