import { PasswordLinkForm } from "@/components/password-link-form";
import { SiteShell } from "@/components/site-shell";

export default function SetPasswordPage() {
  return <SiteShell><section className="search-panel narrow-panel" aria-labelledby="set-password-heading">
    <p className="eyebrow">Interner Bereich</p><h1 id="set-password-heading">Passwort vergeben</h1>
    <p>Wählen Sie ein Passwort mit mindestens 15 und höchstens 128 Zeichen.</p>
    <PasswordLinkForm />
  </section></SiteShell>;
}
