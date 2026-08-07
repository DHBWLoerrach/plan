import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* The filter narrows by writing the address, which is the browser's job; on the server it only has to render. The
   hooks that reach for the router are therefore answered with what a render outside a browser needs from them. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const { PublicSearchFilter } = await import("@/components/public-search-filter");

const options = { areas: [{ value: "Technik", label: "Technik" }], programs: [{ value: "TIF", label: "TIF — Informatik" }], years: [{ value: "2026", label: "2026" }] };
const empty = { area: "", program: "", year: "", course: "" };

describe("PublicSearchFilter", () => {
  it("delivers the submit button, so the search works before any script has run", () => {
    const markup = renderToStaticMarkup(createElement(PublicSearchFilter, { ...options, values: empty }));

    expect(markup).toContain("Kurse suchen");
    expect(markup).toMatch(/<button[^>]*type="submit"/u);
  });

  it("shows the filters the address names, so a shared link opens on the state it was shared in", () => {
    const markup = renderToStaticMarkup(createElement(PublicSearchFilter, { ...options, values: { ...empty, course: "TIF26", year: "2026" } }));

    expect(markup).toMatch(/name="course"[^>]*value="TIF26"/u);
    expect(markup).toMatch(/<option value="2026" selected=""/u);
    expect(markup).toContain("Alle Filter zurücksetzen");
  });

  it("offers no reset while nothing is filtered", () => {
    const markup = renderToStaticMarkup(createElement(PublicSearchFilter, { ...options, values: empty }));

    expect(markup).not.toContain("Alle Filter zurücksetzen");
  });
});
