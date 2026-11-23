"use client";

import { useActionState } from "react";

import { changePasswordAction, type ChangePasswordActionState } from "@/app/intern/actions";
import { PasswordErrorLink, PasswordField, usePasswordFieldController } from "@/components/password-field";
import { allowedSpecialCharacters, passwordRuleDescription } from "@/lib/domain/password-rules";

const initialState: ChangePasswordActionState = {};

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);
  const hasFieldError = Boolean(state.currentPasswordError || state.newPasswordError);
  const currentPassword = usePasswordFieldController();
  const newPassword = usePasswordFieldController();

  return <form action={formAction} className="sign-in-form">
    <PasswordField id="current-password-field" name="currentPassword" label="Bisheriges Passwort" autoComplete="current-password"
      controller={currentPassword} error={state.currentPasswordError} />
    <PasswordField id="new-password-field" name="newPassword" label="Neues Passwort" autoComplete="new-password" controller={newPassword}
      description={<>{passwordRuleDescription} Zulässig sind: <code>{allowedSpecialCharacters}</code></>} error={state.newPasswordError} />
    {hasFieldError ? <div role="alert" aria-labelledby="change-password-error-summary"><p id="change-password-error-summary">Das Passwort konnte nicht geändert werden.</p><ul>
      {state.currentPasswordError ? <li><PasswordErrorLink fieldId="current-password-field" controller={currentPassword}>{state.currentPasswordError}</PasswordErrorLink></li> : null}
      {state.newPasswordError ? <li><PasswordErrorLink fieldId="new-password-field" controller={newPassword}>{state.newPasswordError}</PasswordErrorLink></li> : null}
    </ul></div> : null}
    {state.formError ? <p role="alert">{state.formError}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Passwort wird geändert …" : "Passwort ändern"}</button>
  </form>;
}
