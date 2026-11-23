"use client";

import { useActionState, useLayoutEffect, useRef, useState } from "react";

import { setPasswordWithLinkAction, type PasswordLinkActionState } from "@/app/intern/actions";
import { PasswordErrorLink, PasswordField, usePasswordFieldController } from "@/components/password-field";
import { allowedSpecialCharacters, passwordRuleDescription } from "@/lib/domain/password-rules";

const initialState: PasswordLinkActionState = {};

export function PasswordLinkForm() {
  const [token, setToken] = useState<string | null>(null);
  const extractedToken = useRef<string | null>(null);
  const [state, formAction, isPending] = useActionState(setPasswordWithLinkAction, initialState);
  const password = usePasswordFieldController();

  useLayoutEffect(() => {
    if (extractedToken.current === null) {
      extractedToken.current = window.location.hash.slice(1);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    const fragmentToken = extractedToken.current;
    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) setToken(fragmentToken);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (token === null) return <p aria-live="polite">Passwortlink wird geprüft.</p>;
  if (!token) return <p role="alert">Der Passwortlink ist ungültig oder abgelaufen.</p>;

  return <form action={formAction} className="sign-in-form">
    <input name="token" type="hidden" value={token} />
    <PasswordField id="password-field" name="password" label="Neues Passwort" autoComplete="new-password" controller={password}
      description={<>{passwordRuleDescription} Zulässig sind: <code>{allowedSpecialCharacters}</code></>} error={state.error} />
    {state.error ? <div role="alert" aria-labelledby="password-error-summary"><p id="password-error-summary">Bitte korrigieren Sie die Passwortangabe.</p><ul><li><PasswordErrorLink fieldId="password-field" controller={password}>{state.error}</PasswordErrorLink></li></ul></div> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Passwort wird gespeichert …" : "Passwort speichern"}</button>
  </form>;
}
