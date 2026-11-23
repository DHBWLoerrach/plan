import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PlanEventTable, PlanMatrix } from "@/components/plan-matrix";
import { SiteShell } from "@/components/site-shell";
import { publicCutKindLabel, publicCutPath, publicCutTitle, relatedCuts, type YearCut } from "@/lib/domain/public-cut";
import { productName } from "@/lib/product";

import { publicCutData } from "./data";

const missingMetadata: Metadata = { title: "Blockplan nicht gefunden", robots: { index: false, follow: true } };

/** Metadata and the page read the same current published courses, so a withdrawal cannot leave a stale title behind. */
export async function publicCutMetadata(cut: YearCut | null): Promise<Metadata> {
  await connection();
  if (!cut) return missingMetadata;
  const detail = publicCutData(cut);
  if (!detail) return missingMetadata;
  const title = publicCutTitle(detail.cut);
  const description = `Veröffentlichter Blockplan für ${title} mit Theorie- und Praxisphasen sowie prüfungsrelevanten Terminen.`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "de_DE",
      url: publicCutPath(detail.cut),
      siteName: productName,
      title: `${title} | ${productName}`,
      description,
    },
  };
}

/** Renders the addresses of a year and of a program or area within it; a single course has a page of its own. */
export async function PublicCutPage({ cut }: { cut: YearCut | null }) {
  await connection();
  if (!cut) notFound();
  const detail = publicCutData(cut);
  if (!detail) notFound();
  const title = publicCutTitle(detail.cut);
  const links = relatedCuts(cut, detail.courses[0]);

  return <SiteShell><article className="plan-detail">
    <h1>{title}</h1>
    <dl className="course-list">
      <div><dt>Jahrgang</dt><dd>{cut.year}</dd></div>
    </dl>
    {links.length ? <nav className="cut-links" aria-label="Andere Ansichten">
      <h2>Andere Ansichten</h2>
      <ul>{links.map((related) => <li key={publicCutPath(related)}><Link href={publicCutPath(related)}>{publicCutKindLabel(related.kind)}: {publicCutTitle(related)}</Link></li>)}</ul>
    </nav> : null}
    <PlanMatrix courses={detail.courses} phases={detail.phases} />
    <PlanEventTable courses={detail.courses} phases={detail.phases} events={detail.events} />
    <p className="plan-detail__back"><Link href="/">Zurück zur öffentlichen Suche</Link></p>
  </article></SiteShell>;
}
