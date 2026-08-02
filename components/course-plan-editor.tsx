"use client";

import { useActionState, useId } from "react";

import {
  type PlanFormState,
  createEventAction,
  createPhaseAction,
  deleteEventAction,
  deletePhaseAction,
  updateEventAction,
  updatePhaseAction,
} from "@/app/intern/kurse/[courseId]/plan/actions";
// A type-only import: the module is server-only and is erased here rather than pulled into the client bundle.
import type { PlanCourse } from "@/app/intern/kurse/data";
import { DateField } from "@/components/date-field";
import { ConfirmAction } from "@/components/editor-controls";
import { PlanMatrix } from "@/components/plan-matrix";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { areaAccessLabel, workInProgressLabel } from "@/lib/domain/course-status";
import { eventCategories, eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import { validatePublication, type PlanEvent, type PlanPhase } from "@/lib/domain/publication";
import type { EventField, EventInput } from "@/lib/services/event-admin";
import type { PhaseDetails, PhaseField, PhaseInput } from "@/lib/services/phase-admin";

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
  const header = <p><strong>Semester {phase.semester}</strong> · {phaseTypeLabel(phase.type)} · {formatCalendarPeriod(phase.startDate, phase.endDate)}</p>;
  if (!course.editable) return <li className="editor-card">{header}</li>;
  return <li className="editor-card">
    {header}
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
  </li>;
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
  const header = <p><strong>{event.title}</strong> · {eventCategoryLabel(event.category)} · {formatCalendarPeriod(event.startDate, event.endDate ?? event.startDate)}{event.provisional ? " · vorläufig" : ""}</p>;
  if (!course.editable) return <li className="editor-card">{header}</li>;
  return <li className="editor-card">
    {header}
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
  </li>;
}

/** The open points of one course, listed for the edited course and counted for every course it is compared with. */
function courseIssues(course: PlanCourse, phases: PlanPhase[], events: PlanEvent[]) {
  return validatePublication({
    course,
    phases: phases.filter((phase) => phase.courseId === course.id),
    events: events.filter((event) => event.courseIds.includes(course.id)),
  });
}

function ComparisonStanding({ course, phases, events }: { course: PlanCourse; phases: PlanPhase[]; events: PlanEvent[] }) {
  const issues = courseIssues(course, phases, events);
  return <li>
    <strong>{course.code}</strong> · {course.program} · {areaAccessLabel(course.editable)}{course.workInProgress ? ` · ${workInProgressLabel}` : ""}
    {" · "}{issues.length ? `${issues.length === 1 ? "1 offener Punkt" : `${issues.length} offene Punkte`}` : "Planungsstand ist vollständig"}
  </li>;
}

/**
 * One course with everything that is written to it, and beside it the courses it is compared with — read only, however
 * the account is permitted, because the comparison exists to be seen while planning and not to be planned in.
 */
