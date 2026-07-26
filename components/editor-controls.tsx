"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

/**
 * One saved draft entry with its editing controls, collapsed until the editing is deliberately opened. The button
 * names the entry, so its accessible name stays unambiguous among several editors on the page (BARRIEREFREIHEIT.md).
 */
export function CollapsibleEditor({ heading, openLabel, closeLabel, children }: {
  /** Omit when the entry already renders its own heading; the toggle's accessible name still names the entry via `openLabel`/`closeLabel`. */
  heading?: string;
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return <div className="editor-card">
    {heading ? <h4>{heading}</h4> : null}
    <button className="button button--ghost" type="button" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen(!open)}>
      {open ? closeLabel : openLabel}
    </button>
    <div id={regionId} hidden={!open}>{children}</div>
  </div>;
}

/**
 * A deliberate action behind a confirmation that names action, target and consequence — in the accessible name and
 * the associated description, never as a bare „OK“ (BARRIEREFREIHEIT.md). The confirmation takes focus when it
 * opens; Escape and „Abbrechen“ close it and return focus to the button that opened it. It renders the submit
 * button of the surrounding form, so the caller keeps its own form, action and hidden fields.
 */
export function ConfirmAction({ openLabel, heading, consequence, confirmLabel, pendingLabel, isPending, danger }: {
  openLabel: string;
  heading: string;
  consequence: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  danger?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const wasConfirming = useRef(false);
  const consequenceId = useId();
  // Both stay mounted: the trigger has to survive the open confirmation to take focus back when it closes.
  useEffect(() => {
    if (confirming) region.current?.focus();
    else if (wasConfirming.current) trigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  const buttonClass = danger ? "button button--danger" : "button";
  return <>
    <button ref={trigger} hidden={confirming} className={buttonClass}
      type="button" onClick={() => setConfirming(true)}>{openLabel}</button>
    <div ref={region} hidden={!confirming} className="confirm-region" role="group" tabIndex={-1}
      aria-label={heading} aria-describedby={consequenceId}
      onKeyDown={(event) => { if (event.key === "Escape") setConfirming(false); }}>
      <p><strong>{heading}</strong></p>
      <p id={consequenceId}>{consequence}</p>
      <button className={buttonClass} type="submit" disabled={isPending}>{isPending ? pendingLabel : confirmLabel}</button>
      <button className="button button--ghost" type="button" onClick={() => setConfirming(false)}>Abbrechen</button>
    </div>
  </>;
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
