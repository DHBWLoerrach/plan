"use client";

import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { useActionState, useState } from "react";

import { ConfirmAction } from "@/components/editor-controls";

import {
  type AccountActionState,
  type CreateAccountState,
  createAccountAction,
  issueLinkAction,
  lockAction,
  unlockAction,
  updateEmailAction,
  updatePermissionsAction,
} from "@/app/intern/konten/actions";

type Area = { id: string; name: string };

type Permissions = { role: "NONE" | "AREA_EDITOR"; systemAdmin: boolean; areaIds: string[] };

function PermissionsFields({ areas, initial }: { areas: Area[]; initial?: Permissions }) {
  const [role, setRole] = useState<"NONE" | "AREA_EDITOR">(initial?.role ?? "NONE");
  const selectedAreas = new Set(initial?.areaIds ?? []);
  return <>
    <fieldset className="account-fieldset">
      <legend>Fachliche Rolle</legend>
      <label><input type="radio" name="role" value="NONE" checked={role === "NONE"} onChange={() => setRole("NONE")} /> Keine fachliche Rolle</label>
      <label><input type="radio" name="role" value="AREA_EDITOR" checked={role === "AREA_EDITOR"} onChange={() => setRole("AREA_EDITOR")} /> Bereichsbearbeitung</label>
    </fieldset>
    <label className="account-check"><input type="checkbox" name="systemAdmin" defaultChecked={initial?.systemAdmin ?? false} /> Systemadministration</label>
    {role === "AREA_EDITOR" ? <fieldset className="account-fieldset">
      <legend>Zugeordnete Bereiche</legend>
      {areas.map((area) => <label key={area.id}><input type="checkbox" name="areaIds" value={area.id} defaultChecked={selectedAreas.has(area.id)} /> {area.name}</label>)}
    </fieldset> : null}
  </>;
}

function EmailField({ defaultValue }: { defaultValue?: string }) {
  return <Field name="email">
    <FieldLabel>Dienstliche E-Mail-Adresse</FieldLabel>
    <Input type="email" autoComplete="off" required defaultValue={defaultValue} />
  </Field>;
}

function PasswordLinkReveal({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="password-link-reveal" role="status">
    <p><strong>Passwortlink</strong> — wird genau einmal angezeigt. Kopieren Sie ihn jetzt und geben Sie ihn der Person persönlich weiter.</p>
    <input readOnly value={link} aria-label="Passwortlink" onFocus={(event) => event.currentTarget.select()} />
    <button type="button" className="button" onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); }}>{copied ? "Kopiert" : "Link kopieren"}</button>
  </div>;
}

function ActionMessages({ state }: { state: AccountActionState | CreateAccountState }) {
  return <>
    {state.error ? <p role="alert">{state.error}</p> : null}
    {"success" in state && state.success && !state.passwordLink ? <p role="status">{state.success}</p> : null}
    {state.passwordLink ? <PasswordLinkReveal link={state.passwordLink} /> : null}
  </>;
}

export function CreateAccountForm({ areas }: { areas: Area[] }) {
  const [state, formAction, isPending] = useActionState<CreateAccountState, FormData>(createAccountAction, {});
  if (state.passwordLink) {
    return <div className="account-form"><p role="status">Das Konto {state.email} wurde angelegt und wartet auf die Passwortvergabe.</p><PasswordLinkReveal link={state.passwordLink} /></div>;
  }
  return <form action={formAction} className="account-form">
    <EmailField defaultValue={state.email} />
    <PermissionsFields areas={areas} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Konto wird angelegt …" : "Konto anlegen und Passwortlink erzeugen"}</button>
  </form>;
}

export function EditEmailForm({ userId, email }: { userId: string; email: string }) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(updateEmailAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="userId" value={userId} />
    <EmailField defaultValue={email} />
    <ActionMessages state={state} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "E-Mail-Adresse speichern"}</button>
  </form>;
}

export function EditPermissionsForm({ userId, email, areas, initial }: { userId: string; email: string; areas: Area[]; initial: Permissions }) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(updatePermissionsAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="userId" value={userId} />
    <PermissionsFields areas={areas} initial={initial} />
    <ActionMessages state={state} />
    <ConfirmAction openLabel="Rollen und Bereiche speichern" heading={`Rollen und Bereiche von ${email} ändern`}
      consequence="Rollen und Bereichszuordnungen werden sofort geändert. Das kann laufende Sitzungen dieser Person nicht beenden, wirkt aber ab der nächsten Berechtigungsprüfung."
      confirmLabel="Rechteänderung speichern" pendingLabel="Wird gespeichert …" isPending={isPending} />
  </form>;
}

function ConfirmActionForm({ action, userId, openLabel, confirmLabel, pendingLabel, heading, consequence, danger }: {
  action: (state: AccountActionState, formData: FormData) => Promise<AccountActionState>;
  userId: string; openLabel: string; confirmLabel: string; pendingLabel: string; heading: string; consequence: string; danger?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(action, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="userId" value={userId} />
    <ActionMessages state={state} />
    <ConfirmAction openLabel={openLabel} heading={heading} consequence={consequence} confirmLabel={confirmLabel}
      pendingLabel={pendingLabel} isPending={isPending} danger={danger} />
  </form>;
}

export function IssueLinkForm({ userId, email, active }: { userId: string; email: string; active: boolean }) {
  return <ConfirmActionForm
    action={issueLinkAction}
    userId={userId}
    openLabel={active ? "Passwort zurücksetzen und neuen Link ausstellen" : "Neuen Passwortlink ausstellen"}
    confirmLabel="Passwortlink ausstellen"
    pendingLabel="Wird ausgestellt …"
    heading="Neuen Passwortlink ausstellen"
    consequence={active
      ? `Das bisherige Passwort und alle Sitzungen von ${email} werden sofort ungültig. Das Konto wartet danach auf die Passwortvergabe. Ein früherer Passwortlink verfällt.`
      : `Ein zuvor ausgestellter Passwortlink von ${email} verfällt. Der neue Link wird genau einmal angezeigt.`}
  />;
}

export function LockForm({ userId, email }: { userId: string; email: string }) {
  return <ConfirmActionForm
    action={lockAction}
    userId={userId}
    openLabel="Konto sperren"
    confirmLabel="Konto jetzt sperren"
    pendingLabel="Wird gesperrt …"
    heading={`Konto ${email} sperren`}
    consequence={`Die Anmeldung von ${email} wird gesperrt; Passwort, Sitzungen und offene Passwortlinks werden entfernt. Die fachlichen Zuordnungen bleiben erhalten.`}
    danger
  />;
}

export function UnlockForm({ userId, email }: { userId: string; email: string }) {
  return <ConfirmActionForm
    action={unlockAction}
    userId={userId}
    openLabel="Konto freigeben"
    confirmLabel="Konto jetzt freigeben"
    pendingLabel="Wird freigegeben …"
    heading={`Konto ${email} freigeben`}
    consequence={`${email} wartet danach auf die Passwortvergabe und erhält einen neuen Passwortlink.`}
  />;
}
