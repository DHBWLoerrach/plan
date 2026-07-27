import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { internalAuthOptions } from "@/lib/auth-options";
import { authSchema } from "@/lib/db/auth-schema";

const productionOrigin = "https://blockplan.dhbw-loerrach.de";
const traefikAddress = "10.0.0.7";
const temporaryDirectories: string[] = [];

/** The application behind Traefik, wired to a throwaway database: only the request origin differs. */
function createAuth() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dhbw-mgmt-trusted-origins-"));
  temporaryDirectories.push(directory);
  const sqlite = new Database(path.join(directory, "database.sqlite"));
  sqlite.exec(readFileSync(path.join(process.cwd(), "migrations/0000_initial.sql"), "utf8"));
  const options = internalAuthOptions({
    secret: "a".repeat(32),
    database: drizzleAdapter(drizzle(sqlite), { provider: "sqlite", schema: authSchema }),
    trustedProxies: ["10.0.0.0/24"],
  });
  return betterAuth({ ...options, baseURL: productionOrigin });
}

function signIn(auth: ReturnType<typeof createAuth>, origin: string, forwardedFor: string) {
  return auth.handler(new Request(`${productionOrigin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "x-forwarded-host": "blockplan.dhbw-loerrach.de",
      "x-forwarded-for": `${forwardedFor}, ${traefikAddress}`,
    },
    body: JSON.stringify({ email: "unbekannt@dhbw-loerrach.de", password: "irgendein-falsches-passwort" }),
  }));
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("sign-in origin check behind Traefik", () => {
  it("rejects a sign-in sent from a foreign origin", async () => {
    const response = await signIn(createAuth(), "https://blockplan.dhbw-loerrach.de.example.com", "203.0.113.20");

    expect(response.status).toBe(403);
  });

  it("lets the configured production origin through to the credential check", async () => {
    const response = await signIn(createAuth(), productionOrigin, "203.0.113.21");

    expect(response.status).toBe(401);
  });

  it("rejects a foreign origin that resembles the production host", async () => {
    const auth = createAuth();

    const subdomain = await signIn(auth, "https://intern.blockplan.dhbw-loerrach.de", "203.0.113.22");
    const insecure = await signIn(auth, "http://blockplan.dhbw-loerrach.de", "203.0.113.23");

    expect(subdomain.status).toBe(403);
    expect(insecure.status).toBe(403);
  });
});
