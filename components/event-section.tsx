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

function CreateEventForm({ blockPlanId, courses, focusOnOpen, onSaved, onClose }: {
  blockPlanId: string;
  courses: EventCourse[];
  focusOnOpen: boolean;
  onSaved: (message: ReactNode) => void;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(async (previous, formData) => {
    const continueCapturing = formData.get("afterSave") === "continue";
    const result = await createEventAction(previous, formData);
    if (result.success) {
      onSaved(result.success);
      if (!continueCapturing) onClose();
    }
    // A rejected save must retain the last successful token. Otherwise the form remounts and takes keyboard focus
    // away from the invalid field that still needs correction.
    return result.error ? { ...result, token: previous.token } : result;
  }, {});
  const errorId = useId();
  // A successful "save and continue" keeps the categorical choices; a rejected save keeps every entered value.
  const defaults: EventInput = state.success && state.values
    ? { ...eventDefaults(), category: state.values.category, provisional: state.values.provisional, courseIds: state.values.courseIds }
    : state.values ?? eventDefaults();
  return <form key={state.token ?? "initial"} action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <EventFields courses={courses} defaults={defaults} state={state} errorId={errorId}
      autoFocusTitle={focusOnOpen || Boolean(state.token)} />
    <div className="form-actions">
      <button className="button" type="submit" name="afterSave" value="continue" disabled={isPending}>
        {isPending ? "Wird gespeichert …" : "Speichern und weiteren erfassen"}
      </button>
      <button className="button button--ghost" type="submit" name="afterSave" value="close" disabled={isPending}>
        Speichern und schließen
      </button>
    </div>
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
  const [createOpen, setCreateOpen] = useState(entries.length === 0);
  const [focusCreateForm, setFocusCreateForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const createHeadingId = useId();
  const filterId = useId();
  const semesters = [...new Set(entries.flatMap((entry) => entry.derived.map((group) => group.semester)).filter((value): value is number => value !== null))]
    .toSorted((left, right) => left - right);
  const canFilter = entries.length > 6;
  const hasUnassigned = entries.some((entry) => entry.derived.some((group) => group.semester === null));
  const validFilters = new Set(["all", ...semesters.map(String), ...(hasUnassigned ? ["unassigned"] : [])]);
  // The active value is derived from current server data, so a removed option or hidden control cannot keep filtering.
  const activeFilter = canFilter && validFilters.has(filter) ? filter : "all";
  const visibleEntries = entries.filter((entry) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unassigned") return entry.derived.some((group) => group.semester === null);
    return entry.derived.some((group) => group.semester === Number(activeFilter));
  });
  const openCreate = () => {
    setFocusCreateForm(true);
    setCreateOpen(true);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setFocusCreateForm(false);
  };

  return <section className="workspace-panel event-workspace" aria-labelledby="events-heading">
    <div className="workspace-heading">
      <div>
        <p className="eyebrow">Prüfungen und Fristen</p>
        <h2 id="events-heading">Prüfungsrelevante Termine</h2>
        <p>Alle Termine bleiben chronologisch sortiert; das Semester wird aus den Kursphasen abgeleitet.</p>
      </div>
      {!createOpen
        ? <button className="button" type="button" onClick={openCreate}>Termin hinzufügen</button>
        : null}
    </div>
    <p role="status">{status ?? ""}</p>

    <div className="event-results">
      {canFilter ? <div className="event-filter">
        <label htmlFor={filterId}>Termine anzeigen</label>
        <select id={filterId} value={activeFilter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">Alle Termine ({entries.length})</option>
          {semesters.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
          {hasUnassigned ? <option value="unassigned">Semester nicht ableitbar</option> : null}
        </select>
        <p role="status">{visibleEntries.length} {visibleEntries.length === 1 ? "Termin wird" : "Termine werden"} angezeigt.</p>
      </div> : null}

      {entries.length ? <ul className="event-list">{visibleEntries.map(({ event, derived }) => {
        const period = event.endDate
          ? formatCalendarPeriod(event.startDate, event.endDate, { weekday: true })
          : formatCalendarDay(event.startDate, { weekday: true });
        const missingPhase = derived.some((group) => group.semester === null);
        // Publication issue links focus the card itself after navigation, although it is not part of normal tab order.
        return <li key={event.id} id={`termin-${event.id}`} tabIndex={-1}>
          <div className="event-card__heading">
            <div>
              <h3>{event.title}</h3>
              <p className="event-period">{period}</p>
            </div>
            <div className="event-badges">
              <span>{eventCategoryLabel(event.category)}</span>
              {event.provisional ? <span className="provisional">Vorläufig</span> : null}
            </div>
          </div>
          {event.description ? <p>{event.description}</p> : null}
          <p className="entry-meta">{affectedText(derived)}</p>
          {missingPhase ? <div className="inline-warning">
            <p><strong>Semester noch nicht ableitbar</strong></p>
            <p>Für den {formatCalendarDay(event.startDate)} fehlt mindestens eine Kursphase.</p>
            {missingPhaseSemester
              ? <Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?ansicht=kursphasen&semester=${missingPhaseSemester}`}>Kursphase ergänzen</Link>
              : null}
          </div> : null}
          <CollapsibleEditor
            openLabel={`Termin „${event.title}“ bearbeiten`}
            closeLabel={`Bearbeitung von „${event.title}“ schließen`}>
            <EventEditorForms blockPlanId={blockPlanId} courses={courses} event={event} onSaved={setStatus} />
          </CollapsibleEditor>
        </li>;
      })}</ul> : <p className="empty-note">Noch keine prüfungsrelevanten Termine im Entwurf.</p>}
    </div>

    {createOpen ? <aside className="create-panel" aria-labelledby={createHeadingId}>
      <div className="create-panel__heading">
        <div>
          <p className="eyebrow">Erfassungsmodus</p>
          <h3 id={createHeadingId}>Termin hinzufügen</h3>
        </div>
        {entries.length ? <button className="button button--ghost button--compact" type="button" onClick={closeCreate}>Schließen</button> : null}
      </div>
      <CreateEventForm blockPlanId={blockPlanId} courses={courses} focusOnOpen={focusCreateForm}
        onSaved={setStatus} onClose={closeCreate} />
    </aside> : null}
  </section>;
}
