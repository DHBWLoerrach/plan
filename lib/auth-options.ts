import type { BetterAuthOptions } from "better-auth";

/**
 * Traefik overwrites `X-Forwarded-For` and the container is only reachable from the proxy network,
 * so the header carries a single trustworthy client address. `TRUSTED_PROXY_IPS` covers a proxy that
 * appends instead of overwrites: Better Auth then walks the chain from the right past every trusted
 * hop. Without a resolvable address the limit fails closed rather than open: every client falls into
 * one shared bucket, so sign-in stays limited, but strangers exhaust each other's attempts. That is
 * why the proxy addresses belong in `TRUSTED_PROXY_IPS` wherever the proxy appends.
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
    // The application sets passwords itself, through the password link and the change form, so every
    // Better Auth route that would write one is closed. Sign-in is what is left of it.
    disabledPaths: ["/change-password", "/request-password-reset", "/reset-password", "/set-password"],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      // No `minPasswordLength`/`maxPasswordLength`: Better Auth reads them only in the routes closed
      // above and in sign-up, never in sign-in. Stating them here would be a second, unreachable
      // wording of a rule that `validatePassword` in `lib/services/password-link.ts` owns — free to
      // drift from it and untestable. Reopening one of those routes means reinstating them.
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      disableSessionRefresh: true,
    },
    // Deliberately left on outside production too, so the tests can state the security effect this
    // integration owes: repeated sign-in attempts of one client are cut off, and an address a client
    // put in front of the forwarded chain opens no bucket of its own. Windows and maxima stay at
    // Better Auth's built-in values and are nobody's contract; the application counts nothing itself.
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