export function CoursePlanEditor({ course, comparison, phases, events }: {
  course: PlanCourse;
  comparison: PlanCourse[];
  phases: PlanPhase[];
  events: PlanEvent[];
}) {
  const courses = [course, ...comparison];
  const ownPhases = phases.filter((phase) => phase.courseId === course.id);
  const ownEvents = events.filter((event) => event.courseIds.includes(course.id));
  const issues = courseIssues(course, phases, events);
  /* A phase transfer is only offered where every phase valid for this course is valid for the target as well: same
     number of semesters and the same study period. Which dates are about to be entered is not known while the target
     is being offered, so the condition is on the courses rather than on the entry — a target the domain would refuse
     must not be offerable, because its refusal takes the whole transaction down, this course included. Study programs
     of the same length but a different study period do occur once the comparison reaches beyond the own study program. */
  const phaseTargets = comparison.filter((candidate) => candidate.editable && candidate.state === "UNPUBLISHED"
    && candidate.semesters === course.semesters && candidate.studyStart === course.studyStart && candidate.studyEnd === course.studyEnd);
  // A course one may write to but not transfer into would otherwise simply be missing from the choices, leaving the
  // reason to be guessed. It is named instead, with the property that rules it out.
  const excludedTargets = comparison.filter((candidate) => candidate.editable && candidate.state === "UNPUBLISHED" && !phaseTargets.includes(candidate));
  const eventTargets = comparison.filter((candidate) => candidate.editable);

  return <>
    <section className="workspace-panel" aria-labelledby="standing-heading">
      <h2 id="standing-heading">Planungsstand</h2>
      {issues.length
        ? <><p>{issues.length === 1 ? "1 offener Punkt:" : `${issues.length} offene Punkte:`}</p>
          <ul className="issue-list">{issues.map((issue) => <li key={`${issue.code}-${issue.semester}-${issue.eventId}`}>{issue.message}</li>)}</ul></>
        : <p>Planungsstand ist vollständig.</p>}
      {comparison.length ? <>
        <h3>Verglichene Kurse</h3>
        <p>Diese Kurse stehen nur zum Vergleich daneben. Bearbeitet wird auf dieser Seite ausschließlich {course.code}.</p>
        <ul className="entry-list">{comparison.map((candidate) => <ComparisonStanding key={candidate.id} course={candidate} phases={phases} events={events} />)}</ul>
      </> : null}
    </section>
    <PlanMatrix courses={courses} phases={phases} events={events} primaryCourseId={course.id}
      workInProgressCourseIds={courses.filter((candidate) => candidate.workInProgress).map((candidate) => candidate.id)} />
    {/* The sections above show the comparison; from here on only the edited course is the subject, so its code is
        part of every heading. */}
    <section className="workspace-panel" aria-labelledby="phase-heading">
      <h2 id="phase-heading">Kursphasen von {course.code}</h2>
      {course.editable ? <>
        <p>Jede Speicherung ist eine einzelne Operation. Es gibt kein automatisches Speichern.</p>
        {course.state === "UNPUBLISHED"
          ? <>
            {/* Only where phases are actually created: a published course offers no transfer to explain a limit of. */}
            {excludedTargets.length ? <p className="notice">
              Nicht als Übertragungsziel wählbar: {excludedTargets.map((candidate) => candidate.code).join(", ")}. Übertragen wird nur auf Kurse mit derselben Semesterzahl und demselben Studienzeitraum, weil eine dort abgewiesene Kursphase auch diesen Kurs nicht speichern würde.
            </p> : null}
            <PhaseCreateForm course={course} transferTargets={phaseTargets} />
          </>
          : <p className="empty-note">In veröffentlichten Kursen werden keine einzelnen Phasen ergänzt. Verschieben Sie stattdessen eine vorhandene Phasengrenze; angrenzende Phasen werden atomar angepasst.</p>}
      </> : <p className="notice">Dieser Kurs gehört zum Bereich {course.areaName}, der Ihnen nicht zugeordnet ist. Sie können seinen Verlauf lesen, aber nicht ändern.</p>}
      {ownPhases.length ? <section aria-labelledby="phase-list-heading">
        <h3 id="phase-list-heading">Gespeicherte Kursphasen</h3>
        <ul className="entry-list">{ownPhases.map((phase) => <PhaseRowEditor key={phase.id} phase={phase} course={course} />)}</ul>
      </section> : <p className="empty-note">Für {course.code} ist noch keine Kursphase gespeichert.</p>}
    </section>
    <section className="workspace-panel" aria-labelledby="event-heading">
      <h2 id="event-heading">Prüfungsrelevante Termine von {course.code}</h2>
      {course.editable
        ? <EventCreateForm course={course} transferTargets={eventTargets} />
        : <p className="notice">Termine dieses Kurses können Sie lesen, aber nicht ändern.</p>}
      {ownEvents.length ? <section aria-labelledby="event-list-heading">
        <h3 id="event-list-heading">Gespeicherte Termine</h3>
        <ul className="entry-list">{ownEvents.map((event) => <EventRowEditor key={event.id} event={event} course={course} />)}</ul>
      </section> : <p className="empty-note">Für {course.code} ist noch kein prüfungsrelevanter Termin gespeichert.</p>}
    </section>
  </>;
}
