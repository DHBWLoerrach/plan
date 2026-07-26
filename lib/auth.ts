import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { internalAuthOptions, parseTrustedProxies } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { authSchema } from "@/lib/db/auth-schema";

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const secret = process.env.BETTER_AUTH_SECRET ?? (process.env.NODE_ENV === "production" && !isProductionBuild ? undefined : "development-only-secret-change-before-production");

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production.");
}

export const auth = betterAuth(internalAuthOptions({
  secret,
  database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
  trustedProxies: parseTrustedProxies(process.env.TRUSTED_PROXY_IPS),
}));
