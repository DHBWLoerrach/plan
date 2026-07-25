"use client";

import { useActionState, useState } from "react";

import { type PublishFormState, publishAction } from "@/app/intern/actions";

/**
 * The release of the previewed draft, behind a confirmation that names action and consequence. The seen draft change
 * and publication state travel with the form: a draft that changed meanwhile is not published, the preview is
 * reloaded and this confirmation starts over (MVP-SPEZIFIKATION.md).
 */
export function PublishForm({ blockPlanId, draftUpdatedAt, publishedVersionId }: {
  blockPlanId: string;
  draftUpdatedAt: string;
  publishedVersionId: string | null;
}) {
  const [state, formAction, isPending] = useActionState<PublishFormState, FormData>(publishAction, {});
  const [confirming, setConfirming] = useState(false);
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="draftUpdatedAt" value={draftUpdatedAt} />
    <input type="hidden" name="publishedVersionId" value={publishedVersionId ?? ""} />
    <p>
      Beim Veröffentlichen wird der gespeicherte Entwurf erneut geprüft und als eigenständige öffentliche Fassung
      kopiert. Der Entwurf bleibt danach unverändert bearbeitbar.
    </p>
    {state.error ? <p role="alert">{state.error}</p> : null}
    {confirming ? <div className="confirm-region" role="group" aria-label="Veröffentlichung bestätigen">
      <p><strong>Diese Vorschau veröffentlichen</strong></p>
      <p>{publishedVersionId
        ? "Die bisher öffentlich sichtbare Fassung wird durch den hier gezeigten Stand ersetzt."
        : "Der Blockplan wird mit dem hier gezeigten Stand erstmals öffentlich sichtbar."}</p>
      <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird veröffentlicht …" : "Jetzt veröffentlichen"}</button>
      <button className="button button--ghost" type="button" onClick={() => setConfirming(false)}>Abbrechen</button>
    </div> : <button className="button" type="button" onClick={() => setConfirming(true)}>Vorschau freigeben</button>}
  </form>;
}
