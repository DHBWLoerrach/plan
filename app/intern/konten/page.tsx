import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

const statusLabels = { PASSWORD_PENDING: "Passwortvergabe ausstehend", ACTIVE: "Aktiv", LOCKED: "Gesperrt" } as const;
const statusFilters = ["PASSWORD_PENDING", "ACTIVE", "LOCKED"] as const;

type AccountStatus = keyof typeof statusLabels;

type AccountRow = { id: string; email: string; role: string; systemAdmin: number; status: AccountStatus; areas: string | null };

function roleSummary(account: AccountRow) {
  const roles: string[] = [];
  if (account.role === "AREA_EDITOR") roles.push("Bereichsbearbeitung");
  if (account.systemAdmin) roles.push("Systemadministration");
  return roles.join(" · ") || "Keine Berechtigung";
}

export default async function AccountsPage({ searchParams }: PageProps<"/intern/konten">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!account.systemAdmin) redirect("/intern");
  const requested = (await searchParams).status;
  const status = statusFilters.includes(requested as AccountStatus) ? (requested as AccountStatus) : undefined;
  const accounts = sqlite.prepare(`SELECT u.id, u.email, u.role, u.system_admin AS systemAdmin, u.status,
      (SELECT GROUP_CONCAT(a.name, ', ') FROM area_assignments aa JOIN areas a ON a.id = aa.area_id WHERE aa.user_id = u.id) AS areas
    FROM user u WHERE (? IS NULL OR u.status = ?) ORDER BY u.email COLLATE NOCASE`).all(status ?? null, status ?? null) as AccountRow[];

  return <SiteShell><section className="search-panel" aria-labelledby="accounts-heading">
    <p className="eyebrow">Interner Bereich · Systemadministration</p>
    <h1 id="accounts-heading">Interne Konten</h1>
    <p><Link className="button" href="/intern/konten/neu">Neues Konto anlegen</Link></p>
    <nav className="filter-actions" aria-label="Nach Kontozustand filtern">
      <Link className="text-link" href="/intern/konten" aria-current={status ? undefined : "true"}>Alle</Link>
      {statusFilters.map((value) => <Link key={value} className="text-link" href={`/intern/konten?status=${value}`} aria-current={status === value ? "true" : undefined}>{statusLabels[value]}</Link>)}
    </nav>
    {accounts.length ? <table className="event-table"><thead><tr><th scope="col">E-Mail-Adresse</th><th scope="col">Berechtigungen</th><th scope="col">Bereiche</th><th scope="col">Zustand</th><th scope="col">Verwalten</th></tr></thead>
      <tbody>{accounts.map((row) => <tr key={row.id}>
        <td>{row.email}</td><td>{roleSummary(row)}</td><td>{row.areas ?? "—"}</td><td>{statusLabels[row.status]}</td>
        <td><Link className="text-link" href={`/intern/konten/${row.id}`}>Verwalten</Link></td>
      </tr>)}</tbody></table> : <p className="empty-note">Für diesen Zustand gibt es keine Konten.</p>}
  </section></SiteShell>;
}
