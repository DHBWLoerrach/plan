"use client";

import { useActionState, useId, type ReactNode } from "react";

import {
  type PlanFormState,
  createEventAction,
  createPhaseAction,
  deleteEventAction,
  deletePhaseAction,
  updateEventAction,
  updatePhaseAction,
} from "@/app/intern/kurse/[courseId]/actions";
// A type-only import: the module is server-only and is erased here rather than pulled into the client bundle.
import type { PlanCourse } from "@/app/intern/kurse/data";
import { DateField } from "@/components/date-field";
import { ConfirmAction } from "@/components/editor-controls";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { eventCategories, eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import { type PlanEvent, type PlanPhase } from "@/lib/domain/publication";
import type { EventField, EventInput } from "@/lib/services/event-admin";
import type { PhaseDetails, PhaseField, PhaseInput } from "@/lib/services/phase-admin";

/**
 * One entry of the page that rests as a line and opens into the form belonging to it. A native `details` carries the
 * whole behaviour: it is operable by keyboard without any script of ours, states its own expanded condition to
 * assistive technology, and `name` lets the browser keep at most one entry of a group open. Closing hides the form
 * without unmounting it, so anything already typed is still there when it is opened again.
 */
function Disclosure({ group, summary, hint, children }: { group: string; summary: ReactNode; hint?: string; children: ReactNode }) {
  return <details className="disclosure" name={group}>
    {/* The hint is what opening does, said only where the summary itself does not already say it: an entry names
        itself and needs „Bearbeiten“ beside it, while „Kursphase ergänzen“ is the action already. */}
    <summary><span className="disclosure__summary">{summary}</span>{hint ? <span className="disclosure__hint">{hint}</span> : null}</summary>
    <div className="disclosure__body">{children}</div>
  </details>;
}

/**
 * The courses a newly captured entry may additionally be written to. They are always courses of the comparison, never
 * the edited course itself, and always ones this account may write to — the domain would refuse anything else
 * (ADR 0011). What is written stays independent per course (ADR 0006); the transfer copies a value, it does not share it.
 */
function TransferChoices({ courses, subject }: { courses: PlanCourse[]; subject: string }) {
  if (!courses.length) return null;
  return <fieldset className="account-fieldset">
    <legend>Zusätzlich übertragen auf</legend>
    <p>Optional. Bei jedem angekreuzten Kurs entsteht {subject}. Spätere Änderungen an einem Kurs wirken nicht auf die anderen.</p>
    {courses.map((course) => <label key={course.id}><input name="transferCourseId" type="checkbox" value={course.id} /> {course.code}{course.state === "PUBLISHED" ? " · veröffentlicht" : ""}</label>)}
  </fieldset>;
}

/** The codes a submitted form transfers to, read back from the checkboxes so a confirmation names what is really ticked. */
function transferCodes(formData: FormData, courses: PlanCourse[]): string[] {
  return formData.getAll("transferCourseId").map(String)
    .map((id) => courses.find((course) => course.id === id)?.code)
    .filter((code): code is string => Boolean(code));
}

function PhaseCreateForm({ course, transferTargets }: { course: PlanCourse; transferTargets: PlanCourse[] }) {
  const [state, action, pending] = useActionState<PlanFormState<PhaseField, PhaseInput>, FormData>(createPhaseAction, {});
  const ids = { semester: useId(), type: useId(), error: useId() };
  const values = state.values;
  return <form action={action} className="account-form">
    <input type="hidden" name="courseId" value={course.id} />
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <label htmlFor={ids.semester}>Semester</label>
    <select id={ids.semester} name="semester" required defaultValue={values?.semester ?? ""} aria-invalid={state.field === "semester" || undefined} aria-describedby={state.field === "semester" ? ids.error : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {Array.from({ length: course.semesters }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
    </select>
    <label htmlFor={ids.type}>Phasentyp</label>
    <select id={ids.type} name="type" required defaultValue={values?.type ?? ""} aria-invalid={state.field === "type" || undefined} aria-describedby={state.field === "type" ? ids.error : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" required defaultValue={values?.startDate ?? ""} invalid={state.field === "startDate"} errorId={ids.error} />
    <DateField label="Enddatum" name="endDate" required defaultValue={values?.endDate ?? ""} invalid={state.field === "endDate"} errorId={ids.error} />
    <TransferChoices courses={transferTargets} subject="eine eigenständige Kursphase" />
    {transferTargets.length
      ? <ConfirmAction openLabel="Kursphase speichern" heading="Kursphase auf weitere Kurse übertragen"
          consequence={`Die Kursphase wird für ${course.code} gespeichert.`}
          shouldConfirm={(formData) => formData.getAll("transferCourseId").length > 0}
          preview={(formData) => <><p><strong>Betroffene Kurse:</strong> {[course.code, ...transferCodes(formData, transferTargets)].join(", ")}</p>
            <p>Je Kurs entsteht eine eigenständige Kursphase. Spätere Änderungen wirken jeweils nur auf den betreffenden Kurs.</p></>}
          confirmLabel="Kursphasen speichern" pendingLabel="Wird gespeichert …" isPending={pending} />
      : <button className="button" type="submit" disabled={pending}>{pending ? "Wird gespeichert …" : "Kursphase speichern"}</button>}
  </form>;
}

function PhaseRowEditor({ phase, course }: { phase: PlanPhase; course: PlanCourse }) {
  const [updateState, updateAction, updating] = useActionState<PlanFormState<PhaseField, PhaseDetails>, FormData>(updatePhaseAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<PlanFormState, FormData>(deletePhaseAction, {});
  const ids = { semester: useId(), type: useId(), error: useId() };
  const published = course.state === "PUBLISHED";
  const values = updateState.values;
  return <li><Disclosure group={`phase-${course.id}`} hint="Bearbeiten"
    summary={<>{phaseTypeLabel(phase.type)} · {formatCalendarPeriod(phase.startDate, phase.endDate)}</>}>
    <form action={updateAction} className="account-form">
      <input type="hidden" name="phaseId" value={phase.id} />
      {updateState.error ? <p id={ids.error} role="alert">{updateState.error}</p> : null}
      {updateState.success ? <p role="status">{updateState.success}</p> : null}
      <label htmlFor={ids.semester}>Semester</label>
      <select id={ids.semester} name="semester" defaultValue={values?.semester ?? String(phase.semester)} required aria-invalid={updateState.field === "semester" || undefined} aria-describedby={updateState.field === "semester" ? ids.error : undefined}>
        {Array.from({ length: course.semesters }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
      </select>
      <label htmlFor={ids.type}>Phasentyp</label>
      <select id={ids.type} name="type" defaultValue={values?.type ?? phase.type} required aria-invalid={updateState.field === "type" || undefined} aria-describedby={updateState.field === "type" ? ids.error : undefined}>{phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
      <DateField label="Startdatum" name="startDate" required defaultValue={values?.startDate ?? phase.startDate} invalid={updateState.field === "startDate"} errorId={ids.error} />
      <DateField label="Enddatum" name="endDate" required defaultValue={values?.endDate ?? phase.endDate} invalid={updateState.field === "endDate"} errorId={ids.error} />
      {published
        ? <ConfirmAction openLabel="Kursphase prüfen" heading="Öffentliche Kursphase ändern"
            consequence={`Die Kursphase von ${course.code} wird geändert.`}
            preview={(formData) => <><ul>
                <li>Semester: {phase.semester} → {String(formData.get("semester") ?? "")}</li>
                <li>Phasentyp: {phaseTypeLabel(phase.type)} → {phaseTypes.find((type) => type.value === formData.get("type"))?.label ?? String(formData.get("type") ?? "")}</li>
                <li>Zeitraum: {phase.startDate} bis {phase.endDate} → {String(formData.get("startDate") ?? "")} bis {String(formData.get("endDate") ?? "")}</li>
              </ul>
              <p>Angrenzende Phasengrenzen werden in derselben Transaktion mitverschoben. Nach erfolgreicher Gesamtprüfung ist die Änderung unmittelbar öffentlich sichtbar.</p></>}
            confirmLabel="Änderung speichern und veröffentlichen" pendingLabel="Wird gespeichert …" isPending={updating} />
        : <button className="button" type="submit" disabled={updating}>{updating ? "Wird gespeichert …" : "Kursphase speichern"}</button>}
    </form>
    {published
      ? <p className="notice">Einzelne Phasen können im veröffentlichten, lückenlosen Verlauf nicht gelöscht werden. Ihre Grenzen können oben atomar verschoben werden.</p>
      : <form action={deleteAction} className="account-form">
        <input type="hidden" name="phaseId" value={phase.id} />
        {deleteState.error ? <p role="alert">{deleteState.error}</p> : null}
        {deleteState.success ? <p role="status">{deleteState.success}</p> : null}
        <ConfirmAction openLabel="Kursphase löschen" heading="Kursphase löschen"
          consequence={`Die Kursphase von ${course.code} wird aus dem Planungsstand gelöscht.`}
          confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={deleting} danger />
      </form>}
  </Disclosure></li>;
}

function EventCreateForm({ course, transferTargets }: { course: PlanCourse; transferTargets: PlanCourse[] }) {
  const [state, action, pending] = useActionState<PlanFormState<EventField, EventInput>, FormData>(createEventAction, {});
  const ids = { title: useId(), category: useId(), error: useId() };
  const values = state.values;
  const published = course.state === "PUBLISHED";
  return <form action={action} className="account-form">
    <input type="hidden" name="courseId" value={course.id} />
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
    <TransferChoices courses={transferTargets} subject="ein eigenständiger Termin" />
    {published || transferTargets.length
      ? <ConfirmAction openLabel="Termin prüfen" heading="Prüfungsrelevanten Termin speichern"
          consequence="Der Termin wird gespeichert. Für veröffentlichte Kurse ist er anschließend unmittelbar öffentlich sichtbar."
          shouldConfirm={(formData) => published || formData.getAll("transferCourseId").length > 0}
          preview={(formData) => {
            const codes = transferCodes(formData, transferTargets);
            const publishedCodes = [published ? course.code : "", ...transferTargets.filter((target) => target.state === "PUBLISHED" && codes.includes(target.code)).map((target) => target.code)].filter(Boolean);
            return <><p><strong>Betroffene Kurse:</strong> {[course.code, ...codes].join(", ")}</p>
              <p><strong>Termin:</strong> {String(formData.get("title") ?? "")} · {String(formData.get("startDate") ?? "")}{formData.get("endDate") ? ` bis ${String(formData.get("endDate"))}` : ""}</p>
              {codes.length ? <p>Je Kurs entsteht ein eigenständiger Termin. Spätere Änderungen wirken jeweils nur auf den betreffenden Kurs.</p> : null}
              {publishedCodes.length ? <p>Bei {publishedCodes.join(", ")} ist der Termin nach erfolgreicher Prüfung unmittelbar öffentlich sichtbar.</p> : null}</>;
          }}
          confirmLabel="Termin speichern" pendingLabel="Wird gespeichert …" isPending={pending} />
      : <button className="button" type="submit" disabled={pending}>{pending ? "Wird gespeichert …" : "Termin speichern"}</button>}
  </form>;
}

function EventRowEditor({ event, course }: { event: PlanEvent; course: PlanCourse }) {
  const [updateState, updateAction, updating] = useActionState<PlanFormState<EventField, Omit<EventInput, "courseIds">>, FormData>(updateEventAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<PlanFormState, FormData>(deleteEventAction, {});
  const ids = { title: useId(), category: useId(), error: useId() };
  const published = course.state === "PUBLISHED";
  const values = updateState.values;
  return <li><Disclosure group={`event-${course.id}`} hint="Bearbeiten"
    summary={<><strong>{event.title}</strong> · {eventCategoryLabel(event.category)} · {formatCalendarPeriod(event.startDate, event.endDate ?? event.startDate)}{event.provisional ? " · vorläufig" : ""}</>}>
    <form action={updateAction} className="account-form">
      <input type="hidden" name="eventId" value={event.id} />
      {updateState.error ? <p id={ids.error} role="alert">{updateState.error}</p> : null}
      {updateState.success ? <p role="status">{updateState.success}</p> : null}
      <label htmlFor={ids.title}>Titel</label>
      <input id={ids.title} name="title" type="text" required maxLength={160} defaultValue={values?.title ?? event.title} aria-invalid={updateState.field === "title" || undefined} aria-describedby={updateState.field === "title" ? ids.error : undefined} />
      <label>Beschreibung (optional)<textarea name="description" rows={3} maxLength={2000} defaultValue={values?.description ?? event.description ?? ""} /></label>
      <label htmlFor={ids.category}>Kategorie</label>
      <select id={ids.category} name="category" required defaultValue={values?.category ?? event.category} aria-invalid={updateState.field === "category" || undefined} aria-describedby={updateState.field === "category" ? ids.error : undefined}>{eventCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
      <DateField label="Startdatum" name="startDate" required defaultValue={values?.startDate ?? event.startDate} invalid={updateState.field === "startDate"} errorId={ids.error} />
      <DateField label="Enddatum (optional)" name="endDate" defaultValue={values?.endDate ?? event.endDate ?? ""} invalid={updateState.field === "endDate"} errorId={ids.error} />
      <label className="account-check"><input type="checkbox" name="provisional" defaultChecked={values?.provisional ?? event.provisional} /> Zeitangabe ist vorläufig</label>
      {published
        ? <ConfirmAction openLabel="Termin prüfen" heading="Öffentlichen Termin ändern"
            consequence={`Der Termin von ${course.code} wird geändert.`}
            preview={(formData) => <><ul>
                <li>Titel: {event.title} → {String(formData.get("title") ?? "")}</li>
                <li>Kategorie: {eventCategoryLabel(event.category)} → {eventCategories.find((category) => category.value === formData.get("category"))?.label ?? String(formData.get("category") ?? "")}</li>
                <li>Zeitraum: {event.startDate}{event.endDate ? ` bis ${event.endDate}` : ""} → {String(formData.get("startDate") ?? "")}{formData.get("endDate") ? ` bis ${String(formData.get("endDate"))}` : ""}</li>
              </ul>
              <p>Nach erfolgreicher Prüfung ist die Änderung unmittelbar öffentlich sichtbar.</p></>}
            confirmLabel="Änderung speichern und veröffentlichen" pendingLabel="Wird gespeichert …" isPending={updating} />
        : <button className="button" type="submit" disabled={updating}>{updating ? "Wird gespeichert …" : "Termin speichern"}</button>}
    </form>
    <form action={deleteAction} className="account-form">
      <input type="hidden" name="eventId" value={event.id} />
      {deleteState.error ? <p role="alert">{deleteState.error}</p> : null}
      {deleteState.success ? <p role="status">{deleteState.success}</p> : null}
      <ConfirmAction openLabel="Termin löschen" heading="Termin löschen"
        consequence={`Der Termin von ${course.code} wird gelöscht.${published ? " Die Löschung ist nach erfolgreicher Prüfung unmittelbar öffentlich sichtbar." : ""}`}
        confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={deleting} danger />
    </form>
  </Disclosure></li>;
}

/**
 * The course phases of the edited course, under the same heading as the matrix that draws them: the matrix shows every
 * course of the comparison, this list is the one course that is written to. It follows the semesters of that course
 * rather than running through in one length, so it is divided the way the matrix is divided into row groups and a
 * semester without a phase says so instead of being missing (BARRIEREFREIHEIT.md, „Semester-Navigation“).
 */
export function CoursePhaseEditor({ course, comparison, phases }: { course: PlanCourse; comparison: PlanCourse[]; phases: PlanPhase[] }) {
  const ownPhases = phases.filter((phase) => phase.courseId === course.id);
  /* A phase transfer is only offered where every phase valid for this course is valid for the target as well: same
     number of semesters and the same study period. Which dates are about to be entered is not known while the target
     is being offered, so the condition is on the courses rather than on the entry — a target the domain would refuse
     must not be offerable, because its refusal takes the whole transaction down, this course included. Study programs
     of the same length but a different study period do occur once the comparison reaches beyond the own study program. */
  const transferTargets = comparison.filter((candidate) => candidate.editable && candidate.state === "UNPUBLISHED"
    && candidate.semesters === course.semesters && candidate.studyStart === course.studyStart && candidate.studyEnd === course.studyEnd);
  // A course one may write to but not transfer into would otherwise simply be missing from the choices, leaving the
  // reason to be guessed. It is named instead, with the property that rules it out.
  const excludedTargets = comparison.filter((candidate) => candidate.editable && candidate.state === "UNPUBLISHED" && !transferTargets.includes(candidate));

  return <div className="plan-block">
    <h3>Kursphasen von {course.code}</h3>
    <p className="plan-block__note">Jede Speicherung ist eine einzelne Operation. Es gibt kein automatisches Speichern.</p>
    {Array.from({ length: course.semesters }, (_, index) => index + 1).map((semester) => {
      const semesterPhases = ownPhases.filter((phase) => phase.semester === semester);
      return <section key={semester} className="semester-group" aria-labelledby={`semester-${course.id}-${semester}`}>
        <h4 id={`semester-${course.id}-${semester}`}>Semester {semester}</h4>
        {semesterPhases.length
          ? <ul className="entry-list">{semesterPhases.map((phase) => <PhaseRowEditor key={phase.id} phase={phase} course={course} />)}</ul>
          : <p className="empty-note">Für dieses Semester ist keine Kursphase gespeichert.</p>}
      </section>;
    })}
    {course.state === "UNPUBLISHED"
      ? <div className="plan-block__create">
        {/* Only where phases are actually created: a published course offers no transfer to explain a limit of. */}
        {excludedTargets.length ? <p className="notice">
          Nicht als Übertragungsziel wählbar: {excludedTargets.map((candidate) => candidate.code).join(", ")}. Übertragen wird nur auf Kurse mit derselben Semesterzahl und demselben Studienzeitraum, weil eine dort abgewiesene Kursphase auch diesen Kurs nicht speichern würde.
        </p> : null}
        <Disclosure group={`phase-${course.id}`} summary="Kursphase ergänzen">
          <PhaseCreateForm course={course} transferTargets={transferTargets} />
        </Disclosure>
      </div>
      : <p className="empty-note">In veröffentlichten Kursen werden keine einzelnen Phasen ergänzt. Verschieben Sie stattdessen eine vorhandene Phasengrenze; angrenzende Phasen werden atomar angepasst.</p>}
  </div>;
}

/**
 * The examination-relevant dates of the edited course, under the same heading as the chronological table that shows
 * them together with those of the compared courses. Unlike course phases they hang on no semester structure, so they
 * stand in one chronological list.
 */
export function CourseEventEditor({ course, comparison, events }: { course: PlanCourse; comparison: PlanCourse[]; events: PlanEvent[] }) {
  const ownEvents = events.filter((event) => event.courseIds.includes(course.id));
  const transferTargets = comparison.filter((candidate) => candidate.editable);

  return <div className="plan-block">
    <h3>Termine von {course.code}</h3>
    {ownEvents.length
      ? <ul className="entry-list">{ownEvents.map((event) => <EventRowEditor key={event.id} event={event} course={course} />)}</ul>
      : <p className="empty-note">Für {course.code} ist noch kein prüfungsrelevanter Termin gespeichert.</p>}
    <div className="plan-block__create">
      <Disclosure group={`event-${course.id}`} summary="Termin erfassen">
        <EventCreateForm course={course} transferTargets={transferTargets} />
      </Disclosure>
    </div>
  </div>;
}
