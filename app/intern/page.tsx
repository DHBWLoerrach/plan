import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";
import { getActiveAccount } from "@/lib/internal-auth";

import { blockPlanSummaries, listInternalBlockPlans, publicationStateLabel } from "./blockplaene/data";
import { searchParam } from "./kurse/data";

export default async function InternalHome({ searchParams }: PageProps<"/intern">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const deleted = searchParam(await searchParams, "blockplan-geloescht") === "1";
  const plans = listInternalBlockPlans(account);
  const summaries = blockPlanSummaries(plans.map((plan) => plan.id));
  return <SiteShell><section className="search-panel" aria-labelledby="internal-heading"><p className="eyebrow">Interner Bereich</p><h1 id="internal-heading">Blockpläne</h1>
    <p>Angemeldet als {account.email}. Änderungen bleiben Entwurf, bis Sie sie bewusst veröffentlichen.</p>
    <nav className="filter-actions" aria-label="Interne Navigation"><Link className="text-link" href="/intern/kurse">Kurse verwalten</Link><Link className="text-link" href="/intern/konto">Eigenes Konto</Link>{account.systemAdmin ? <Link className="text-link" href="/intern/konten">Konten verwalten</Link> : null}</nav>
    {deleted ? <p role="status">Der Blockplan wurde gelöscht. Seine Kurse bestehen blockplanlos weiter.</p> : null}
    {plans.length ? <ul className="internal-list">{plans.map((plan) => <li key={plan.id}>
      <Link href={`/intern/blockplaene/${plan.id}`}>{summaries.get(plan.id)?.displayName}</Link>
      <span>Kurse: {summaries.get(plan.id)?.courseCodes.join(", ")}</span>
      <span>{publicationStateLabel({ hasEverBeenPublished: Boolean(plan.hasEverBeenPublished), publishedVersionId: plan.versionId })}</span>
    </li>)}</ul> : <p className="empty-note">Für Ihre Bereiche gibt es noch keine Blockpläne. Legen Sie einen Blockplan aus einem blockplanlosen Kurs an.</p>}
  </section></SiteShell>;
}
