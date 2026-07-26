import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { PlanMatrix } from "@/components/plan-matrix";
import { PublishForm } from "@/components/publication-forms";
import { PublicationIssueOverview } from "@/components/publication-issues";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { formatTimestamp } from "@/lib/domain/calendar-format";
import { getActiveAccount } from "@/lib/internal-auth";
import { readPublicationPreview } from "@/lib/services/publication";

import { searchParam } from "../../../search-params";
import { publicationStateLabel } from "../../data";

export default async function PublicationPreviewPage({ params, searchParams }: PageProps<"/intern/blockplaene/[blockPlanId]/vorschau">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const { blockPlanId } = await params;
  const preview = readPublicationPreview(sqlite, blockPlanId);
  if (!preview) notFound();
  const { plan, courses, phases, events, issues } = preview;
  if (!account.systemAdmin && !account.areaIds.includes(plan.areaId)) notFound();

  const changed = searchParam(await searchParams, "geaendert") === "1";
  const displayName = blockPlanDisplayName(plan.name, courses);
  const draftState = formatTimestamp(plan.draftUpdatedAt);
  // Every assigned course carries the same number of semesters (FACHLICHE_REGELN.md), so the first one answers for the plan.
  const semesters = courses[0]?.semesters ?? 0;

  return <SiteShell><InternalNav account={account} current="blockplaene" /><article className="plan-detail">
    <p className="eyebrow">Vorschau der Veröffentlichung</p>
    <h1>{displayName}</h1>
    {changed ? <p role="alert" className="notice">
      Der Entwurf hat sich geändert, seit Sie die Vorschau geladen haben. Es wurde nichts veröffentlicht. Hier steht der
      aktuelle Stand vom {draftState}: Bitte prüfen Sie ihn und geben Sie ihn erneut frei.
    </p> : null}
    <p className="plan-area">{plan.areaName}{courses.length ? ` · Jahrgang ${courses[0].studyStart.slice(0, 4)}` : ""}</p>
    <dl className="course-list">
      <dt>Kurse im Entwurf</dt><dd>{courses.length
        ? courses.map((course) => <span key={course.id}>{course.code}</span>)
        : <span>keine</span>}</dd>
      <dt>Veröffentlichungszustand</dt><dd>{publicationStateLabel({ hasEverBeenPublished: Boolean(plan.hasEverBeenPublished), publishedVersionId: plan.publishedVersionId })}</dd>
      <dt>Stand des Entwurfs</dt><dd>{draftState}</dd>
    </dl>

    {issues.length
      ? <PublicationIssueOverview blockPlanId={plan.id} issues={issues} courses={courses} events={events} semesters={semesters} />
      : <>
        <p>So sehen externe Nutzende den Blockplan, sobald Sie diesen Stand freigeben. Die Vorschau liest ausschließlich den gespeicherten Entwurf.</p>
        <PlanMatrix courses={courses} phases={phases} events={events} />
        <section aria-labelledby="release-heading">
          <h2 id="release-heading">Freigabe</h2>
          <PublishForm blockPlanId={plan.id} draftUpdatedAt={plan.draftUpdatedAt} publishedVersionId={plan.publishedVersionId} />
        </section>
      </>}

    <p><Link className="text-link" href={`/intern/blockplaene/${plan.id}`}>Zurück zum Entwurf</Link></p>
  </article></SiteShell>;
}
