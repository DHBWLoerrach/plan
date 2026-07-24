import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/change-password-form";
import { SiteShell } from "@/components/site-shell";
import { getActiveAccount } from "@/lib/internal-auth";

export default async function AccountPage() {
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  return <SiteShell><section className="search-panel narrow-panel" aria-labelledby="account-heading">
    <p className="eyebrow">Interner Bereich</p><h1 id="account-heading">Eigenes Konto</h1>
    <p>Angemeldet als {account.email}</p>
    <h2>Passwort ändern</h2>
    <ChangePasswordForm />
  </section></SiteShell>;
}
