"use client";

import Link from "next/link";
import { useActionState } from "react";

import { publishCourseAction, type CoursePublicationFormState, withdrawCourseAction } from "@/app/intern/kurse/actions";
import { ConfirmAction } from "@/components/editor-controls";
import { formatCalendarDay } from "@/lib/domain/calendar-format";

/**
 * The state of one course in one line under its title: whether it is public, what still stands in the way, and the
 * deliberate step itself. It is a line rather than a section of its own because it is read on every visit and acted
 * on once — the plan below is what the page is for. The open points are named here and nowhere else on the page: they
 * exist only because they keep the course from being published, so they stand where that is decided.
 *
 * `publishedOn` is the calendar day the course became visible on, which says more than the state alone.
 */
export function CoursePublicationControls({ courseId, code, updatedAt, publishedAt, publishedOn, issues }: { courseId: string; code: string; updatedAt: string; publishedAt: string | null; publishedOn: string | null; issues: string[] }) {
  const [publishState, publishFormAction, publishing] = useActionState<CoursePublicationFormState, FormData>(publishCourseAction, {});
  const [withdrawState, withdrawFormAction, withdrawing] = useActionState<CoursePublicationFormState, FormData>(withdrawCourseAction, {});
  return <section className="course-status" aria-labelledby="publication-heading">
    <h2 id="publication-heading" className="sr-only">Veröffentlichung</h2>
    <div className="course-status__line">
      {publishedAt
        ? <p><strong>Veröffentlicht{publishedOn ? ` seit ${formatCalendarDay(publishedOn)}` : ""}</strong> · Jede gespeicherte Änderung ist sofort öffentlich sichtbar. <Link className="text-link" href={`/${encodeURIComponent(code)}`}>Öffentliche Ansicht öffnen</Link></p>
        : <p><strong>Nicht veröffentlicht</strong> · {issues.length
          ? (issues.length === 1 ? "Vor der Veröffentlichung ist noch 1 Punkt offen:" : `Vor der Veröffentlichung sind noch ${issues.length} Punkte offen:`)
          : "Planungsstand ist vollständig."}</p>}
      {!publishedAt && !issues.length ? <form action={publishFormAction} className="course-status__action">
        <input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="updatedAt" value={updatedAt} /><input type="hidden" name="publishedAt" value="" />
        {publishState.error ? <p role="alert">{publishState.error}</p> : null}
        <ConfirmAction openLabel="Kurs veröffentlichen" heading="Diesen Kurs veröffentlichen" consequence="Der aktuelle Kursverlauf und seine Termine werden öffentlich sichtbar. Spätere bestätigte Korrekturen wirken unmittelbar öffentlich." confirmLabel="Jetzt veröffentlichen" pendingLabel="Wird veröffentlicht …" isPending={publishing} />
      </form> : null}
      {publishedAt ? <form action={withdrawFormAction} className="course-status__action">
        <input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="publishedAt" value={publishedAt} />
        {withdrawState.error ? <p role="alert">{withdrawState.error}</p> : null}
        <ConfirmAction openLabel="Veröffentlichung zurücknehmen" heading="Veröffentlichung dieses Kurses zurücknehmen" consequence="Der Kurs verschwindet aus den öffentlichen Ansichten. Seine Daten bleiben erhalten und können weiter bearbeitet werden." confirmLabel="Jetzt zurücknehmen" pendingLabel="Wird zurückgenommen …" isPending={withdrawing} danger />
      </form> : null}
    </div>
    {!publishedAt && issues.length ? <ul className="issue-list">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
  </section>;
}
