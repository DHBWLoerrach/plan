import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { productionOrigin } from "@/lib/product";
import { proxy } from "@/proxy";

function request(path = "/") {
  return new NextRequest(`${productionOrigin}${path}`);
}

function nonceOf(policy: string) {
  return /'nonce-([^']+)'/u.exec(policy)?.[1];
}

function policyOf(path = "/") {
  return proxy(request(path)).headers.get("content-security-policy") ?? "";
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("content security policy", () => {
  it("answers every request with its own nonce", () => {
    const first = proxy(request()).headers.get("content-security-policy") ?? "";
    const second = proxy(request()).headers.get("content-security-policy") ?? "";

    expect(nonceOf(first)).toBeTruthy();
    expect(nonceOf(second)).not.toBe(nonceOf(first));
  });

  it("restricts sources, embedding and form targets to the application itself", () => {
    const policy = proxy(request()).headers.get("content-security-policy") ?? "";

    const directives = policy.split(";").map((directive) => directive.trim());
    expect(directives).toContain("default-src 'self'");
    expect(directives).toContain("frame-ancestors 'none'");
    expect(directives).toContain("object-src 'none'");
    expect(directives).toContain("base-uri 'self'");
    expect(directives).toContain("form-action 'self'");
  });

  it("keeps inline scripts unexecutable without the nonce", () => {
    const policy = proxy(request()).headers.get("content-security-policy") ?? "";

    const scriptSource = policy.split(";").map((directive) => directive.trim()).find((directive) => directive.startsWith("script-src "));
    expect(scriptSource).toContain(`'nonce-${nonceOf(policy)}'`);
    expect(scriptSource).not.toContain("'unsafe-inline'");
    expect(scriptSource).not.toContain("'unsafe-eval'");
  });

  it("upgrades insecure requests where the application is served over TLS", () => {
    expect(policyOf()).toContain("upgrade-insecure-requests");
  });

  it("leaves requests alone while developing over plain HTTP", () => {
    vi.stubEnv("NODE_ENV", "development");

    // Upgrading would send every stylesheet and script of http://localhost to an https port that
    // nobody listens on, which leaves the page unstyled.
    expect(policyOf()).not.toContain("upgrade-insecure-requests");
  });
});

describe("security headers", () => {
  it("denies content sniffing, referrer leaks and unused browser features", () => {
    const headers = proxy(request("/intern/blockplaene")).headers;

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe("same-origin");
    const permissionsPolicy = headers.get("permissions-policy") ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
      expect(permissionsPolicy).toContain(`${feature}=()`);
    }
  });
});
