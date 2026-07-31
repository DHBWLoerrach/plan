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
// A type-only import: the module is server-only and is erased here rather than pulled into the client bundle.
import type { CutCourse } from "@/app/intern/kurse/data";
import { DateField } from "@/components/date-field";
import { ConfirmAction } from "@/components/editor-controls";
import { PlanMatrix } from "@/components/plan-matrix";
import { areaAccessLabel, workInProgressLabel } from "@/lib/domain/course-status";
import { eventCategories, eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import { validatePublication, type CourseEvent, type CoursePhase } from "@/lib/domain/publication";
import type { EventField, EventInput } from "@/lib/services/event-admin";
import type { PhaseDetails, PhaseField, PhaseInput } from "@/lib/services/phase-admin";

type EditablePhase = CoursePhase & { id: string };

/** Only the courses of the own areas are offered: a write to a foreign course would be refused by the domain logic. */
function CourseChoices({ courses }: { courses: CutCourse[] }) {
  return <fieldset className="account-fieldset">
    <legend>Betroffene Kurse</legend>
    <p>Bei mehreren Kursen entstehen eigenständige Angaben. Spätere Änderungen an einem Kurs wirken nicht auf die anderen.</p>
    {courses.map((course) => <label key={course.id}><input name="courseId" type="checkbox" value={course.id} /> {course.code}{course.state === "PUBLISHED" ? " · veröffentlicht" : ""}</label>)}
  </fieldset>;
}

function PhaseCreateForm({ courses, semesters }: { courses: CutCourse[]; semesters: number }) {
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

function EventCreateForm({ courses }: { courses: CutCourse[] }) {
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
    <ConfirmAction openLabel="Termin prüfen" heading="Prüfungsrelevanten Termin speichern"
      consequence="Der Termin wird gespeichert. Für veröffentlichte Kurse ist er anschließend unmittelbar öffentlich sichtbar."
      shouldConfirm={(formData) => formData.getAll("courseId").some((id) => courses.find((course) => course.id === id)?.state === "PUBLISHED")}
      preview={(formData) => {
        const selected = formData.getAll("courseId").map(String).map((id) => courses.find((course) => course.id === id)).filter(Boolean) as CutCourse[];
        return <><p><strong>Betroffene Kurse:</strong> {selected.map((course) => course.code).join(", ")}</p>
          <p><strong>Termin:</strong> {String(formData.get("title") ?? "")} · {String(formData.get("startDate") ?? "")}{formData.get("endDate") ? ` bis ${String(formData.get("endDate"))}` : ""}</p>
          <p>Für veröffentlichte Kurse ist der Termin nach erfolgreicher Prüfung unmittelbar öffentlich sichtbar.</p></>;
      }}
      confirmLabel="Termin speichern und veröffentlichen" pendingLabel="Wird gespeichert …" isPending={pending} />
  </form>;
}

function CourseStatus({ course, phases, events }: { course: CutCourse; phases: CoursePhase[]; events: CourseEvent[] }) {
  const issues = validatePublication({
    course,
    phases: phases.filter((phase) => phase.courseId === course.id),
    events: events.filter((event) => event.courseIds.includes(course.id)),
  });
  return <li>
    <p><strong>{course.code}</strong> · Bereich {course.areaName} · {areaAccessLabel(course.editable)}{course.workInProgress ? ` · ${workInProgressLabel}` : ""}</p>
    {issues.length
      ? <><p>{issues.length === 1 ? "1 offener Punkt:" : `${issues.length} offene Punkte:`}</p><ul>{issues.map((issue) => <li key={`${issue.code}-${issue.semester}-${issue.eventId}`}>{issue.message}</li>)}</ul></>
      : <p>Planungsstand ist vollständig.</p>}
  </li>;
}

/** The courses of a cut by id, so a summarised row looks its courses up instead of scanning the cut per entry. */
type CourseLookup = Map<string, CutCourse>;

type RowSplit<TItem> = { editable: TItem[]; editableCodes: string[]; readOnlyCodes: string[] };

/**
 * Splits a summarised row into what this account may write to and what it may only read. Summarising shows agreement
 * across the whole cut, so a row may hold entries of own and of foreign areas; its forms then act on the own entries
 * alone and name exactly those, and never send a write the domain logic would refuse (ADR 0011).
 */
function splitByEditability<TItem>(items: TItem[], isEditable: (item: TItem) => boolean, codesOf: (item: TItem) => string[]): RowSplit<TItem> {
  const codes = (subset: TItem[]) => [...new Set(subset.flatMap(codesOf))];
  const editable = items.filter(isEditable);
  return { editable, editableCodes: codes(editable), readOnlyCodes: codes(items.filter((item) => !isEditable(item))) };
}

/** Names the entries of a summarised row that this account may only read, so nobody expects the row to change them. */
function ReadOnlyRowNote({ codes, subject }: { codes: string[]; subject: string }) {
  if (!codes.length) return null;
  return <p className="notice">{codes.join(", ")}: {areaAccessLabel(false)}. Änderungen und Löschungen dieser Zeile lassen {subject} unberührt.</p>;
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

function PhaseRowEditor({ group, coursesById }: { group: PhaseGroup; coursesById: CourseLookup }) {
  const [updateState, updateAction, updating] = useActionState<CutFormState<PhaseField, PhaseDetails>, FormData>(updateCutPhasesAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<CutFormState, FormData>(deleteCutPhasesAction, {});
  const ids = { semester: useId(), type: useId(), error: useId() };
  const courseOf = (phase: EditablePhase) => coursesById.get(phase.courseId);
  const codes = group.phases.map((phase) => courseOf(phase)?.code ?? phase.courseId);
  const { editable: editablePhases, editableCodes, readOnlyCodes } =
    splitByEditability(group.phases, (phase) => Boolean(courseOf(phase)?.editable), (phase) => [courseOf(phase)?.code ?? phase.courseId]);
  const shared = editableCodes.length > 1;
  const publishedCodes = editablePhases.filter((phase) => courseOf(phase)?.state === "PUBLISHED")
    .map((phase) => courseOf(phase)?.code ?? phase.courseId);
  const deletablePhases = editablePhases.filter((phase) => courseOf(phase)?.state === "UNPUBLISHED");
  const deletableCodes = deletablePhases.map((phase) => courseOf(phase)?.code ?? phase.courseId);
  const values = updateState.values;
  const updateHidden = editablePhases.map((phase) => <input key={phase.id} type="hidden" name="phaseId" value={phase.id} />);
  const deleteHidden = deletablePhases.map((phase) => <input key={phase.id} type="hidden" name="phaseId" value={phase.id} />);
  const consequence = `Folgende Kursphasen werden einzeln geändert: ${editableCodes.join(", ")}. Spätere Änderungen wirken jeweils nur auf den betreffenden Kurs.`;
  // The semester range is that of the courses actually being changed, so a foreign course of a longer study program
  // never offers a semester the own course would refuse.
  const semesters = Math.max(...editablePhases.map((phase) => courseOf(phase)?.semesters ?? 0), 0);
  const header = <>
    <p><strong>{codes.join(" · ")}</strong> · Semester {group.semester} · {phaseTypeLabel(group.type)} · {group.startDate} bis {group.endDate}</p>
    <ReadOnlyRowNote codes={readOnlyCodes} subject="diese Kursphasen" />
  </>;
  if (!editablePhases.length) return <li className="editor-card">{header}</li>;
  return <li className="editor-card">
    {header}
    <form action={updateAction} className="account-form">
      {updateHidden}
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
      {shared || publishedCodes.length
        ? <ConfirmAction openLabel="Kursphasen prüfen" heading={shared ? "Zusammengefasste Kursphasen ändern" : "Öffentliche Kursphase ändern"} consequence={consequence}
            preview={(formData) => <><p><strong>Betroffene Kurse:</strong> {editableCodes.join(", ")}</p>
              <ul>
                <li>Semester: {group.semester} → {String(formData.get("semester") ?? "")}</li>
                <li>Phasentyp: {phaseTypeLabel(group.type)} → {phaseTypes.find((type) => type.value === formData.get("type"))?.label ?? String(formData.get("type") ?? "")}</li>
                <li>Zeitraum: {group.startDate} bis {group.endDate} → {String(formData.get("startDate") ?? "")} bis {String(formData.get("endDate") ?? "")}</li>
              </ul>
              {publishedCodes.length ? <p>Bei {publishedCodes.join(", ")} werden angrenzende Phasengrenzen in derselben Transaktion mitverschoben. Nach erfolgreicher Gesamtprüfung ist die Änderung unmittelbar öffentlich sichtbar.</p> : <p>{consequence}</p>}</>}
            confirmLabel={publishedCodes.length ? "Änderungen speichern und veröffentlichen" : "Änderungen speichern"} pendingLabel="Wird gespeichert …" isPending={updating} />
        : <button className="button" type="submit" disabled={updating}>{updating ? "Wird gespeichert …" : "Kursphase speichern"}</button>}
    </form>
    {publishedCodes.length ? <p className="notice">Einzelne Phasen von {publishedCodes.join(", ")} können im veröffentlichten, lückenlosen Verlauf nicht gelöscht werden. Ihre Grenzen können oben atomar verschoben werden.</p> : null}
    {deletablePhases.length ? <form action={deleteAction} className="account-form">
      {deleteHidden}
      {deleteState.error ? <p role="alert">{deleteState.error}</p> : null}
      {deleteState.success ? <p role="status">{deleteState.success}</p> : null}
      <ConfirmAction openLabel="Kursphase löschen" heading={deletableCodes.length > 1 ? "Zusammengefasste Kursphasen löschen" : "Kursphase löschen"}
        consequence={deletableCodes.length > 1
          ? `Folgende Kursphasen werden einzeln gelöscht: ${deletableCodes.join(", ")}.`
          : `Die Kursphase von ${deletableCodes.join(", ")} wird aus dem Planungsstand gelöscht.`}
        confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={deleting} danger />
    </form> : null}
  </li>;
}

type CutEvent = CourseEvent & { affectedCourseCodes: string[] };
type EventGroup = { title: string; category: CourseEvent["category"]; startDate: string; endDate: string | null; provisional: boolean; events: CutEvent[] };

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

function EventRowEditor({ group, coursesById }: { group: EventGroup; coursesById: CourseLookup }) {
  const [updateState, updateAction, updating] = useActionState<CutFormState<EventField, Omit<EventInput, "courseIds">>, FormData>(updateCutEventsAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<CutFormState, FormData>(deleteCutEventsAction, {});
  const ids = { title: useId(), category: useId(), error: useId() };
  const codes = [...new Set(group.events.flatMap((event) => event.affectedCourseCodes))];
  const { editable: editableEvents, editableCodes, readOnlyCodes } = splitByEditability(group.events,
    (event) => event.courseIds.every((courseId) => coursesById.get(courseId)?.editable), (event) => event.affectedCourseCodes);
  const shared = editableCodes.length > 1;
  const publishedCodes = editableEvents.filter((event) => event.courseIds.some((courseId) => coursesById.get(courseId)?.state === "PUBLISHED"))
    .flatMap((event) => event.affectedCourseCodes);
  const values = updateState.values;
  const hidden = editableEvents.map((event) => <input key={event.id} type="hidden" name="eventId" value={event.id} />);
  const consequence = `Folgende Termine werden einzeln geändert: ${editableCodes.join(", ")}. Spätere Änderungen wirken jeweils nur auf den betreffenden Kurs.`;
  const header = <>
    <p><strong>{codes.join(" · ")}</strong> · {eventCategoryLabel(group.category)} · {group.title} · {group.startDate}{group.endDate ? ` bis ${group.endDate}` : ""}</p>
    <ReadOnlyRowNote codes={readOnlyCodes} subject="diese Termine" />
  </>;
  if (!editableEvents.length) return <li className="editor-card">{header}</li>;
  return <li className="editor-card">
    {header}
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
      {shared || publishedCodes.length
        ? <ConfirmAction openLabel="Termine prüfen" heading={shared ? "Zusammengefasste Termine ändern" : "Öffentlichen Termin ändern"} consequence={consequence}
            preview={(formData) => <><p><strong>Betroffene Kurse:</strong> {editableCodes.join(", ")}</p>
              <ul>
                <li>Titel: {group.title} → {String(formData.get("title") ?? "")}</li>
                <li>Kategorie: {eventCategoryLabel(group.category)} → {eventCategories.find((category) => category.value === formData.get("category"))?.label ?? String(formData.get("category") ?? "")}</li>
                <li>Zeitraum: {group.startDate}{group.endDate ? ` bis ${group.endDate}` : ""} → {String(formData.get("startDate") ?? "")}{formData.get("endDate") ? ` bis ${String(formData.get("endDate"))}` : ""}</li>
              </ul>
              {publishedCodes.length ? <p>Nach erfolgreicher Prüfung ist die Änderung bei {publishedCodes.join(", ")} unmittelbar öffentlich sichtbar.</p> : <p>{consequence}</p>}</>}
            confirmLabel={publishedCodes.length ? "Änderungen speichern und veröffentlichen" : "Änderungen speichern"} pendingLabel="Wird gespeichert …" isPending={updating} />
        : <button className="button" type="submit" disabled={updating}>{updating ? "Wird gespeichert …" : "Termin speichern"}</button>}
    </form>
    <form action={deleteAction} className="account-form">
      {hidden}
      {deleteState.error ? <p role="alert">{deleteState.error}</p> : null}
      {deleteState.success ? <p role="status">{deleteState.success}</p> : null}
      <ConfirmAction openLabel="Termin löschen" heading={shared ? "Zusammengefasste Termine löschen" : "Termin löschen"}
        consequence={shared
          ? `Folgende Termine werden einzeln gelöscht: ${editableCodes.join(", ")}.`
          : `Der Termin von ${editableCodes.join(", ")} wird gelöscht.${publishedCodes.length ? " Die Löschung ist nach erfolgreicher Prüfung unmittelbar öffentlich sichtbar." : ""}`}
        confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={deleting} danger />
    </form>
  </li>;
}

export function CourseCutEditor({ courses, phases, events }: {
  courses: CutCourse[];
  phases: EditablePhase[];
  events: CutEvent[];
}) {
  const coursesById: CourseLookup = new Map(courses.map((course) => [course.id, course]));
  const editableCourses = courses.filter((course) => course.editable);
  // What may be created is bounded by the own courses alone: a foreign study program of seven semesters must not offer
  // a seventh semester for an own course of six.
  const phaseCreationCourses = editableCourses.filter((course) => course.state === "UNPUBLISHED");
  const semesters = Math.max(...phaseCreationCourses.map((course) => course.semesters), 0);
  const readOnlyCodes = courses.filter((course) => !course.editable).map((course) => course.code);
  const readOnlyHint = readOnlyCodes.length
    ? <p className="notice">Sie können {readOnlyCodes.join(", ")} nur lesen: {readOnlyCodes.length === 1 ? "dieser Kurs gehört" : "diese Kurse gehören"} zu einem Bereich, der Ihnen nicht zugeordnet ist. Angelegt wird deshalb ausschließlich für Ihre eigenen Kurse.</p>
    : null;
  return <>
    <section className="workspace-panel" aria-labelledby="cut-status-heading">
      <h2 id="cut-status-heading">Planungsstand je Kurs</h2>
      <p>Ein nicht veröffentlichter Kurs ist als „{workInProgressLabel}“ gekennzeichnet und darf unvollständig sein. Bestätigte Änderungen an veröffentlichten Kursen wirken unmittelbar öffentlich.</p>
      <ul className="entry-list">{courses.map((course) => <CourseStatus key={course.id} course={course} phases={phases} events={events} />)}</ul>
    </section>
    <PlanMatrix courses={courses} phases={phases} events={events} workInProgressCourseIds={courses.filter((course) => course.workInProgress).map((course) => course.id)} />
    <section className="workspace-panel" aria-labelledby="phase-create-heading">
      <h2 id="phase-create-heading">Kursphase anlegen</h2>
      <p>Jede Speicherung ist eine einzelne Operation. Es gibt kein automatisches Speichern.</p>
      {readOnlyHint}
      {editableCourses.some((course) => course.state === "UNPUBLISHED")
        ? <PhaseCreateForm courses={phaseCreationCourses} semesters={semesters} />
        : <p className="empty-note">In veröffentlichten Kursen werden keine einzelnen Phasen ergänzt. Verschieben Sie stattdessen eine vorhandene Phasengrenze; angrenzende Phasen werden atomar angepasst.</p>}
      {phases.length ? <section aria-labelledby="phase-edit-heading">
        <h3 id="phase-edit-heading">Gespeicherte Kursphasen</h3>
        <p>Übereinstimmende Kursphasen stehen zusammen. Eine Änderung oder Löschung nennt vor dem Speichern alle einzeln betroffenen Kurse.</p>
        <ul className="entry-list">{phaseGroups(phases).map((group) => <PhaseRowEditor key={`${group.semester}-${group.type}-${group.startDate}-${group.endDate}`} group={group} coursesById={coursesById} />)}</ul>
      </section> : null}
    </section>
    <section className="workspace-panel" aria-labelledby="event-create-heading">
      <h2 id="event-create-heading">Prüfungsrelevanten Termin anlegen</h2>
      <p>Bei mehreren ausgewählten Kursen entstehen eigenständige Termine.</p>
      {readOnlyHint}
      {editableCourses.length ? <EventCreateForm courses={editableCourses} /> : <p className="empty-note">Dieser Zuschnitt enthält keinen Kurs Ihrer Bereiche. Sie können ihn lesen, aber keinen Termin anlegen.</p>}
      {events.length ? <section aria-labelledby="event-edit-heading">
        <h3 id="event-edit-heading">Gespeicherte Termine</h3>
        <p>Übereinstimmende Termine stehen zusammen. Eine Änderung oder Löschung nennt vor dem Speichern alle einzeln betroffenen Kurse.</p>
        <ul className="entry-list">{eventGroups(events).map((group) => <EventRowEditor key={`${group.category}-${group.title}-${group.startDate}-${group.endDate}-${group.provisional}`} group={group} coursesById={coursesById} />)}</ul>
      </section> : null}
    </section>
  </>;
}
