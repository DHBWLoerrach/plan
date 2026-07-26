"use client";

import { useActionState } from "react";

import { type PublicationFormState, publishAction, withdrawAction } from "@/app/intern/actions";
import { ConfirmAction } from "@/components/editor-controls";

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
  const [state, formAction, isPending] = useActionState<PublicationFormState, FormData>(publishAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="draftUpdatedAt" value={draftUpdatedAt} />
    <input type="hidden" name="publishedVersionId" value={publishedVersionId ?? ""} />
    <p>
      Beim Veröffentlichen wird der gespeicherte Entwurf erneut geprüft und als eigenständige öffentliche Fassung
      kopiert. Der Entwurf bleibt danach unverändert bearbeitbar.
    </p>
    {state.error ? <p role="alert">{state.error}</p> : null}
    <ConfirmAction
      openLabel="Vorschau freigeben"
      heading="Diese Vorschau veröffentlichen"
      consequence={publishedVersionId
        ? "Die bisher öffentlich sichtbare Fassung wird durch den hier gezeigten Stand ersetzt."
        : "Der Blockplan wird mit dem hier gezeigten Stand erstmals öffentlich sichtbar."}
      confirmLabel="Jetzt veröffentlichen"
      pendingLabel="Wird veröffentlicht …"
      isPending={isPending}
    />
  </form>;
}

/**
 * The withdrawal of the displayed published version, behind a confirmation that names action, target and consequence
 * (MVP-SPEZIFIKATION.md). The form carries the version id it shows: a version replaced meanwhile is not withdrawn,
 * the editor reloads the current state instead (ARCHITEKTUR_UND_BETRIEB.md).
 */
export function WithdrawForm({ blockPlanId, publishedVersionId, displayName }: {
  blockPlanId: string;
  publishedVersionId: string;
  displayName: string;
}) {
  const [state, formAction, isPending] = useActionState<PublicationFormState, FormData>(withdrawAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="publishedVersionId" value={publishedVersionId} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    <ConfirmAction
      openLabel="Veröffentlichung zurücknehmen"
      heading={`Veröffentlichung von „${displayName}“ zurücknehmen`}
      consequence="Der Blockplan verschwindet aus der öffentlichen Suche und seiner öffentlichen Detailansicht. Der Entwurf mit allen Kursphasen und prüfungsrelevanten Terminen bleibt erhalten und kann erneut veröffentlicht werden."
      confirmLabel="Jetzt zurücknehmen"
      pendingLabel="Wird zurückgenommen …"
      isPending={isPending}
      danger
    />
  </form>;
}
