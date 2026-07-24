import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { EditEmailForm, EditPermissionsForm, IssueLinkForm, LockForm, UnlockForm } from "@/components/account-forms";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

const statusLabels = { PASSWORD_PENDING: "Passwortvergabe ausstehend", ACTIVE: "Aktiv", LOCKED: "Gesperrt" } as const;

type AccountStatus = keyof typeof statusLabels;

export default async function AccountDetailPage({ params }: PageProps<"/intern/konten/[userId]">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!account.systemAdmin) redirect("/intern");
  const { userId } = await params;
  const managed = sqlite.prepare("SELECT id, email, role, system_admin AS systemAdmin, status FROM user WHERE id = ?").get(userId) as
    | { id: string; email: string; role: "NONE" | "AREA_EDITOR"; systemAdmin: number; status: AccountStatus }
    | undefined;
  if (!managed) notFound();
  const areas = sqlite.prepare("SELECT id, name FROM areas ORDER BY name COLLATE NOCASE").all() as { id: string; name: string }[];
  const areaIds = (sqlite.prepare("SELECT area_id AS areaId FROM area_assignments WHERE user_id = ?").all(userId) as { areaId: string }[]).map((row) => row.areaId);
  const initial = { role: managed.role, systemAdmin: Boolean(managed.systemAdmin), areaIds };

  return <SiteShell><section className="search-panel" aria-labelledby="account-detail-heading">
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
