"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

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
