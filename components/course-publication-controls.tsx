"use client";

import { useActionState } from "react";

import { publishCourseAction, type CoursePublicationFormState, withdrawCourseAction } from "@/app/intern/kurse/actions";
import { ConfirmAction } from "@/components/editor-controls";

export function CoursePublicationControls({ courseId, draftUpdatedAt, publishedCourseId, issues }: { courseId: string; draftUpdatedAt: string; publishedCourseId: string | null; issues: string[] }) {
  const [publishState, publishFormAction, publishing] = useActionState<CoursePublicationFormState, FormData>(publishCourseAction, {});
  const [withdrawState, withdrawFormAction, withdrawing] = useActionState<CoursePublicationFormState, FormData>(withdrawCourseAction, {});
  return <section className="workspace-panel" aria-labelledby="publication-heading">
    <h2 id="publication-heading">Veröffentlichung</h2>
    {issues.length ? <><p>Der Kurs ist noch nicht veröffentlichbar:</p><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></> : <form action={publishFormAction} className="account-form">
      <input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="draftUpdatedAt" value={draftUpdatedAt} /><input type="hidden" name="publishedCourseId" value={publishedCourseId ?? ""} />
      {publishState.error ? <p role="alert">{publishState.error}</p> : null}
      <ConfirmAction openLabel="Kurs veröffentlichen" heading="Diesen Kurs veröffentlichen" consequence={publishedCourseId ? "Die bisherige veröffentlichte Fassung dieses Kurses wird ersetzt." : "Der Kurs wird öffentlich sichtbar."} confirmLabel="Jetzt veröffentlichen" pendingLabel="Wird veröffentlicht …" isPending={publishing} />
    </form>}
    {publishedCourseId ? <form action={withdrawFormAction} className="account-form">
      <input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="publishedCourseId" value={publishedCourseId} />
      {withdrawState.error ? <p role="alert">{withdrawState.error}</p> : null}
      <ConfirmAction openLabel="Veröffentlichung zurücknehmen" heading="Veröffentlichung dieses Kurses zurücknehmen" consequence="Der Kurs verschwindet aus den öffentlichen Ansichten. Sein Planungsstand bleibt erhalten." confirmLabel="Jetzt zurücknehmen" pendingLabel="Wird zurückgenommen …" isPending={withdrawing} danger />
    </form> : null}
  </section>;
}
