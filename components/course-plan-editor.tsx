"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";

import {
  type PlanFormState,
  createEventAction,
  createPhaseAction,
  deleteEventAction,
  deletePhaseAction,
  movePhaseChangeAction,
  updateEventAction,
  updatePhaseAction,
} from "@/app/intern/kurse/[courseId]/actions";
// A type-only import: the module is server-only and is erased here rather than pulled into the client bundle.
import type { PlanCourse } from "@/app/intern/kurse/data";
import { DateField } from "@/components/date-field";
import { ConfirmAction } from "@/components/editor-controls";
import { PlanTimeline } from "@/components/plan-timeline";
import { isCalendarDay, plusDays } from "@/lib/domain/calendar-day";
import { formatCalendarDay, formatCalendarPeriod, formatPeriodDuration } from "@/lib/domain/calendar-format";
import { coursePath, defaultComparisonScope } from "@/lib/domain/course-comparison";
import { buildCourseProgression, type PhaseJunction } from "@/lib/domain/course-progression";
import { eventCategories, eventCategoryLabel } from "@/lib/domain/event-category";
import { phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import { describeDeviations, type CourseDeviation } from "@/lib/domain/plan-comparison";
import { type PlanEvent, type PlanPhase } from "@/lib/domain/publication";
import type { EventField, EventInput } from "@/lib/services/event-admin";
import type { PhaseChangeField, PhaseDetails, PhaseField, PhaseInput } from "@/lib/services/phase-admin";

/**
 * The form that adds an entry, resting as a line until it is asked for. A native `details` carries the whole
 * behaviour: it is operable by keyboard without any script of ours and states its own expanded condition to assistive
 * technology. Closing hides the form without unmounting it, so anything already typed is still there when it is
 * opened again.
 */
function Disclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return <details className="disclosure">
    <summary><span className="disclosure__summary">{summary}</span></summary>
    <div className="disclosure__body">{children}</div>
  </details>;
}

/**
 * A day as a form submitted it, shown the way every other day of the page is written. A confirmation repeats what was
 * typed, and what was typed arrives as `JJJJ-MM-TT`; anything that is not a day is shown as it came.
 */
function shownDay(value: FormDataEntryValue | null): string {
  const day = String(value ?? "");
  return isCalendarDay(day) ? formatCalendarDay(day) : day;
}

/**
 * Which entry of the plan is open, and the way back to the line it was opened from. Only one is open at a time: the
 * page at rest is the plan, and editing adds exactly one form to it. Closing by the button of the form returns focus
 * to the control of that line, found by the attribute it carries rather than remembered — the list is rendered anew
 * after every save and the element that was clicked may no longer be the one that is there.
 */
function useOpenEntry() {
  const [open, setOpen] = useState<{ key: string; period: boolean } | null>(null);
  const panelId = useId();
  return {
    openKey: open?.key ?? null,
    /** Whether the open entry was asked for by its period, see `openWithPeriod`. */
    periodAsked: open?.period ?? false,
    panelId,
    toggle: (key: string) => setOpen((current) => (current?.key === key ? null : { key, period: false })),
    /**
     * Opens an entry by the period its line shows. Whoever aims at the dates means to change the dates, so the form
     * arrives with its period laid open — and an entry that is open already stays open and only lays it open, since
     * closing would be the opposite of what was asked for.
     */
    openWithPeriod: (key: string) => setOpen({ key, period: true }),
    close: () => {
      if (open) document.querySelector<HTMLElement>(`[data-entry="${CSS.escape(open.key)}"]`)?.focus();
      setOpen(null);
    },
  };
}
type OpenEntry = ReturnType<typeof useOpenEntry>;

/**
 * The way into the form of a line, set on what the line is about: the type of a phase, the title of a date, the day of
 * a change. It is written rather than drawn beside the entry — a column of tool buttons down the right edge would
 * give every line the same weight and turn the plan into a list of controls. The text shows at rest that it can be
 * activated, and the control covers its whole line, so the line is what is aimed at. `action` completes the name for
 * assistive technology, which hears the visible text first.
 */
