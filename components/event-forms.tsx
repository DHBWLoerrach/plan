"use client";

import { type ReactNode, useActionState, useId } from "react";

import { type EventFormState, deleteEventAction, updateEventAction } from "@/app/intern/blockplaene/actions";
import { DateField } from "@/components/date-field";
import { ConfirmDeleteForm } from "@/components/editor-controls";
import { eventCategories } from "@/lib/domain/event-category";
import type { DraftEvent } from "@/lib/domain/publication";
import type { EventField, EventInput } from "@/lib/services/event-admin";

export type EventCourse = { id: string; code: string };

/**
 * The values an event form starts with, whether from a saved event, a rejected save or a cleared create form.
 * `EventInput` already has exactly these fields, so the form reuses it instead of introducing a parallel type; a
 * saved event carries `null` for description and end date, which becomes an empty field here.
 */
export function eventDefaults(event?: DraftEvent): EventInput {
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    category: event?.category ?? "",
    startDate: event?.startDate ?? "",
    endDate: event?.endDate ?? "",
    provisional: event?.provisional ?? false,
    courseIds: event?.courseIds ?? [],
  };
}

export function EventFields({ courses, defaults, state, errorId }: {
  courses: EventCourse[];
  defaults: EventInput;
  state: EventFormState;
  errorId: string;
}) {
  const ids = { title: useId(), description: useId(), category: useId(), hint: useId() };
  const affected = new Set(defaults.courseIds);
  const invalid = (field: EventField) => state.field === field;
  return <>
    <p id={ids.hint}>Titel, Kategorie und Startdatum sind erforderlich. Der Titel fasst höchstens 160, die Beschreibung höchstens 2000 Zeichen.</p>
    {state.error ? <p id={errorId} role="alert">{state.error}</p> : null}
    <label htmlFor={ids.title}>Titel</label>
    <input id={ids.title} name="title" type="text" required maxLength={160} defaultValue={defaults.title} autoComplete="off"
      aria-invalid={invalid("title") || undefined} aria-describedby={invalid("title") ? errorId : undefined} />
    <label htmlFor={ids.description}>Beschreibung (optional)</label>
    <textarea id={ids.description} name="description" rows={3} maxLength={2000} defaultValue={defaults.description}
      aria-invalid={invalid("description") || undefined} aria-describedby={invalid("description") ? errorId : undefined} />
    <label htmlFor={ids.category}>Kategorie</label>
    <select id={ids.category} name="category" required defaultValue={defaults.category}
      aria-invalid={invalid("category") || undefined} aria-describedby={invalid("category") ? errorId : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {eventCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" defaultValue={defaults.startDate} required
      invalid={invalid("startDate")} errorId={errorId} />
    <DateField label="Enddatum (optional)" name="endDate" defaultValue={defaults.endDate}
      invalid={invalid("endDate")} errorId={errorId}
      hint="Ohne Enddatum gilt der Termin genau am Starttag, sonst einschließlich beider Grenztage." />
    <label className="account-check"><input type="checkbox" name="provisional" defaultChecked={defaults.provisional} /> Zeitangabe ist vorläufig</label>
    <fieldset className="account-fieldset" aria-describedby={invalid("courseIds") ? errorId : undefined}>
      <legend>Betroffene Kurse</legend>
      <p>Ein Termin betrifft mindestens einen Kurs dieses Blockplans. Das Semester wird je Kurs aus seinen Kursphasen abgeleitet.</p>
      {courses.map((course) => <label key={course.id}><input type="checkbox" name="courseIds" value={course.id} defaultChecked={affected.has(course.id)} /> {course.code}</label>)}
    </fieldset>
  </>;
}

function EditEventForm({ blockPlanId, courses, event, onSaved }: {
  blockPlanId: string;
  courses: EventCourse[];
  event: DraftEvent;
  onSaved: (message: ReactNode) => void;
}) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(async (previous, formData) => {
    const result = await updateEventAction(previous, formData);
    // The title makes the message unique even when the same event is saved twice in a row (or event A then event
    // B): the status region is shared across every editor on the page, and repeating the server's generic text
    // verbatim would mutate nothing in the DOM, so assistive tech would announce nothing the second time (BARRIEREFREIHEIT.md).
    if (result.success) onSaved(`Die Angaben zum Termin „${event.title}“ wurden gespeichert.`);
    return result;
  }, {});
  const errorId = useId();
  // A rejected save keeps what was entered; otherwise the saved event provides the defaults.
  const defaults = state.values ?? eventDefaults(event);
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="eventId" value={event.id} />
    <EventFields courses={courses} defaults={defaults} state={state} errorId={errorId} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Terminangaben speichern"}</button>
  </form>;
}

function DeleteEventForm({ blockPlanId, event, onSaved }: { blockPlanId: string; event: DraftEvent; onSaved: (message: ReactNode) => void }) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(async (previous, formData) => {
    const result = await deleteEventAction(previous, formData);
    if (result.success) onSaved(`Der Termin „${event.title}“ wurde aus dem Entwurf gelöscht.`);
    return result;
  }, {});
  return <ConfirmDeleteForm action={formAction} error={state.error} isPending={isPending}
    openLabel="Termin löschen"
    confirmLabel="Endgültig löschen"
    heading={`Termin „${event.title}“ löschen`}
    consequence="Der Termin wird mit seinen Kurszuordnungen dauerhaft aus dem Entwurf entfernt. Die veröffentlichte Fassung bleibt bis zur nächsten Veröffentlichung unverändert.">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="eventId" value={event.id} />
  </ConfirmDeleteForm>;
}

export function EventEditorForms({ blockPlanId, courses, event, onSaved }: {
  blockPlanId: string;
  courses: EventCourse[];
  event: DraftEvent;
  onSaved: (message: ReactNode) => void;
}) {
  return <>
    <EditEventForm blockPlanId={blockPlanId} courses={courses} event={event} onSaved={onSaved} />
    <DeleteEventForm blockPlanId={blockPlanId} event={event} onSaved={onSaved} />
  </>;
}
