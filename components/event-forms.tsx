"use client";

import { useActionState, useId, useState } from "react";

import { type BlockPlanFormState, type EventFormState, createEventAction, deleteEventAction, updateEventAction } from "@/app/intern/blockplaene/actions";
import { eventCategories } from "@/lib/domain/event-category";
import type { DraftEvent } from "@/lib/domain/publication";
import type { EventField } from "@/lib/services/event-admin";

type EventCourse = { id: string; code: string };

function EventFields({ courses, event, state }: { courses: EventCourse[]; event?: DraftEvent; state: EventFormState }) {
  const ids = { title: useId(), description: useId(), category: useId(), start: useId(), end: useId(), endHint: useId(), error: useId(), hint: useId() };
  // A rejected save keeps what was entered; otherwise the saved event, if any, provides the defaults.
  const values = state.values;
  const affected = new Set(values?.courseIds ?? event?.courseIds ?? []);
  const invalid = (field: EventField) => state.field === field;
  const describedBy = (field: EventField, ...extra: string[]) => [...extra, invalid(field) ? ids.error : ""].filter(Boolean).join(" ") || undefined;
  return <>
    <p id={ids.hint}>Titel, Kategorie und Startdatum sind erforderlich. Der Titel fasst höchstens 160, die Beschreibung höchstens 2000 Zeichen.</p>
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    <label htmlFor={ids.title}>Titel</label>
    <input id={ids.title} name="title" type="text" required maxLength={160} defaultValue={values?.title ?? event?.title} autoComplete="off"
      aria-invalid={invalid("title") || undefined} aria-describedby={describedBy("title")} />
    <label htmlFor={ids.description}>Beschreibung (optional)</label>
    <textarea id={ids.description} name="description" rows={3} maxLength={2000} defaultValue={values?.description ?? event?.description ?? ""}
      aria-invalid={invalid("description") || undefined} aria-describedby={describedBy("description")} />
    <label htmlFor={ids.category}>Kategorie</label>
    <select id={ids.category} name="category" required defaultValue={values?.category ?? event?.category ?? ""}
      aria-invalid={invalid("category") || undefined} aria-describedby={describedBy("category")}>
      <option value="" disabled>Bitte wählen</option>
      {eventCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
    </select>
    <label htmlFor={ids.start}>Startdatum</label>
    <input id={ids.start} name="startDate" type="date" required defaultValue={values?.startDate ?? event?.startDate}
      aria-invalid={invalid("startDate") || undefined} aria-describedby={describedBy("startDate")} />
    <label htmlFor={ids.end}>Enddatum (optional)</label>
    <input id={ids.end} name="endDate" type="date" defaultValue={values?.endDate ?? event?.endDate ?? ""}
      aria-invalid={invalid("endDate") || undefined} aria-describedby={describedBy("endDate", ids.endHint)} />
    <p id={ids.endHint}>Ohne Enddatum gilt der Termin genau am Starttag, sonst einschließlich beider Grenztage.</p>
    <label className="account-check"><input type="checkbox" name="provisional" defaultChecked={values?.provisional ?? event?.provisional ?? false} /> Zeitangabe ist vorläufig</label>
    <fieldset className="account-fieldset" aria-describedby={describedBy("courseIds")}>
      <legend>Betroffene Kurse</legend>
      <p>Ein Termin betrifft mindestens einen Kurs dieses Blockplans. Das Semester wird je Kurs aus seinen Kursphasen abgeleitet.</p>
      {courses.map((course) => <label key={course.id}><input type="checkbox" name="courseIds" value={course.id} defaultChecked={affected.has(course.id)} /> {course.code}</label>)}
    </fieldset>
  </>;
}

export function CreateEventForm({ blockPlanId, courses }: { blockPlanId: string; courses: EventCourse[] }) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(createEventAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <EventFields courses={courses} state={state} />
    {state.success ? <p role="status">{state.success}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Termin wird angelegt …" : "Termin anlegen"}</button>
  </form>;
}

function EditEventForm({ blockPlanId, courses, event }: { blockPlanId: string; courses: EventCourse[]; event: DraftEvent }) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(updateEventAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="eventId" value={event.id} />
    <EventFields courses={courses} event={event} state={state} />
    {state.success ? <p role="status">{state.success}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Terminangaben speichern"}</button>
  </form>;
}

function DeleteEventForm({ blockPlanId, event }: { blockPlanId: string; event: DraftEvent }) {
  const [state, formAction, isPending] = useActionState<BlockPlanFormState, FormData>(deleteEventAction, {});
  const [confirming, setConfirming] = useState(false);
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="eventId" value={event.id} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    {confirming ? <div className="confirm-region" role="group" aria-label={`Termin „${event.title}“ löschen bestätigen`}>
      <p><strong>Termin „{event.title}“ löschen</strong></p>
      <p>Der Termin wird mit seinen Kurszuordnungen dauerhaft aus dem Entwurf entfernt. Die veröffentlichte Fassung bleibt bis zur nächsten Veröffentlichung unverändert.</p>
      <button className="button button--danger" type="submit" disabled={isPending}>{isPending ? "Wird gelöscht …" : "Endgültig löschen"}</button>
      <button className="button button--ghost" type="button" onClick={() => setConfirming(false)}>Abbrechen</button>
    </div> : <button className="button button--danger" type="button" onClick={() => setConfirming(true)}>Termin löschen</button>}
  </form>;
}

/** One saved event with its editing controls, collapsed until the editing is deliberately opened. */
export function EventEditor({ blockPlanId, courses, event }: { blockPlanId: string; courses: EventCourse[]; event: DraftEvent }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return <div className="event-editor">
    <h3>{event.title}</h3>
    <button className="button button--ghost" type="button" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen(!open)}>
      {open ? `Bearbeitung von „${event.title}“ schließen` : `Termin „${event.title}“ bearbeiten`}
    </button>
    <div id={regionId} hidden={!open}>
      <EditEventForm blockPlanId={blockPlanId} courses={courses} event={event} />
      <DeleteEventForm blockPlanId={blockPlanId} event={event} />
    </div>
  </div>;
}
