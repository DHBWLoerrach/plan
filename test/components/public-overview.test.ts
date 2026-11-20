import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicOverview } from "@/components/public-overview";
import { buildPublicOverview, type OverviewCourse } from "@/lib/domain/public-overview";

function course(code: string, program: string): OverviewCourse {
  const year = 2000 + Number(code.slice(3, 5));
  return { id: code, code, studyStart: `${year}-10-01`, studyEnd: `${year + 3}-09-30`, semesters: 6, programAbbreviation: code.slice(0, 3), program, year };
}

const overview = buildPublicOverview([
  course("TIF25A", "Informatik"),
  course("WPM24A", "BWL – Personalmanagement"),
  course("WPM25A", "BWL – Personalmanagement"),
], [], "2026-11-20");

function render(initialQuery = "", initialYear = "") {
  return renderToStaticMarkup(createElement(PublicOverview, { overview, initialQuery, initialYear }));
}

describe("PublicOverview", () => {
  it("renders a search form that works without scripting", () => {
    const markup = render();

    const form = markup.match(/<form[^>]*>/)![0];
    expect(form).toContain('role="search"');
    expect(form).toContain('aria-label="Blockpläne suchen"');
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/"');
    expect(markup).toMatch(/<label[^>]*>Studiengang oder Kurs suchen<\/label>/);
    expect(markup).toMatch(/<input[^>]*name="q"/);
    expect(markup).toContain(">Suchen</button>");
    expect(markup).toContain(">Studienbeginn</label>");
    expect(markup).toMatch(/<noscript>[^]*<select[^>]*name="year"/);
    expect(markup).not.toMatch(/<input[^>]*name="year"/);
    // The policy lets no style element in without its nonce, so none may stand in the markup.
    expect(markup).not.toContain("<style");
  });

  it("renders programs as row headings and years as column headings with links to the plans", () => {
    const markup = render();

    expect(markup).toContain("<strong>2</strong> Studiengänge mit laufenden Jahrgängen");
    expect(markup).toMatch(/<th scope="col"><span[^>]*>Start Okt. 2024<\/span><span[^>]*>3. Studienjahr<\/span><\/th>/);
    expect(markup).toMatch(/<th scope="row"[^>]*>BWL – Personalmanagement<\/th>/);
    expect(markup).toMatch(/<a[^>]*href="\/WPM24A"[^>]*><span[^>]*>WPM24A<\/span>/);
    expect(markup).not.toContain("Studienzentrum");
    expect(markup).toContain('<span class="sr-only">Kein Plan veröffentlicht</span>');
    // Every link of the table keeps its own tab stop, and the arrow hint waits for scripting, which makes the arrows work.
    expect(markup.match(/<table[^]*<\/table>/)![0]).not.toContain('tabindex="-1"');
    expect(markup).not.toContain("Pfeiltasten");
  });

  it("lists each program's available years newest first", () => {
    const markup = render();
    const programs = markup.match(/<section[^>]*><h3[^>]*>[\s\S]*?<\/section>/g) ?? [];

    expect(programs).toHaveLength(2);
    expect(programs[0]).toMatch(/>BWL – Personalmanagement<\/h3>/);
    expect(programs[0]).toMatch(/<h4[^>]*><span[^>]*>Start Okt\. 2025<[^]*href="\/WPM25A"[^]*<h4[^>]*><span[^>]*>Start Okt\. 2024<[^]*href="\/WPM24A"/);
    expect(programs[1]).toContain('href="/TIF25A"');
    expect(programs[1]).not.toContain("Start Okt. 2024");
    expect(programs[1]).not.toContain("Kein Plan veröffentlicht");
  });

  it("renders both views from the selection in the address", () => {
    const markup = render("pers", "2025");

    expect(markup).toContain("<strong>1</strong> Studiengang passt zu „pers“");
    expect(markup).toMatch(/<input[^>]*value="pers"/);
    expect(markup).toMatch(/<h4[^>]*><span[^>]*>Start Okt\. 2025<[^]*href="\/WPM25A"/);
    expect(markup).not.toContain(">Start Okt. 2024<");
    expect(markup).not.toContain(">Informatik<");
  });

  it("explains an empty result and offers a way back", () => {
    const markup = render("Logistik");

    expect(markup).toContain("Kein Studiengang passt zu „Logistik“");
    expect(markup).toContain("oder eine Kurskennung wie „TIF25“.");
    expect(markup).toMatch(/<a[^>]*href="\/"[^>]*>Suche und Filter zurücksetzen<\/a>/);
    expect(markup).toMatch(/<a[^>]*href="https:\/\/dhbw-loerrach.de\/ansprechpersonen\/studiengaenge"[^>]*><span>Kontakt zu den <span[^>]*>Studiengängen<svg/);
    expect(markup).not.toContain("<table");
  });
});
