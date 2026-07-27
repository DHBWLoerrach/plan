import { NextResponse, type NextRequest } from "next/server";

/**
 * Sets the nonce-based Content Security Policy and the remaining security headers of
 * `docs/ARCHITEKTUR_UND_BETRIEB.md`. Every response carries its own nonce, so pages must render
 * dynamically; Next.js reads the policy from the forwarded request headers and applies the nonce to
 * its own scripts. Traefik adds HSTS in front of the application.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const contentSecurityPolicy = [
    "default-src 'self'",
    // React rebuilds server error stacks with `eval` while developing; production needs neither.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Traefik terminates TLS in front of the application. Local development has no TLS, and
    // upgrading there would point every stylesheet and script at an https port nobody listens on.
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", contentSecurityPolicy);
  response.headers.set("x-content-type-options", "nosniff");
  // Internal paths carry block plan and account identifiers, so no referrer leaves the application.
  response.headers.set("referrer-policy", "same-origin");
  // The application uses none of these browser features; the list denies them for itself and embeds.
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()");
  return response;
}

export const config = {
  matcher: [
    {
      // Immutable build assets and the favicon carry no markup, and prefetches fetch no document.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
