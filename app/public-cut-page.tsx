import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PlanMatrix } from "@/components/plan-matrix";
import { SiteShell } from "@/components/site-shell";
import { publicCutKindLabel, publicCutPath, publicCutTitle, relatedCuts, type PublicCut } from "@/lib/domain/public-cut";
import { productName } from "@/lib/product";

import { publicCutData } from "./data";

const missingMetadata: Metadata = { title: "Blockplan nicht gefunden", robots: { index: false, follow: true } };

/** Metadata and the page read the same current published courses, so a withdrawal cannot leave a stale title behind. */
export async function publicCutMetadata(cut: PublicCut | null): Promise<Metadata> {
  await connection();
  if (!cut) return missingMetadata;
  const detail = publicCutData(cut);
  if (!detail) return missingMetadata;
  const title = publicCutTitle(detail.cut);
  const description = detail.cut.kind === "course"
    ? `Veröffentlichter Kursplan ${detail.cut.code} mit Theorie- und Praxisphasen sowie prüfungsrelevanten Terminen.`
    : `Veröffentlichter Blockplan für ${title} mit Theorie- und Praxisphasen sowie prüfungsrelevanten Terminen.`;
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

/** Renders every public address from the same current published cut so all variants share the same 404 behaviour. */
export async function PublicCutPage({ cut }: { cut: PublicCut | null }) {
  await connection();
  if (!cut) notFound();
  const detail = publicCutData(cut);
  if (!detail) notFound();
  const representativeCourse = detail.courses[0];
  const title = publicCutTitle(detail.cut);
  const links = relatedCuts(detail.cut, representativeCourse);

  return <SiteShell><article className="plan-detail">
    <h1>{title}</h1>
    <dl className="course-list">
      {detail.cut.kind === "course" ? <>
        <div><dt>Bereich</dt><dd>{representativeCourse.area}</dd></div>
        <div><dt>Studiengang</dt><dd>{representativeCourse.program}</dd></div>
      </> : null}
      <div><dt>Jahrgang</dt><dd>{detail.cut.kind === "course" ? representativeCourse.year : detail.cut.year}</dd></div>
    </dl>
    {links.length ? <nav className="cut-links" aria-label="Andere Ansichten">
      <h2>Andere Ansichten</h2>
      <ul>{links.map((related) => <li key={publicCutPath(related)}><Link href={publicCutPath(related)}>{publicCutKindLabel(related.kind)}: {publicCutTitle(related)}</Link></li>)}</ul>
    </nav> : null}
    <PlanMatrix courses={detail.courses} phases={detail.phases} events={detail.events} />
    <p className="plan-detail__back"><Link href="/">Zurück zur öffentlichen Suche</Link></p>
  </article></SiteShell>;
}
