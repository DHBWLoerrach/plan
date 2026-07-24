import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CreateAccountForm } from "@/components/account-forms";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

export default async function NewAccountPage() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!account.systemAdmin) redirect("/intern");
  const areas = sqlite.prepare("SELECT id, name FROM areas ORDER BY name COLLATE NOCASE").all() as { id: string; name: string }[];

  return <SiteShell><section className="search-panel narrow-panel" aria-labelledby="new-account-heading">
    <p className="eyebrow">Interner Bereich · Systemadministration</p>
    <h1 id="new-account-heading">Neues Konto anlegen</h1>
    <p>Das Konto wartet zunächst auf die Passwortvergabe. Der erzeugte Passwortlink wird genau einmal angezeigt.</p>
    <CreateAccountForm areas={areas} />
    <p><Link className="text-link" href="/intern/konten">Zurück zur Kontoliste</Link></p>
  </section></SiteShell>;
}