function EntryControl({ entryKey, entry, action, periodAware, children }: { entryKey: string; entry: OpenEntry; action: string; periodAware?: boolean; children: ReactNode }) {
  const open = entry.openKey === entryKey;
  /* The control covers its whole line, the period included, so where the pointer came down is read from the event:
     within the period of the line it asks for the dates. Activated by keyboard the event carries no position and the
     entry opens the plain way. */
  function activate(event: MouseEvent<HTMLButtonElement>) {
    const period = periodAware ? event.currentTarget.closest(".plan-line")?.querySelector(".plan-line__when")?.getBoundingClientRect() : null;
    const onPeriod = period && event.detail > 0
      && event.clientX >= period.left && event.clientX <= period.right && event.clientY >= period.top && event.clientY <= period.bottom;
    if (onPeriod) entry.openWithPeriod(entryKey); else entry.toggle(entryKey);
  }
  return <button type="button" className="entry-action" data-entry={entryKey}
    aria-expanded={open} aria-controls={open ? entry.panelId : undefined} onClick={activate}>
    {children}<span className="sr-only">, {action}</span>
  </button>;
}

/**
 * The form of the entry being edited, directly below its line. It takes focus when it appears, so the keyboard
 * continues inside it rather than at the next line of the plan, and its heading names the entry in full.
 */
function EditPanel({ id, heading, onClose, children }: { id: string; heading: ReactNode; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const headingId = useId();
  useEffect(() => { panel.current?.focus(); }, []);
  return <section ref={panel} id={id} className="edit-panel" tabIndex={-1} aria-labelledby={headingId}>
    <div className="edit-panel__head">
      <h4 id={headingId}>{heading}</h4>
      <button type="button" className="button button--ghost" onClick={onClose}>Schließen</button>
    </div>
    {children}
  </section>;
}

/**
 * What is said once the open entry is gone — deleted here a moment ago, as a rule. The form went with the entry and
 * took its own confirmation along, so the outcome is said here, and it takes the focus the vanished form held instead
 * of letting it fall back to the top of the page.
 */
function EntryGone({ id, children }: { id: string; children: ReactNode }) {
  const note = useRef<HTMLParagraphElement>(null);
  useEffect(() => { note.current?.focus(); }, []);
  return <p ref={note} id={id} className="edit-panel__gone" role="status" tabIndex={-1}>{children}</p>;
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

/**
 * `periodOpen` shows the period right away. Between two adjoining phases the day is moved as the change they share,
 * on the line between them, so the period rests closed here — offered twice it would be two ways to the same date.
 * It opens where no such line exists: at the start of the first phase, the end of the last, and beside a gap or an
 * overlap, where the phase itself is the only place its dates can be corrected. `periodAsked` lays it open as well:
 * the form was opened by the period of its line, and the note inside then says where the day is moved as a rule.
 */
function PhaseEditForm({ phase, course, periodOpen, periodAsked }: { phase: PlanPhase; course: PlanCourse; periodOpen: boolean; periodAsked: boolean }) {
  const [updateState, updateAction, updating] = useActionState<PlanFormState<PhaseField, PhaseDetails>, FormData>(updatePhaseAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<PlanFormState, FormData>(deletePhaseAction, {});
  const ids = { semester: useId(), type: useId(), error: useId() };
  const published = course.state === "PUBLISHED";
  const values = updateState.values;
  return <>
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
      {/* Closed, the fields stay in the form and are submitted unchanged. A field emptied and then closed away would
          stop the browser from submitting without anything to show for it — it cannot point at a control that is not
          displayed. The section therefore opens the moment one of its fields is found invalid, which is before the
          browser looks for the control to focus and to hang its message on. */}
      <details className="form-more" onInvalidCapture={(event) => { event.currentTarget.open = true; }} open={periodOpen || periodAsked || updateState.field === "startDate" || updateState.field === "endDate" || undefined}>
        <summary>Zeitraum ändern</summary>
        <div className="account-form">
          {periodOpen ? null : <p className="field-hint">Den Wechsel zur Nachbarphase verschieben Sie in der Zeile zwischen den beiden Kursphasen.</p>}
          <DateField label="Startdatum" name="startDate" required defaultValue={values?.startDate ?? phase.startDate} invalid={updateState.field === "startDate"} errorId={ids.error} />
          <DateField label="Enddatum" name="endDate" required defaultValue={values?.endDate ?? phase.endDate} invalid={updateState.field === "endDate"} errorId={ids.error} />
        </div>
      </details>
      {published
        ? <ConfirmAction openLabel="Kursphase prüfen" heading="Öffentliche Kursphase ändern"
            consequence={`Die Kursphase von ${course.code} wird geändert.`}
            preview={(formData) => <><ul>
                <li>Semester: {phase.semester} → {String(formData.get("semester") ?? "")}</li>
                <li>Phasentyp: {phaseTypeLabel(phase.type)} → {phaseTypes.find((type) => type.value === formData.get("type"))?.label ?? String(formData.get("type") ?? "")}</li>
                <li>Zeitraum: {formatCalendarPeriod(phase.startDate, phase.endDate)} → {shownDay(formData.get("startDate"))} – {shownDay(formData.get("endDate"))}</li>
              </ul>
              <p>Die angrenzenden Kursphasen werden mitverschoben, damit keine Lücke entsteht. Die Änderung ist sofort öffentlich sichtbar.</p></>}
            confirmLabel="Änderung speichern und veröffentlichen" pendingLabel="Wird gespeichert …" isPending={updating} />
        : <button className="button" type="submit" disabled={updating}>{updating ? "Wird gespeichert …" : "Kursphase speichern"}</button>}
    </form>
    {published
      ? <p className="notice">In einem veröffentlichten Kurs kann keine einzelne Kursphase gelöscht werden. Verschieben Sie stattdessen den Wechsel zur Nachbarphase.</p>
      : <form action={deleteAction} className="account-form">
        <input type="hidden" name="phaseId" value={phase.id} />
        {deleteState.error ? <p role="alert">{deleteState.error}</p> : null}
        {deleteState.success ? <p role="status">{deleteState.success}</p> : null}
        <ConfirmAction openLabel="Kursphase löschen" heading="Kursphase löschen"
          consequence={`Die Kursphase von ${course.code} wird aus dem Planungsstand gelöscht.`}
          confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={deleting} danger />
      </form>}
  </>;
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
              <p><strong>Termin:</strong> {String(formData.get("title") ?? "")} · {shownDay(formData.get("startDate"))}{formData.get("endDate") ? ` – ${shownDay(formData.get("endDate"))}` : ""}</p>
              {codes.length ? <p>Je Kurs entsteht ein eigenständiger Termin. Spätere Änderungen wirken jeweils nur auf den betreffenden Kurs.</p> : null}
              {publishedCodes.length ? <p>Bei {publishedCodes.join(", ")} ist der Termin nach erfolgreicher Prüfung unmittelbar öffentlich sichtbar.</p> : null}</>;
          }}
          confirmLabel="Termin speichern" pendingLabel="Wird gespeichert …" isPending={pending} />
      : <button className="button" type="submit" disabled={pending}>{pending ? "Wird gespeichert …" : "Termin speichern"}</button>}
  </form>;
}

