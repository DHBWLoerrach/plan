import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SignInForm } from "@/components/sign-in-form";
import { SiteShell } from "@/components/site-shell";
import { getActiveAccount } from "@/lib/internal-auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ passwort?: string }> }) {
  await connection();
  // A valid session belongs in the internal area, not in front of the sign-in form again — whoever returns from the
  // public pages stays signed in.
  if (await getActiveAccount()) redirect("/intern");
  const { passwort } = await searchParams;
  return <SiteShell><section className="search-panel narrow-panel" aria-labelledby="sign-in-heading">
    <p className="eyebrow">Interner Bereich</p><h1 id="sign-in-heading">Anmelden</h1>
    <p>Nutzen Sie Ihre dienstliche E-Mail-Adresse und Ihr lokales Passwort.</p>
    {passwort === "gesetzt" ? <p role="status">Ihr Passwort wurde gespeichert. Sie können sich jetzt anmelden.</p> : null}
    <SignInForm />
  </section></SiteShell>;
}
