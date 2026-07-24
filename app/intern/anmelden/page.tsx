import { SignInForm } from "@/components/sign-in-form";
import { SiteShell } from "@/components/site-shell";

export default function SignInPage() {
  return <SiteShell><section className="search-panel narrow-panel" aria-labelledby="sign-in-heading">
    <p className="eyebrow">Interner Bereich</p><h1 id="sign-in-heading">Anmelden</h1>
    <p>Nutzen Sie Ihre dienstliche E-Mail-Adresse und Ihr lokales Passwort.</p>
    <SignInForm />
  </section></SiteShell>;
}
