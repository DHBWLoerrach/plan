import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PlanMatrix } from "@/components/plan-matrix";
import { SiteShell } from "@/components/site-shell";

import { publicPlanData } from "../data";

type DynamicProps = { params: Promise<{ blockPlanId: string }> };

export async function generateMetadata({ params }: DynamicProps): Promise<Metadata> {
  await connection();
  const { blockPlanId } = await params;
  const plan = publicPlanData(blockPlanId);
  // Without a published version the page answers with 404; the answer stays the same whether the plan was withdrawn,
  // never published or never existed (MVP-SPEZIFIKATION.md).
  if (!plan) return { title: "Blockplan nicht gefunden | DHBW Lörrach Blockpläne", robots: { index: false, follow: true } };
  return {
    title: `${plan.name} | DHBW Lörrach Blockpläne`,
    description: `Veröffentlichter Blockplan ${plan.name} (${plan.area}, Jahrgang ${plan.year}) mit Theorie- und Praxisphasen sowie prüfungsrelevanten Terminen.`,
  };
}

export default async function BlockPlanPage({ params }: DynamicProps) {
  await connection();
  const { blockPlanId } = await params;
  const plan = publicPlanData(blockPlanId);
  if (!plan) notFound();

  return <SiteShell><article className="plan-detail">
    <h1>{plan.name}</h1>
    <dl className="course-list">
      <div><dt>Bereich</dt><dd>{plan.area}</dd></div>
      <div><dt>Jahrgang</dt><dd>{plan.year}</dd></div>
      <div><dt>Sichtbare Kurse</dt><dd>{plan.courses.map((course) => <span key={course.id}>{course.code}</span>)}</dd></div>
    </dl>
    <PlanMatrix courses={plan.courses} phases={plan.phases} events={plan.events} />
    <p className="plan-detail__back"><Link href="/">Zurück zur öffentlichen Suche</Link></p>
  </article></SiteShell>;
}
