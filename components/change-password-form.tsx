"use client";

import { useActionState } from "react";

import { changePasswordAction, type ChangePasswordActionState } from "@/app/intern/actions";

const initialState: ChangePasswordActionState = {};

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);
  const hasFieldError = Boolean(state.currentPasswordError || state.newPasswordError);

  return <form action={formAction} className="sign-in-form">
    <label htmlFor="current-password">Bisheriges Passwort</label>
    <input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required aria-describedby={state.currentPasswordError ? "current-password-error" : undefined} aria-invalid={Boolean(state.currentPasswordError)} />
    <label htmlFor="new-password">Neues Passwort</label>
    <p id="new-password-description">15 bis 128 Zeichen, darunter mindestens ein Großbuchstabe, eine Ziffer und ein Sonderzeichen. Zulässig sind: <code>!&quot;#$%&amp;&apos;()*+,-./:;&lt;=&gt;?@[\]^_`{"{"}|{"}"}~</code></p>
    <input id="new-password" name="newPassword" type="password" autoComplete="new-password" required aria-describedby={state.newPasswordError ? "new-password-description new-password-error" : "new-password-description"} aria-invalid={Boolean(state.newPasswordError)} />
    {hasFieldError ? <div role="alert" aria-labelledby="change-password-error-summary"><p id="change-password-error-summary">Das Passwort konnte nicht geändert werden.</p><ul>{state.currentPasswordError ? <li id="current-password-error"><a href="#current-password">{state.currentPasswordError}</a></li> : null}{state.newPasswordError ? <li id="new-password-error"><a href="#new-password">{state.newPasswordError}</a></li> : null}</ul></div> : null}
    {state.formError ? <p role="alert">{state.formError}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Passwort wird geändert …" : "Passwort ändern"}</button>
  </form>;
}
