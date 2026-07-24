"use client";

import { useState } from "react";

export function SignInForm() {
  const [error, setError] = useState<string | null>(null);

  async function signIn(formData: FormData) {
    setError(null);
    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: formData.get("email"), password: formData.get("password"), callbackURL: "/intern" }),
    });
    if (!response.ok) {
      setError("Die Anmeldung war nicht erfolgreich. Prüfen Sie E-Mail-Adresse und Passwort.");
      return;
    }
    window.location.assign("/intern");
  }

  return <form action={signIn} className="sign-in-form">
    <label htmlFor="email">Dienstliche E-Mail-Adresse</label>
    <input id="email" name="email" type="email" autoComplete="username" required />
    <label htmlFor="password">Passwort</label>
    <input id="password" name="password" type="password" autoComplete="current-password" required />
    {error ? <p role="alert">{error}</p> : null}
    <button className="button" type="submit">Anmelden</button>
  </form>;
}
