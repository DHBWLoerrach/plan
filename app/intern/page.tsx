import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { formatTimestamp } from "@/lib/domain/calendar-format";
import { type ActiveAccount, getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { blockPlanListData, blockPlanStateLabels, incompleteDrafts } from "./blockplaene/data";
import { manageableAreas } from "./data";

/** How many block plans the start page names per section before it refers to the full list. */
const recentPlanCount = 5;
const noFilters = { area: null, year: null, course: null, state: null } as const;

function planCountLabel(count: number): string {
  return count === 1 ? "1 Blockplan" : `${count} Blockpläne`;
}

function permissionSummary(account: ActiveAccount): string {
  const permissions: string[] = [];
  if (account.role === "AREA_EDITOR") permissions.push("Bereichsbearbeitung");
  if (account.systemAdmin) permissions.push("Systemadministration");
  return permissions.join(" · ") || "Keine Berechtigung";
}

export default async function InternalHome() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const manages = managesAnyArea(account);
  const areas = manages ? manageableAreas(sqlite, account) : [];
  // Everything below is read for exactly the areas this account may manage, so the start page never names a plan it
  // may not open (MVP-SPEZIFIKATION.md).
  const plans = manages ? blockPlanListData(sqlite, account, noFilters, "draft").plans : [];
  const recent = plans.slice(0, recentPlanCount);
  const incomplete = incompleteDrafts(sqlite, plans);
  // Area editing names every assigned area, empty ones included: that is the scope of the account. System
  // administration manages all areas, so listing them all would say nothing — only those holding plans do.
  const listedAreas = account.systemAdmin ? areas.filter((area) => plans.some((plan) => plan.areaId === area.id)) : areas;

  return <SiteShell><InternalNav account={account} current="home" /><section className="search-panel" aria-labelledby="internal-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="internal-heading">Übersicht</h1>
    <p>Angemeldet als {account.email} — {permissionSummary(account)}. Änderungen bleiben Entwurf, bis Sie sie bewusst veröffentlichen.</p>

    <h2>Ihre Bereiche</h2>
    {areas.length
      ? <>
        <p>{account.systemAdmin
          ? `Als Systemadministration bearbeiten Sie die Blockpläne und Kurse aller ${areas.length} Bereiche. Blockpläne bestehen bisher in diesen Bereichen:`
          : "Sie bearbeiten die Blockpläne und Kurse dieser Bereiche:"}</p>
        {listedAreas.length
          ? <ul className="internal-list">{listedAreas.map((area) => <li key={area.id}>
            <Link href={`/intern/blockplaene?area=${area.id}`}>{area.name}</Link>
            <span>{planCountLabel(plans.filter((plan) => plan.areaId === area.id).length)}</span>
          </li>)}</ul>
          : <p className="empty-note">In keinem Bereich gibt es bisher einen Blockplan.</p>}
      </>
      : <p className="empty-note">Ihnen ist noch kein Bereich zugeordnet. Bis dahin können Sie keine Blockpläne und Kurse bearbeiten; die Systemadministration ordnet Ihnen Bereiche zu.</p>}

    {manages ? <>
      <h2>Zuletzt bearbeitete Blockpläne</h2>
      {recent.length ? <>
        <ul className="internal-list">{recent.map((plan) => <li key={plan.id}>
          <Link href={`/intern/blockplaene/${plan.id}`}>{plan.displayName}</Link>
          <span>{plan.areaName} · {plan.courseCodes.join(", ")}</span>
          <span>{blockPlanStateLabels[plan.state]} · zuletzt bearbeitet {formatTimestamp(plan.draftUpdatedAt)}{plan.draftUpdatedBy ? ` durch ${plan.draftUpdatedBy}` : ""}</span>
        </li>)}</ul>
        <p><Link className="text-link" href="/intern/blockplaene">Alle Blockpläne ({plans.length})</Link></p>
      </> : <p className="empty-note">Für Ihre Bereiche gibt es noch keine Blockpläne. Ein Blockplan entsteht aus einem blockplanlosen Kurs — <Link className="text-link" href="/intern/blockplaene">legen Sie hier einen an</Link>.</p>}

      <h2>Unvollständige Entwürfe</h2>
      {incomplete.length
        ? <>
          <p>Diese Entwürfe verletzen noch Veröffentlichungsregeln und können nicht freigegeben werden. Die Vorschau nennt jeden offenen Punkt mit Semester und Feld.</p>
          <ul className="internal-list">{incomplete.slice(0, recentPlanCount).map((draft) => <li key={draft.id}>
            <Link href={`/intern/blockplaene/${draft.id}/vorschau`}>{draft.displayName}</Link>
            <span>{draft.issueCount === 1 ? "1 offener Punkt" : `${draft.issueCount} offene Punkte`}</span>
          </li>)}</ul>
          {incomplete.length > recentPlanCount
            ? <p>Weitere {incomplete.length - recentPlanCount} Entwürfe sind unvollständig. Die <Link className="text-link" href="/intern/blockplaene">Blockplanliste</Link> zeigt alle Blockpläne Ihrer Bereiche.</p>
            : null}
        </>
        : <p className="empty-note">Kein Entwurf Ihrer Bereiche verletzt derzeit eine Veröffentlichungsregel.</p>}
    </> : null}
  </section></SiteShell>;
}
