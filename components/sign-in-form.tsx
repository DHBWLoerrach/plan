"use client";

import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { useState } from "react";

import { PasswordField } from "@/components/password-field";

export function SignInForm() {
  const [error, setError] = useState<string | null>(null);

  async function signIn(formData: FormData) {
    setError(null);
    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: formData.get("email"), password: formData.get("password"), callbackURL: "/intern/heute" }),
    });
    if (!response.ok) {
      setError("Die Anmeldung war nicht erfolgreich. Prüfen Sie E-Mail-Adresse und Passwort.");
      return;
    }
    // The day page is the entry page; an account without an area is sent on from there to the overview.
    window.location.assign("/intern/heute");
  }

  return <form action={signIn} className="sign-in-form">
    <Field name="email">
      <FieldLabel>Dienstliche E-Mail-Adresse</FieldLabel>
      <Input type="email" autoComplete="username" required />
    </Field>
    <PasswordField id="password-field" name="password" label="Passwort" autoComplete="current-password" />
    {error ? <p role="alert">{error}</p> : null}
    <button className="button" type="submit">Anmelden</button>
  </form>;
}
