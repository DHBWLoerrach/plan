"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useId, useState } from "react";

import { type EventFormState, createEventAction } from "@/app/intern/blockplaene/actions";
import { CollapsibleEditor } from "@/components/editor-controls";
import { type EventCourse, EventEditorForms, EventFields, eventDefaults } from "@/components/event-forms";
import { formatCalendarDay, formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import type { DraftEvent } from "@/lib/domain/publication";
import type { EventInput } from "@/lib/services/event-admin";

/** One event with the semester derived per affected course; courses sharing a semester are named together. */
export type EventEntry = {
  event: DraftEvent;
  derived: { semester: number | null; codes: string[] }[];
};

function affectedText(groups: EventEntry["derived"]): string {
  return groups
    .map((group) => group.semester ? `${group.codes.join(", ")} · Semester ${group.semester}` : `${group.codes.join(", ")} · Semester noch nicht ableitbar`)
    .join(" | ");
}

function CreateEventForm({ blockPlanId, courses, onSaved }: {
  blockPlanId: string;
  courses: EventCourse[];
  onSaved: (message: ReactNode) => void;
}) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(async (previous, formData) => {
    const result = await createEventAction(previous, formData);
    if (result.success) onSaved(result.success);
    // A rejected save must keep the token of the last successful one, or the form remounts and the keyboard
    // focus needed to fix the error is lost (it would land on the document instead of the invalid field).
    return result.error ? { ...result, token: previous.token } : result;
  }, {});
  const errorId = useId();
  // After a save the form remounts: title, description and dates start empty, while category, the provisional flag
  // and the course selection carry over, because consecutive events usually share them. This must key off
  // `state.success`, not `state.token`: a rejected save carries the previous token forward too (see above), so
  // checking the token alone would wipe the just-typed, still-invalid values instead of preserving them for correction.
  const defaults: EventInput = state.success && state.values
    ? { ...eventDefaults(), category: state.values.category, provisional: state.values.provisional, courseIds: state.values.courseIds }
    : state.values ?? eventDefaults();
  return <form key={state.token ?? "initial"} action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <EventFields courses={courses} defaults={defaults} state={state} errorId={errorId} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Termin wird angelegt …" : "Anlegen und nächsten erfassen"}</button>
  </form>;
}

export function EventSection({ blockPlanId, courses, entries, missingPhaseSemester }: {
  blockPlanId: string;
  courses: EventCourse[];
  entries: EventEntry[];
  /** The semester to offer when an event has no derivable semester; the first one still without a phase. */
  missingPhaseSemester: number | null;
}) {
  const [status, setStatus] = useState<ReactNode>(null);
  return <section aria-labelledby="events-heading">
    <h2 id="events-heading">Prüfungsrelevante Termine</h2>
    <p role="status">{status ?? ""}</p>
    {entries.length ? <ul className="entry-list">{entries.map(({ event, derived }) => {
      const period = event.endDate ? formatCalendarPeriod(event.startDate, event.endDate, { weekday: true }) : formatCalendarDay(event.startDate, { weekday: true });
      const meta = `${period} · ${eventCategoryLabel(event.category)}${event.provisional ? " · Vorläufig" : ""}`;
      return <li key={event.id}>
        <p className="entry-meta">{meta}</p>
        <h3>{event.title}</h3>
        {event.description ? <p>{event.description}</p> : null}
        <p className="entry-meta">{affectedText(derived)}</p>
        {derived.some((group) => group.semester === null) ? <p className="empty-note">
          Für den {formatCalendarDay(event.startDate)} fehlt eine Kursphase.
          {missingPhaseSemester ? <> <Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${missingPhaseSemester}`}>Semester {missingPhaseSemester} ergänzen</Link></> : null}
        </p> : null}
        <CollapsibleEditor
          openLabel={`Termin „${event.title}“ bearbeiten`}
          closeLabel={`Bearbeitung von „${event.title}“ schließen`}>
          <EventEditorForms blockPlanId={blockPlanId} courses={courses} event={event} onSaved={setStatus} />
        </CollapsibleEditor>
      </li>;
    })}</ul> : <p className="empty-note">Noch keine prüfungsrelevanten Termine im Entwurf.</p>}
    <h3>Neuen Termin anlegen</h3>
    <CreateEventForm blockPlanId={blockPlanId} courses={courses} onSaved={setStatus} />
  </section>;
}
