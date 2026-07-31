"use client";

import { useActionState } from "react";

import { publishCourseAction, type CoursePublicationFormState, withdrawCourseAction } from "@/app/intern/kurse/actions";
import { ConfirmAction } from "@/components/editor-controls";

export function CoursePublicationControls({ courseId, updatedAt, publishedAt, issues }: { courseId: string; updatedAt: string; publishedAt: string | null; issues: string[] }) {
  const [publishState, publishFormAction, publishing] = useActionState<CoursePublicationFormState, FormData>(publishCourseAction, {});
  const [withdrawState, withdrawFormAction, withdrawing] = useActionState<CoursePublicationFormState, FormData>(withdrawCourseAction, {});
  return <section className="workspace-panel" aria-labelledby="publication-heading">
    <h2 id="publication-heading">Veröffentlichung</h2>
    {!publishedAt && issues.length ? <><p>Der Kurs ist noch nicht veröffentlichbar:</p><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></> : null}
    {!publishedAt && !issues.length ? <form action={publishFormAction} className="account-form">
      <input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="updatedAt" value={updatedAt} /><input type="hidden" name="publishedAt" value="" />
      {publishState.error ? <p role="alert">{publishState.error}</p> : null}
      <ConfirmAction openLabel="Kurs veröffentlichen" heading="Diesen Kurs veröffentlichen" consequence="Der aktuelle Kursverlauf und seine Termine werden öffentlich sichtbar. Spätere bestätigte Korrekturen wirken unmittelbar öffentlich." confirmLabel="Jetzt veröffentlichen" pendingLabel="Wird veröffentlicht …" isPending={publishing} />
    </form> : null}
    {publishedAt ? <form action={withdrawFormAction} className="account-form">
      <p>Bestätigte Änderungen an diesem Kurs werden nach der Prüfung unmittelbar öffentlich sichtbar.</p>
      <input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="publishedAt" value={publishedAt} />
      {withdrawState.error ? <p role="alert">{withdrawState.error}</p> : null}
      <ConfirmAction openLabel="Veröffentlichung zurücknehmen" heading="Veröffentlichung dieses Kurses zurücknehmen" consequence="Der Kurs verschwindet aus den öffentlichen Ansichten. Seine Daten bleiben erhalten und können weiter bearbeitet werden." confirmLabel="Jetzt zurücknehmen" pendingLabel="Wird zurückgenommen …" isPending={withdrawing} danger />
    </form> : null}
  </section>;
}
