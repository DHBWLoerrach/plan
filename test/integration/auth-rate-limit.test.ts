import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { internalAuthOptions, parseTrustedProxies } from "@/lib/auth-options";
import { authSchema } from "@/lib/db/auth-schema";
import { productionOrigin } from "@/lib/product";
import { applySchema } from "@/test/schema";

const baseUrl = productionOrigin;
const traefikAddress = "10.0.0.7";
const temporaryDirectories: string[] = [];

/** The application behind Traefik, wired to a throwaway database: only the forwarded headers differ per request. */
function createAuth() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dhbw-mgmt-rate-limit-"));
  temporaryDirectories.push(directory);
  const sqlite = new Database(path.join(directory, "database.sqlite"));
  applySchema(sqlite);
  const options = internalAuthOptions({
    secret: "a".repeat(32),
    database: drizzleAdapter(drizzle(sqlite), { provider: "sqlite", schema: authSchema }),
    trustedProxies: parseTrustedProxies("10.0.0.0/24"),
  });
  return betterAuth({ ...options, baseURL: baseUrl });
}

function signIn(auth: ReturnType<typeof createAuth>, forwardedFor: string) {
  return auth.handler(new Request(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl, "x-forwarded-for": forwardedFor },
    body: JSON.stringify({ email: "unbekannt@dhbw-loerrach.de", password: "irgendein-falsches-passwort" }),
  }));
}

/** Sends attempts until one is rejected, so the test states the effect instead of Better Auth's exact maximum. */
async function attemptUntilRateLimited(auth: ReturnType<typeof createAuth>, forwardedFor: string, attempts = 8) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await signIn(auth, forwardedFor);
    if (response.status === 429) return attempt;
  }
  return null;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("sign-in rate limit behind Traefik", () => {
  it("rejects repeated sign-in attempts of one forwarded client address", async () => {
    const auth = createAuth();

    const firstAttempt = await signIn(auth, `203.0.113.5, ${traefikAddress}`);
    const rateLimitedAt = await attemptUntilRateLimited(auth, `203.0.113.5, ${traefikAddress}`);

    expect(firstAttempt.status).toBe(401);
    expect(rateLimitedAt).not.toBeNull();
  });

  it("counts each forwarded client address separately", async () => {
    const auth = createAuth();

    expect(await attemptUntilRateLimited(auth, `203.0.113.6, ${traefikAddress}`)).not.toBeNull();

    expect((await signIn(auth, `198.51.100.9, ${traefikAddress}`)).status).toBe(401);
  });

  it("keeps counting the address Traefik forwarded when a client spoofs the header", async () => {
    const auth = createAuth();

    expect(await attemptUntilRateLimited(auth, `203.0.113.7, ${traefikAddress}`)).not.toBeNull();

    // Traefik appended the real client address to the value the client sent, so only the rightmost
    // untrusted hop counts: the spoofed address in front of it must not open a fresh bucket.
    expect((await signIn(auth, `198.51.100.10, 203.0.113.7, ${traefikAddress}`)).status).toBe(429);
  });
});
