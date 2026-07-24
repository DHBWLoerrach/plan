"use client";

import { type ReactNode, useId, useState } from "react";

/**
 * One saved draft entry with its editing controls, collapsed until the editing is deliberately opened. The button
 * names the entry, so its accessible name stays unambiguous among several editors on the page (BARRIEREFREIHEIT.md).
 */
export function CollapsibleEditor({ heading, openLabel, closeLabel, children }: {
  heading: string;
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return <div className="editor-card">
    <h4>{heading}</h4>
    <button className="button button--ghost" type="button" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen(!open)}>
      {open ? closeLabel : openLabel}
    </button>
    <div id={regionId} hidden={!open}>{children}</div>
  </div>;
}

/**
 * A deletion behind a confirmation that names action, target and consequences (MVP-SPEZIFIKATION.md). The hidden
 * fields of the concrete form are passed as children, the action as the form action.
 */
export function ConfirmDeleteForm({ action, error, isPending, openLabel, confirmLabel, heading, consequence, children }: {
  action: (formData: FormData) => void;
  error?: string;
  isPending: boolean;
  openLabel: string;
  confirmLabel: string;
  heading: string;
  consequence: string;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  return <form action={action} className="account-form">
    {children}
    {error ? <p role="alert">{error}</p> : null}
    {confirming ? <div className="confirm-region" role="group" aria-label={`${heading} bestätigen`}>
      <p><strong>{heading}</strong></p>
      <p>{consequence}</p>
      <button className="button button--danger" type="submit" disabled={isPending}>{isPending ? "Wird gelöscht …" : confirmLabel}</button>
      <button className="button button--ghost" type="button" onClick={() => setConfirming(false)}>Abbrechen</button>
    </div> : <button className="button button--danger" type="button" onClick={() => setConfirming(true)}>{openLabel}</button>}
  </form>;
}
