"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

function formSignature(formData: FormData): string {
  return JSON.stringify([...formData.entries()].map(([name, value]) => [name, typeof value === "string" ? value : [value.name, value.size, value.type]]));
}

/**
 * A deliberate action behind a confirmation that names action, target and consequence — in the accessible name and
 * the associated description, never as a bare „OK“ (BARRIEREFREIHEIT.md). The confirmation takes focus when it
 * opens; Escape and „Abbrechen“ close it and return focus to the button that opened it. It renders the submit
 * button of the surrounding form, so the caller keeps its own form, action and hidden fields.
 */
export function ConfirmAction({ openLabel, heading, consequence, preview, shouldConfirm, confirmLabel, pendingLabel, isPending, danger }: {
  openLabel: string;
  heading: string;
  consequence: ReactNode;
  preview?: (formData: FormData) => ReactNode;
  shouldConfirm?: (formData: FormData) => boolean;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  danger?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [shownConsequence, setShownConsequence] = useState<ReactNode>(consequence);
  const [shownSignature, setShownSignature] = useState("");
  const [changedAfterPreview, setChangedAfterPreview] = useState(false);
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
  function openOrSubmit() {
    const form = trigger.current?.form;
    const formData = form ? new FormData(form) : new FormData();
    if (form && shouldConfirm && !shouldConfirm(formData)) {
      form.requestSubmit();
      return;
    }
    setShownConsequence(preview ? preview(formData) : consequence);
    setShownSignature(formSignature(formData));
    setChangedAfterPreview(false);
    setConfirming(true);
  }
  function confirmCurrentPreview(event: { preventDefault: () => void }) {
    const form = trigger.current?.form;
    if (!form) return;
    const formData = new FormData(form);
    const currentSignature = formSignature(formData);
    if (currentSignature === shownSignature) return;
    event.preventDefault();
    setShownConsequence(preview ? preview(formData) : consequence);
    setShownSignature(currentSignature);
    setChangedAfterPreview(true);
  }
  return <>
    <button ref={trigger} hidden={confirming} className={buttonClass}
      type="button" onClick={openOrSubmit}>{openLabel}</button>
    <div ref={region} hidden={!confirming} className="confirm-region" role="group" tabIndex={-1}
      aria-label={heading} aria-describedby={consequenceId}
      onKeyDown={(event) => { if (event.key === "Escape") setConfirming(false); }}>
      <p><strong>{heading}</strong></p>
      <div id={consequenceId}>{shownConsequence}</div>
      {changedAfterPreview ? <p role="alert">Die Eingaben haben sich nach der Vorschau geändert. Prüfen Sie den aktualisierten Stand und bestätigen Sie erneut.</p> : null}
      <button className={buttonClass} type="submit" disabled={isPending} onClick={confirmCurrentPreview}>{isPending ? pendingLabel : confirmLabel}</button>
      <button className="button button--ghost" type="button" onClick={() => setConfirming(false)}>Abbrechen</button>
    </div>
  </>;
}
