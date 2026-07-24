import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PlanMatrix } from "@/components/plan-matrix";
import { SiteShell } from "@/components/site-shell";
import { getPublicPlan } from "@/lib/public-data";

type DynamicProps = { params: Promise<{ blockPlanId: string }> };

export async function generateMetadata({ params }: DynamicProps): Promise<Metadata> {
  await connection();
  const { blockPlanId } = await params;
  const plan = getPublicPlan(blockPlanId);
  return plan ? { title: `${plan.name} | DHBW Lörrach Blockpläne`, description: `Veröffentlichter Blockplan ${plan.name}` } : {};
}

export default async function BlockPlanPage({ params }: DynamicProps) {
  await connection();
  const { blockPlanId } = await params;
  const plan = getPublicPlan(blockPlanId);
  if (!plan) notFound();
  return <SiteShell><article className="plan-detail">
    <p className="eyebrow">Veröffentlichter Blockplan · {plan.year}</p><h1>{plan.name}</h1><p className="plan-area">{plan.area}</p>
    <dl className="course-list"><dt>Sichtbare Kurse</dt><dd>{plan.courses.map((course) => <span key={course.code}>{course.code}</span>)}</dd></dl>
    <PlanMatrix courses={plan.courses} phases={plan.phases} events={plan.events} />
  </article></SiteShell>;
}
