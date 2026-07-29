import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { type ActiveAccount, getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { courseListData } from "./kurse/data";
import { manageableAreas } from "./data";

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
  const courses = manages
    ? courseListData(sqlite, account, { area: null, program: null, year: null, code: null, state: null }, "year").courses
    : [];

  return <SiteShell nav={<InternalNav account={account} current="home" />}><section className="search-panel" aria-labelledby="internal-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="internal-heading">Übersicht</h1>
    <p>Angemeldet als {account.email} — {permissionSummary(account)}. Änderungen bleiben im Planungsstand, bis Sie sie bewusst veröffentlichen.</p>

    <h2>Ihre Bereiche</h2>
    {areas.length
      ? <>
        <p>{account.systemAdmin
          ? `Als Systemadministration bearbeiten Sie die Kurse aller ${areas.length} Bereiche.`
          : "Sie bearbeiten die Kurse dieser Bereiche:"}</p>
        {areas.length
          ? <ul className="internal-list">{areas.map((area) => <li key={area.id}>
            <Link href={`/intern/kurse?area=${area.id}`}>{area.name}</Link>
            <span>{courses.filter((course) => course.areaId === area.id).length === 1 ? "1 Kurs" : `${courses.filter((course) => course.areaId === area.id).length} Kurse`}</span>
          </li>)}</ul>
          : <p className="empty-note">Ihnen ist kein Bereich zugeordnet.</p>}
      </>
      : <p className="empty-note">Ihnen ist noch kein Bereich zugeordnet. Bis dahin können Sie keine Kurse bearbeiten; die Systemadministration ordnet Ihnen Bereiche zu.</p>}

    {manages ? <>
      <h2>Kurse bearbeiten</h2>
      <p>Wählen Sie in der Kursliste zuerst einen Jahrgang und bilden Sie daraus einen Zuschnitt. Die Gegenüberstellung zeigt die ausgewählten Kurse nebeneinander; der Zuschnitt wird nicht gespeichert.</p>
      <p>Die Kursliste zeigt die Kurse aller Bereiche. Kurse fremder Bereiche können Sie lesen, aber nicht bearbeiten.</p>
      <p><Link className="button" href="/intern/kurse">Zur Kursliste</Link></p>
    </> : null}
  </section></SiteShell>;
}
