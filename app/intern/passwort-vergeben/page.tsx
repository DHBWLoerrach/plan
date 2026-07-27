import { connection } from "next/server";

import { PasswordLinkForm } from "@/components/password-link-form";
import { SiteShell } from "@/components/site-shell";

/** Rendered per request like every other page, so the response carries the nonce of its own policy. */
export default async function SetPasswordPage() {
  await connection();
  return <SiteShell><section className="search-panel narrow-panel" aria-labelledby="set-password-heading">
    <p className="eyebrow">Interner Bereich</p><h1 id="set-password-heading">Passwort vergeben</h1>
    <p>Wählen Sie ein Passwort mit 15 bis 128 Zeichen, mindestens einem Großbuchstaben, einer Ziffer und einem Sonderzeichen.</p>
    <PasswordLinkForm />
  </section></SiteShell>;
}
