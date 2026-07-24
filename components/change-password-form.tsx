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
    <p id="new-password-description">Mindestens 15 und höchstens 128 Zeichen.</p>
    <input id="new-password" name="newPassword" type="password" autoComplete="new-password" required aria-describedby={state.newPasswordError ? "new-password-description new-password-error" : "new-password-description"} aria-invalid={Boolean(state.newPasswordError)} />
    {hasFieldError ? <><div role="alert" aria-labelledby="change-password-error-summary"><p id="change-password-error-summary">Das Passwort konnte nicht geändert werden.</p><ul>{state.currentPasswordError ? <li><a href="#current-password">{state.currentPasswordError}</a></li> : null}{state.newPasswordError ? <li><a href="#new-password">{state.newPasswordError}</a></li> : null}</ul></div>{state.currentPasswordError ? <p id="current-password-error">{state.currentPasswordError}</p> : null}{state.newPasswordError ? <p id="new-password-error">{state.newPasswordError}</p> : null}</> : null}
    {state.formError ? <p role="alert">{state.formError}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Passwort wird geändert …" : "Passwort ändern"}</button>
  </form>;
}