function EventEditForm({ event, course }: { event: PlanEvent; course: PlanCourse }) {
  const [updateState, updateAction, updating] = useActionState<PlanFormState<EventField, Omit<EventInput, "courseIds">>, FormData>(updateEventAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<PlanFormState, FormData>(deleteEventAction, {});
  const ids = { title: useId(), category: useId(), error: useId() };
  const published = course.state === "PUBLISHED";
  const values = updateState.values;
  return <>
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
                <li>Zeitraum: {formatCalendarPeriod(event.startDate, event.endDate ?? event.startDate)} → {shownDay(formData.get("startDate"))}{formData.get("endDate") ? ` – ${shownDay(formData.get("endDate"))}` : ""}</li>
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
  </>;
}

/**
 * Moving the day a course changes over from one phase to the next: one date instead of the end of one phase and the
 * start of the other. The two cannot drift apart this way, so the commonest correction of a plan can leave neither a
 * gap nor an overlap behind.
 */
function PhaseChangeForm({ earlier, later, course }: { earlier: PlanPhase; later: PlanPhase; course: PlanCourse }) {
  const [state, action, pending] = useActionState<PlanFormState<PhaseChangeField, { date: string }>, FormData>(movePhaseChangeAction, {});
  const errorId = useId();
  const published = course.state === "PUBLISHED";
  return <form action={action} className="account-form">
    <input type="hidden" name="earlierPhaseId" value={earlier.id} />
    <input type="hidden" name="laterPhaseId" value={later.id} />
    {state.error ? <p id={errorId} role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <DateField label={`Erster Tag der folgenden Kursphase (${phaseTypeLabel(later.type)})`} name="date" required
      defaultValue={state.values?.date ?? later.startDate} invalid={state.field === "date"} errorId={errorId}
      hint={`Die vorherige Kursphase (${phaseTypeLabel(earlier.type)}) endet am Tag davor.`} />
    {published
      ? <ConfirmAction openLabel="Wechsel prüfen" heading="Öffentlichen Wechsel verschieben"
          consequence={`Der Wechsel von ${course.code} wird verschoben.`}
          preview={(formData) => {
            const day = String(formData.get("date") ?? "");
            return <><ul>
                <li>Wechsel: {formatCalendarDay(later.startDate)} → {shownDay(day)}</li>
                {isCalendarDay(day) ? <li>{phaseTypeLabel(earlier.type)} endet am {formatCalendarDay(plusDays(day, -1))}, {phaseTypeLabel(later.type)} beginnt am {formatCalendarDay(day)}.</li> : null}
              </ul>
              <p>Die Änderung ist sofort öffentlich sichtbar.</p></>;
          }}
          confirmLabel="Änderung speichern und veröffentlichen" pendingLabel="Wird gespeichert …" isPending={pending} />
      : <button className="button" type="submit" disabled={pending}>{pending ? "Wird gespeichert …" : "Wechsel speichern"}</button>}
  </form>;
}

/** „Semester 1, 2 und 4“ — the semesters a sentence names, joined the way they are read out. */
function semesterList(semesters: number[]): string {
  if (semesters.length < 2) return `Semester ${semesters.join("")}`;
  return `Semester ${semesters.slice(0, -1).join(", ")} und ${semesters.at(-1)}`;
}

/**
 * What the parallel courses do differently, said once above the plan. The plan below belongs to one course; the others
 * are not drawn beside it again — where they agree there is nothing to look at, and where they do not, the semester
 * concerned says how. The full side-by-side stands in the comparison view, which this leads to.
 */
function DeviationSummary({ course, deviations }: { course: PlanCourse; deviations: CourseDeviation[] }) {
  if (!deviations.length) return null;
  return <div className="plan-compare">
    <ul>{deviations.map((deviation) => {
      const eventParts = [
        deviation.eventsOnlyHere ? `${deviation.eventsOnlyHere} ${deviation.eventsOnlyHere === 1 ? "Termin" : "Termine"} nur bei ${course.code}` : "",
        deviation.eventsOnlyThere ? `${deviation.eventsOnlyThere} nur bei ${deviation.code}` : "",
      ].filter(Boolean);
      const parts = [
        deviation.semesters.length ? `anderer Kursverlauf in ${semesterList(deviation.semesters.map((entry) => entry.semester))}` : "",
        eventParts.length ? `andere Termine (${eventParts.join(", ")})` : "",
      ].filter(Boolean);
      return <li key={deviation.courseId}><strong>{deviation.code}</strong>: {parts.length ? parts.join("; ") : "gleicher Kursverlauf, gleiche Termine"}.</li>;
    })}</ul>
    <Link className="text-link" href={coursePath(course.id, defaultComparisonScope)}>Nebeneinander vergleichen</Link>
  </div>;
}

function junctionText(junction: Exclude<PhaseJunction, { kind: "change" }>): string {
  const days = junction.days === 1 ? "1 Tag" : `${junction.days} Tage`;
  const period = formatCalendarPeriod(junction.startDate, junction.endDate);
  return junction.kind === "gap"
    ? `Lücke: ${period} (${days}) gehört zu keiner Kursphase.`
    : `Überschneidung: ${period} (${days}) gehört zu zwei Kursphasen.`;
}

function EventLine({ event, course, entry }: { event: PlanEvent; course: PlanCourse; entry: OpenEntry }) {
  const key = `event:${event.id}`;
  const period = formatCalendarPeriod(event.startDate, event.endDate ?? event.startDate);
  return <li className="plan-event">
    <div className="plan-line">
      <span className="plan-line__when">{period}</span>
      <span className="plan-line__what">
        {course.editable
          ? <EntryControl entryKey={key} entry={entry} action={`${period}, Termin bearbeiten`}>{event.title}</EntryControl>
          : <strong>{event.title}</strong>} <span className="plan-event__category">{eventCategoryLabel(event.category)}</span>
        {event.provisional ? <span className="provisional">Vorläufig</span> : null}
        {event.description ? <span className="plan-event__description">{event.description}</span> : null}
      </span>
    </div>
    {course.editable && entry.openKey === key
      ? <EditPanel id={entry.panelId} onClose={entry.close} heading={<>Termin bearbeiten: {event.title} · {period}</>}>
        <EventEditForm event={event} course={course} />
      </EditPanel> : null}
  </li>;
}

/**
 * The planning state of one course as one chronological reading: its semesters, in each the phases, in each phase the
 * dates that begin there, and between two phases the day the course changes over. Every line is at once the entry and
 * the way into editing it — through the word it is about, with no tool beside it — and the form opens directly below.
 *
 * The parallel courses of the study program are not drawn beside it. They are told apart only where they differ —
 * once in a summary above the plan and again in the semester concerned — and stand in full in the comparison view.
 */
export function CoursePlanWorkspace({ course, parallels, phases, events }: { course: PlanCourse; parallels: PlanCourse[]; phases: PlanPhase[]; events: PlanEvent[] }) {
  const entry = useOpenEntry();
  const progression = buildCourseProgression(course, phases, events);
  const deviations = describeDeviations(course, parallels, phases, events);
  const ownPhases = phases.filter((phase) => phase.courseId === course.id);
  const published = course.state === "PUBLISHED";
  /* A phase transfer is only offered where every phase valid for this course is valid for the target as well: same
     number of semesters and the same study period. Which dates are about to be entered is not known while the target
     is being offered, so the condition is on the courses rather than on the entry — a target the domain would refuse
     must not be offerable, because its refusal takes the whole transaction down, this course included. */
  const phaseTargets = parallels.filter((candidate) => candidate.editable && candidate.state === "UNPUBLISHED"
    && candidate.semesters === course.semesters && candidate.studyStart === course.studyStart && candidate.studyEnd === course.studyEnd);
  // A course one may write to but not transfer into would otherwise simply be missing from the choices, leaving the
  // reason to be guessed. It is named instead, with the property that rules it out.
  const excludedTargets = parallels.filter((candidate) => candidate.editable && candidate.state === "UNPUBLISHED" && !phaseTargets.includes(candidate));
  const eventTargets = parallels.filter((candidate) => candidate.editable);

  // The phases a change leads into: together with a change after it, such a phase has both of its days on a line of their own.
  const changeBefore = new Set(progression.semesters.flatMap((semester) => semester.phases)
    .filter((line) => line.junction?.kind === "change" && line.next).map((line) => line.next!.id));
  const openKeys = new Set<string>();
  for (const semester of progression.semesters) for (const line of semester.phases) {
    openKeys.add(`phase:${line.phase.id}`);
    if (line.junction?.kind === "change" && line.next) openKeys.add(`change:${line.next.id}`);
    for (const event of line.events) openKeys.add(`event:${event.id}`);
  }
  for (const event of progression.unplacedEvents) openKeys.add(`event:${event.id}`);
  const gone = course.editable && entry.openKey && !openKeys.has(entry.openKey) ? entry.openKey : null;

  return <section className="course-plan" aria-labelledby="plan-heading">
    <h2 id="plan-heading" className="eyebrow">Kursverlauf und Termine</h2>
    {/* A dotted line under a word is also how a page marks a term it explains. Said once, it is read as what it is here. */}
    {course.editable ? <p className="course-plan__hint">Gepunktet unterstrichene Angaben lassen sich bearbeiten.</p> : null}
    {/* The diagram carries its statement through area, length and position, so it stays hidden from assistive
        technology: the list below holds the same plan in words and with its dates (BARRIEREFREIHEIT.md). */}
    {ownPhases.length ? <div className="plan-overview" aria-hidden="true"><PlanTimeline courses={[course]} phases={ownPhases} /></div> : null}
    <DeviationSummary course={course} deviations={deviations} />
    {gone ? <EntryGone key={gone} id={entry.panelId}>{gone.startsWith("event:") ? "Der Termin wurde gelöscht." : "Die Kursphase wurde gelöscht."}</EntryGone> : null}

    {progression.semesters.map(({ semester, phases: lines }) => {
      const different = deviations.flatMap((deviation) => deviation.semesters.filter((entry) => entry.semester === semester).map((entry) => ({ code: deviation.code, phases: entry.phases })));
      return <section key={semester} className="plan-semester" aria-labelledby={`plan-semester-${semester}`}>
        <h3 id={`plan-semester-${semester}`}>Semester {semester}</h3>
        {different.map((other) => <p key={other.code} className="plan-deviation">
          <strong>{other.code}</strong> läuft hier anders: {other.phases.length
            ? other.phases.map((phase) => `${phaseTypeLabel(phase.type)} ${formatCalendarPeriod(phase.startDate, phase.endDate)}`).join(" · ")
            : "keine Kursphase gespeichert"}
        </p>)}
        {lines.length ? <ol className="plan-entries">{lines.map(({ phase, events: phaseEvents, junction, next }) => {
          const key = `phase:${phase.id}`;
          const period = formatCalendarPeriod(phase.startDate, phase.endDate);
          const changeKey = next ? `change:${next.id}` : "";
          return <li key={phase.id}>
            <div className="plan-phase" data-phase={phase.type === "THEORY" ? "theory" : "practice"}>
              <div className="plan-line">
                <span className="plan-line__when">{period}</span>
                <span className="plan-line__what">
                  {course.editable
                    ? <EntryControl entryKey={key} entry={entry} periodAware action={`${period}, Kursphase bearbeiten`}>{phaseTypeLabel(phase.type)}</EntryControl>
                    : <strong>{phaseTypeLabel(phase.type)}</strong>} <span className="plan-phase__duration">{formatPeriodDuration(phase.startDate, phase.endDate)}</span>
                </span>
              </div>
              {course.editable && entry.openKey === key
                ? <EditPanel id={entry.panelId} onClose={entry.close} heading={<>Kursphase bearbeiten: {phaseTypeLabel(phase.type)} · {period}</>}>
                  <PhaseEditForm phase={phase} course={course} periodOpen={!(changeBefore.has(phase.id) && junction?.kind === "change")} periodAsked={entry.periodAsked} />
                </EditPanel> : null}
              {phaseEvents.length ? <ul className="plan-events">{phaseEvents.map((event) => <EventLine key={event.id} event={event} course={course} entry={entry} />)}</ul> : null}
            </div>
            {/* What lies between this phase and the next: the day of the change as the one thing to move, or — where
                the two do not adjoin — what is wrong there, which is corrected at the phases themselves. */}
            {junction && next ? <div className="plan-junction" data-kind={junction.kind}>
              {junction.kind === "change" ? <>
                <div className="plan-line">
                  <span className="plan-junction__text">{next.semester !== phase.semester ? "Semesterwechsel" : "Wechsel"} am {course.editable
                    ? <EntryControl entryKey={changeKey} entry={entry} action={`Wechsel von ${phaseTypeLabel(phase.type)} zu ${phaseTypeLabel(next.type)} verschieben`}>{formatCalendarDay(junction.date, { weekday: true })}</EntryControl>
                    : formatCalendarDay(junction.date, { weekday: true })}</span>
                </div>
                {course.editable && entry.openKey === changeKey
                  ? <EditPanel id={entry.panelId} onClose={entry.close}
                      heading={<>Wechsel verschieben: von {phaseTypeLabel(phase.type)} zu {phaseTypeLabel(next.type)} am {formatCalendarDay(junction.date)}</>}>
                    <PhaseChangeForm earlier={phase} later={next} course={course} />
                  </EditPanel> : null}
              </> : <p className="plan-junction__issue">{junctionText(junction)}</p>}
            </div> : null}
          </li>;
        })}</ol> : <p className="empty-note">Für dieses Semester ist keine Kursphase gespeichert.</p>}
      </section>;
    })}

    {progression.unplacedEvents.length ? <section className="plan-semester" aria-labelledby="plan-unplaced">
      <h3 id="plan-unplaced">Termine außerhalb der Kursphasen</h3>
      <ul className="plan-events plan-events--unplaced">{progression.unplacedEvents.map((event) => <EventLine key={event.id} event={event} course={course} entry={entry} />)}</ul>
    </section> : null}

    {course.editable ? <div className="plan-create">
      {published
        ? <p className="plan-create__note">In einem veröffentlichten Kurs werden keine Kursphasen ergänzt oder gelöscht. Verschieben Sie stattdessen einen Wechsel.</p>
        : <>
          {excludedTargets.length ? <p className="notice">
            Nicht als Übertragungsziel wählbar: {excludedTargets.map((candidate) => candidate.code).join(", ")}. Übertragen wird nur auf Kurse mit derselben Semesterzahl und demselben Studienzeitraum.
          </p> : null}
          <Disclosure summary="Kursphase ergänzen">
            <PhaseCreateForm course={course} transferTargets={phaseTargets} />
          </Disclosure>
        </>}
      <Disclosure summary="Termin erfassen">
        <EventCreateForm course={course} transferTargets={eventTargets} />
      </Disclosure>
    </div> : null}
  </section>;
}
