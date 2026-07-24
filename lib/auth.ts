import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import { accounts, sessions, users, verifications } from "@/lib/db/schema";

// Better Auth resolves its models by singular model name (schema["user"]),
// while our Drizzle tables are exported under plural names. Map them explicitly.
const authSchema = { user: users, account: accounts, session: sessions, verification: verifications };

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const secret = process.env.BETTER_AUTH_SECRET ?? (process.env.NODE_ENV === "production" && !isProductionBuild ? undefined : "development-only-secret-change-before-production");

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production.");
}

export const auth = betterAuth({
  secret,
  database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
  disabledPaths: ["/change-password", "/request-password-reset", "/reset-password", "/set-password"],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 15,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    disableSessionRefresh: true,
  },
});
