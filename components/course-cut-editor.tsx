"use client";

import { useActionState, useId } from "react";

import {
  type CutFormState,
  createCutEventsAction,
  createCutPhasesAction,
  deleteCutEventsAction,
  deleteCutPhasesAction,
  updateCutEventsAction,
  updateCutPhasesAction,
} from "@/app/intern/kurse/zuschnitt/actions";
import { DateField } from "@/components/date-field";
import { ConfirmAction } from "@/components/editor-controls";
import { PlanMatrix } from "@/components/plan-matrix";
import { eventCategories, eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import { validatePublication, type DraftCourse, type DraftEvent, type DraftPhase } from "@/lib/domain/publication";
import type { EventField, EventInput } from "@/lib/services/event-admin";
import type { PhaseDetails, PhaseField, PhaseInput } from "@/lib/services/phase-admin";

type EditablePhase = DraftPhase & { id: string };

function CourseChoices({ courses }: { courses: DraftCourse[] }) {
  return <fieldset className="account-fieldset">
    <legend>Betroffene Kurse</legend>
    <p>Bei mehreren Kursen entstehen eigenständige Angaben. Spätere Änderungen an einem Kurs wirken nicht auf die anderen.</p>
    {courses.map((course) => <label key={course.id}><input name="courseId" type="checkbox" value={course.id} /> {course.code}</label>)}
  </fieldset>;
}

function PhaseCreateForm({ courses, semesters }: { courses: DraftCourse[]; semesters: number }) {
  const [state, action, pending] = useActionState<CutFormState<PhaseField, PhaseInput>, FormData>(createCutPhasesAction, {});
  const ids = { semester: useId(), type: useId(), error: useId() };
  const values = state.values;
  return <form action={action} className="account-form">
    <CourseChoices courses={courses} />
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <label htmlFor={ids.semester}>Semester</label>
    <select id={ids.semester} name="semester" required defaultValue={values?.semester ?? ""} aria-invalid={state.field === "semester" || undefined} aria-describedby={state.field === "semester" ? ids.error : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {Array.from({ length: semesters }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
    </select>
    <label htmlFor={ids.type}>Phasentyp</label>
    <select id={ids.type} name="type" required defaultValue={values?.type ?? ""} aria-invalid={state.field === "type" || undefined} aria-describedby={state.field === "type" ? ids.error : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" required defaultValue={values?.startDate ?? ""} invalid={state.field === "startDate"} errorId={ids.error} />
    <DateField label="Enddatum" name="endDate" required defaultValue={values?.endDate ?? ""} invalid={state.field === "endDate"} errorId={ids.error} />
    <button className="button" type="submit" disabled={pending}>{pending ? "Wird gespeichert …" : "Kursphase speichern"}</button>
  </form>;
}

function EventCreateForm({ courses }: { courses: DraftCourse[] }) {
  const [state, action, pending] = useActionState<CutFormState<EventField, EventInput>, FormData>(createCutEventsAction, {});
  const ids = { title: useId(), category: useId(), error: useId() };
  const values = state.values;
  return <form action={action} className="account-form">
    <CourseChoices courses={courses} />
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <label htmlFor={ids.title}>Titel</label>
    <input id={ids.title} name="title" type="text" required maxLength={160} defaultValue={values?.title} aria-invalid={state.field === "title" || undefined} aria-describedby={state.field === "title" ? ids.error : undefined} />
    <label>Beschreibung (optional)<textarea name="description" rows={3} maxLength={2000} defaultValue={values?.description} /></label>
    <label htmlFor={ids.category}>Kategorie</label>
    <select id={ids.category} name="category" required defaultValue={values?.category ?? ""} aria-invalid={state.field === "category" || undefined} aria-describedby={state.field === "category" ? ids.error : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {eventCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" required defaultValue={values?.startDate ?? ""} invalid={state.field === "startDate"} errorId={ids.error} />
    <DateField label="Enddatum (optional)" name="endDate" defaultValue={values?.endDate ?? ""} invalid={state.field === "endDate"} errorId={ids.error} />
    <label className="account-check"><input type="checkbox" name="provisional" defaultChecked={values?.provisional} /> Zeitangabe ist vorläufig</label>
    <button className="button" type="submit" disabled={pending}>{pending ? "Wird gespeichert …" : "Termin speichern"}</button>
  </form>;
}

function CourseStatus({ course, phases, events }: { course: DraftCourse; phases: DraftPhase[]; events: DraftEvent[] }) {
  const issues = validatePublication({
    courses: [course],
    phases: phases.filter((phase) => phase.courseId === course.id),
    events: events.filter((event) => event.courseIds.includes(course.id)).map((event) => ({ ...event, courseIds: [course.id] })),
  });
  return <li><strong>{course.code}:</strong> {issues.length
    ? <><span> {issues.length === 1 ? "1 offener Punkt:" : `${issues.length} offene Punkte:`}</span><ul>{issues.map((issue) => <li key={`${issue.code}-${issue.semester}-${issue.eventId}`}>{issue.message}</li>)}</ul></>
    : "Planungsstand ist vollständig."}</li>;
}

type PhaseGroup = { semester: number; type: EditablePhase["type"]; startDate: string; endDate: string; phases: EditablePhase[] };

function phaseGroups(phases: EditablePhase[]): PhaseGroup[] {
  const groups = new Map<string, PhaseGroup>();
  for (const phase of phases) {
    const key = `${phase.semester}|${phase.type}|${phase.startDate}|${phase.endDate}`;
    const group = groups.get(key) ?? { semester: phase.semester, type: phase.type, startDate: phase.startDate, endDate: phase.endDate, phases: [] };
    group.phases.push(phase);
    groups.set(key, group);
  }
  return [...groups.values()].toSorted((left, right) => left.semester - right.semester || left.startDate.localeCompare(right.startDate));
}

function PhaseRowEditor({ group, courses, semesters }: { group: PhaseGroup; courses: DraftCourse[]; semesters: number }) {
  const [updateState, updateAction, updating] = useActionState<CutFormState<PhaseField, PhaseDetails>, FormData>(updateCutPhasesAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<CutFormState, FormData>(deleteCutPhasesAction, {});
  const ids = { semester: useId(), type: useId(), error: useId() };
  const codes = group.phases.map((phase) => courses.find((course) => course.id === phase.courseId)?.code ?? phase.courseId);
  const shared = codes.length > 1;
  const values = updateState.values;
  const hidden = group.phases.map((phase) => <input key={phase.id} type="hidden" name="phaseId" value={phase.id} />);
  const consequence = `Folgende Kursphasen werden einzeln geändert: ${codes.join(", ")}. Spätere Änderungen wirken jeweils nur auf den betreffenden Kurs.`;
  return <li className="editor-card">
    <p><strong>{codes.join(" · ")}</strong> · Semester {group.semester} · {phaseTypeLabel(group.type)} · {group.startDate} bis {group.endDate}</p>
    <form action={updateAction} className="account-form">
      {hidden}
      {updateState.error ? <p id={ids.error} role="alert">{updateState.error}</p> : null}
      {updateState.success ? <p role="status">{updateState.success}</p> : null}
      <label htmlFor={ids.semester}>Semester</label>
      <select id={ids.semester} name="semester" defaultValue={values?.semester ?? String(group.semester)} required aria-invalid={updateState.field === "semester" || undefined} aria-describedby={updateState.field === "semester" ? ids.error : undefined}>
        {Array.from({ length: semesters }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
      </select>
      <label htmlFor={ids.type}>Phasentyp</label>
      <select id={ids.type} name="type" defaultValue={values?.type ?? group.type} required aria-invalid={updateState.field === "type" || undefined} aria-describedby={updateState.field === "type" ? ids.error : undefined}>{phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
      <DateField label="Startdatum" name="startDate" required defaultValue={values?.startDate ?? group.startDate} invalid={updateState.field === "startDate"} errorId={ids.error} />
      <DateField label="Enddatum" name="endDate" required defaultValue={values?.endDate ?? group.endDate} invalid={updateState.field === "endDate"} errorId={ids.error} />
      {shared
        ? <ConfirmAction openLabel="Kursphasen ändern" heading="Zusammengefasste Kursphasen ändern" consequence={consequence} confirmLabel="Änderungen speichern" pendingLabel="Wird gespeichert …" isPending={updating} />
        : <button className="button" type="submit" disabled={updating}>{updating ? "Wird gespeichert …" : "Kursphase speichern"}</button>}
    </form>
    <form action={deleteAction} className="account-form">
      {hidden}
      {deleteState.error ? <p role="alert">{deleteState.error}</p> : null}
      {deleteState.success ? <p role="status">{deleteState.success}</p> : null}
      <ConfirmAction openLabel="Kursphase löschen" heading={shared ? "Zusammengefasste Kursphasen löschen" : "Kursphase löschen"}
        consequence={shared ? `Folgende Kursphasen werden einzeln gelöscht: ${codes.join(", ")}.` : "Die Kursphase wird aus dem Planungsstand gelöscht."}
        confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={deleting} danger />
    </form>
  </li>;
}

type CutEvent = DraftEvent & { affectedCourseCodes: string[] };
type EventGroup = { title: string; category: DraftEvent["category"]; startDate: string; endDate: string | null; provisional: boolean; events: CutEvent[] };

function eventGroups(events: CutEvent[]): EventGroup[] {
  const groups = new Map<string, EventGroup>();
  for (const event of events) {
    const title = event.title.trim().replace(/\s+/gu, " ");
    const key = `${event.category}|${title}|${event.startDate}|${event.endDate}|${event.provisional}`;
    const group = groups.get(key) ?? { title, category: event.category, startDate: event.startDate, endDate: event.endDate, provisional: event.provisional, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.values()].toSorted((left, right) => left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title, "de"));
}

function EventRowEditor({ group }: { group: EventGroup }) {
  const [updateState, updateAction, updating] = useActionState<CutFormState<EventField, Omit<EventInput, "courseIds">>, FormData>(updateCutEventsAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<CutFormState, FormData>(deleteCutEventsAction, {});
  const ids = { title: useId(), category: useId(), error: useId() };
  const codes = [...new Set(group.events.flatMap((event) => event.affectedCourseCodes))];
  const shared = codes.length > 1;
  const values = updateState.values;
  const hidden = group.events.map((event) => <input key={event.id} type="hidden" name="eventId" value={event.id} />);
  const consequence = `Folgende Termine werden einzeln geändert: ${codes.join(", ")}. Spätere Änderungen wirken jeweils nur auf den betreffenden Kurs.`;
  return <li className="editor-card">
    <p><strong>{codes.join(" · ")}</strong> · {eventCategoryLabel(group.category)} · {group.title} · {group.startDate}{group.endDate ? ` bis ${group.endDate}` : ""}</p>
    <form action={updateAction} className="account-form">
      {hidden}
      {updateState.error ? <p id={ids.error} role="alert">{updateState.error}</p> : null}
      {updateState.success ? <p role="status">{updateState.success}</p> : null}
      <label htmlFor={ids.title}>Titel</label>
      <input id={ids.title} name="title" type="text" required maxLength={160} defaultValue={values?.title ?? group.title} aria-invalid={updateState.field === "title" || undefined} aria-describedby={updateState.field === "title" ? ids.error : undefined} />
      <label>Beschreibung (optional)<textarea name="description" rows={3} maxLength={2000} defaultValue={values?.description ?? group.events[0]?.description ?? ""} /></label>
      <label htmlFor={ids.category}>Kategorie</label>
      <select id={ids.category} name="category" required defaultValue={values?.category ?? group.category} aria-invalid={updateState.field === "category" || undefined} aria-describedby={updateState.field === "category" ? ids.error : undefined}>{eventCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
      <DateField label="Startdatum" name="startDate" required defaultValue={values?.startDate ?? group.startDate} invalid={updateState.field === "startDate"} errorId={ids.error} />
      <DateField label="Enddatum (optional)" name="endDate" defaultValue={values?.endDate ?? group.endDate ?? ""} invalid={updateState.field === "endDate"} errorId={ids.error} />
      <label className="account-check"><input type="checkbox" name="provisional" defaultChecked={values?.provisional ?? group.provisional} /> Zeitangabe ist vorläufig</label>
      {shared
        ? <ConfirmAction openLabel="Termine ändern" heading="Zusammengefasste Termine ändern" consequence={consequence} confirmLabel="Änderungen speichern" pendingLabel="Wird gespeichert …" isPending={updating} />
        : <button className="button" type="submit" disabled={updating}>{updating ? "Wird gespeichert …" : "Termin speichern"}</button>}
    </form>
    <form action={deleteAction} className="account-form">
      {hidden}
      {deleteState.error ? <p role="alert">{deleteState.error}</p> : null}
      {deleteState.success ? <p role="status">{deleteState.success}</p> : null}
      <ConfirmAction openLabel="Termin löschen" heading={shared ? "Zusammengefasste Termine löschen" : "Termin löschen"}
        consequence={shared ? `Folgende Termine werden einzeln gelöscht: ${codes.join(", ")}.` : "Der Termin wird aus dem Planungsstand gelöscht."}
        confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={deleting} danger />
    </form>
  </li>;
}

export function CourseCutEditor({ courses, phases, events }: {
  courses: DraftCourse[];
  phases: EditablePhase[];
  events: CutEvent[];
}) {
  const semesters = Math.max(...courses.map((course) => course.semesters), 0);
  return <>
    <section className="workspace-panel" aria-labelledby="cut-status-heading">
      <h2 id="cut-status-heading">Planungsstand je Kurs</h2>
      <ul className="entry-list">{courses.map((course) => <CourseStatus key={course.id} course={course} phases={phases} events={events} />)}</ul>
    </section>
    <PlanMatrix courses={courses} phases={phases} events={events} />
    <section className="workspace-panel" aria-labelledby="phase-create-heading">
      <h2 id="phase-create-heading">Kursphase anlegen</h2>
      <p>Jede Speicherung ist eine einzelne Operation. Es gibt kein automatisches Speichern.</p>
      <PhaseCreateForm courses={courses} semesters={semesters} />
      {phases.length ? <section aria-labelledby="phase-edit-heading">
        <h3 id="phase-edit-heading">Gespeicherte Kursphasen</h3>
        <p>Übereinstimmende Kursphasen stehen zusammen. Eine Änderung oder Löschung nennt vor dem Speichern alle einzeln betroffenen Kurse.</p>
        <ul className="entry-list">{phaseGroups(phases).map((group) => <PhaseRowEditor key={`${group.semester}-${group.type}-${group.startDate}-${group.endDate}`} group={group} courses={courses} semesters={semesters} />)}</ul>
      </section> : null}
    </section>
    <section className="workspace-panel" aria-labelledby="event-create-heading">
      <h2 id="event-create-heading">Prüfungsrelevanten Termin anlegen</h2>
      <p>Bei mehreren ausgewählten Kursen entstehen eigenständige Termine.</p>
      <EventCreateForm courses={courses} />
      {events.length ? <section aria-labelledby="event-edit-heading">
        <h3 id="event-edit-heading">Gespeicherte Termine</h3>
        <p>Übereinstimmende Termine stehen zusammen. Eine Änderung oder Löschung nennt vor dem Speichern alle einzeln betroffenen Kurse.</p>
        <ul className="entry-list">{eventGroups(events).map((group) => <EventRowEditor key={`${group.category}-${group.title}-${group.startDate}-${group.endDate}-${group.provisional}`} group={group} />)}</ul>
      </section> : null}
    </section>
  </>;
}
