import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

export default async function InternalHome() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const plans = sqlite.prepare(`SELECT plan.id, plan.name, plan.has_ever_been_published AS hasEverBeenPublished, version.id AS versionId
    FROM block_plans plan LEFT JOIN published_versions version ON version.block_plan_id = plan.id
    WHERE ? = 1 OR plan.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?)
    ORDER BY plan.draft_updated_at DESC`).all(account.systemAdmin ? 1 : 0, account.id) as { id: string; name: string | null; hasEverBeenPublished: number; versionId: string | null }[];
  return <SiteShell><section className="search-panel" aria-labelledby="internal-heading"><p className="eyebrow">Interner Bereich</p><h1 id="internal-heading">Blockpläne</h1>
    <p>Angemeldet als {account.email}. Änderungen bleiben Entwurf, bis Sie sie bewusst veröffentlichen.</p>
    <nav className="filter-actions" aria-label="Interne Navigation"><Link className="text-link" href="/intern/kurse">Kurse verwalten</Link><Link className="text-link" href="/intern/konto">Eigenes Konto</Link>{account.systemAdmin ? <Link className="text-link" href="/intern/konten">Konten verwalten</Link> : null}</nav>
    {plans.length ? <ul className="internal-list">{plans.map((plan) => <li key={plan.id}><Link href={`/intern/blockplaene/${plan.id}`}>{plan.name ?? "Unbenannter Blockplan"}</Link><span>{plan.versionId ? "Veröffentlicht" : plan.hasEverBeenPublished ? "Zurückgenommen" : "Noch nie veröffentlicht"}</span></li>)}</ul> : <p className="empty-note">Für Ihre Bereiche gibt es noch keine Blockpläne.</p>}
  </section></SiteShell>;
}
