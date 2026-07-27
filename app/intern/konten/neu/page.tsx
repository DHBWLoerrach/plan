import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CreateAccountForm } from "@/components/account-forms";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

import { accountAreaOptions } from "../data";

export default async function NewAccountPage() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!account.systemAdmin) redirect("/intern");
  const areas = accountAreaOptions(sqlite, account);

  return <SiteShell nav={<InternalNav account={account} current="konten" />}><section className="search-panel narrow-panel" aria-labelledby="new-account-heading">
    <p className="eyebrow">Interner Bereich · Systemadministration</p>
    <h1 id="new-account-heading">Neues Konto anlegen</h1>
    <p>Das Konto wartet zunächst auf die Passwortvergabe. Der erzeugte Passwortlink wird genau einmal angezeigt.</p>
    <CreateAccountForm areas={areas} />
    <p><Link className="text-link" href="/intern/konten">Zurück zur Kontoliste</Link></p>
  </section></SiteShell>;
}
