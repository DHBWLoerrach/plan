import type { BetterAuthOptions } from "better-auth";

/**
 * Traefik overwrites `X-Forwarded-For` and the container is only reachable from the proxy network,
 * so the header carries a single trustworthy client address. `TRUSTED_PROXY_IPS` covers a proxy that
 * appends instead of overwrites: Better Auth then walks the chain from the right past every trusted
 * hop. Without a resolvable address the rate limit degrades into one shared bucket for all clients.
 */
export function parseTrustedProxies(value: string | undefined): string[] {
  return (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

type InternalAuthOptionsInput = {
  secret: string;
  database: BetterAuthOptions["database"];
  trustedProxies: string[];
};

export function internalAuthOptions(input: InternalAuthOptionsInput): BetterAuthOptions {
  return {
    secret: input.secret,
    database: input.database,
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
    // Enabled in every environment so the limit that protects sign-in in production is the one
    // covered by tests. Windows and maxima stay at Better Auth's built-in values; the application
    // keeps no sign-in counters of its own.
    rateLimit: { enabled: true },
    advanced: {
      // Better Auth trusts only its configured base URL and would skip that check under NODE_ENV=test.
      // Stating the production behaviour keeps the check the integration test verifies the real one.
      disableOriginCheck: false,
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
        trustedProxies: input.trustedProxies,
      },
    },
  };
}
