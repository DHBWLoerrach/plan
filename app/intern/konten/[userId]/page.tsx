import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { EditEmailForm, EditPermissionsForm, IssueLinkForm, LockForm, UnlockForm } from "@/components/account-forms";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

import { findManagedAccount } from "../data";

const statusLabels = { PASSWORD_PENDING: "Passwortvergabe ausstehend", ACTIVE: "Aktiv", LOCKED: "Gesperrt" } as const;

export default async function AccountDetailPage({ params }: PageProps<"/intern/konten/[userId]">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!account.systemAdmin) redirect("/intern");
  const { userId } = await params;
  const details = findManagedAccount(sqlite, account, userId);
  if (!details) notFound();
  const { account: managed, areas, areaIds } = details;
  const initial = { role: managed.role, systemAdmin: Boolean(managed.systemAdmin), areaIds };

  return <SiteShell nav={<InternalNav account={account} current="konten" />}><section className="search-panel" aria-labelledby="account-detail-heading">
    <p className="eyebrow">Interner Bereich · Systemadministration</p>
    <h1 id="account-detail-heading">{managed.email}</h1>
    <p>Zustand: {statusLabels[managed.status]}</p>

    <h2>E-Mail-Adresse</h2>
    <p>Die Korrektur ändert ausschließlich die Anmeldeadresse derselben Person; Zustand, Passwort, Sitzungen und offene Passwortlinks bleiben unverändert.</p>
    <EditEmailForm userId={managed.id} email={managed.email} />

    <h2>Rollen und Bereiche</h2>
    <EditPermissionsForm userId={managed.id} email={managed.email} areas={areas} initial={initial} />

    <h2>Zugang</h2>
    {managed.status === "LOCKED"
      ? <UnlockForm userId={managed.id} email={managed.email} />
      : <><IssueLinkForm userId={managed.id} email={managed.email} active={managed.status === "ACTIVE"} /><LockForm userId={managed.id} email={managed.email} /></>}

    <p><Link className="text-link" href="/intern/konten">Zurück zur Kontoliste</Link></p>
  </section></SiteShell>;
}
