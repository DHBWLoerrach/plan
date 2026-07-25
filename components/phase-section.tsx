"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { type PhaseFormState, createPhasesAction } from "@/app/intern/blockplaene/actions";
import { DateField } from "@/components/date-field";
import { CollapsibleEditor } from "@/components/editor-controls";
import { type EditablePhase, PhaseEditorForms } from "@/components/phase-forms";
import { formatCalendarDay, formatCalendarPeriod } from "@/lib/domain/calendar-format";
import type { NextPhaseDefaults, SemesterContext } from "@/lib/domain/phase-sequence";
import { phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import type { SemesterEntry } from "@/lib/domain/semester-overview";
import type { PhaseField } from "@/lib/services/phase-admin";

type PhaseCourse = { id: string; code: string };

/** Completeness and errors of a semester as text, never by colour or position alone (BARRIEREFREIHEIT.md). */
function shortStatus(entry: SemesterEntry): string {
  if (entry.codesWithOverlap.length) return `Fehler: überlappende Kursphasen (${entry.codesWithOverlap.join(", ")})`;
  if (!entry.phaseCount) return "noch keine Kursphase";
  if (entry.codesWithoutPhase.length) {
    return entry.codesWithoutPhase.length === 1
      ? `1 Kurs ohne Kursphase (${entry.codesWithoutPhase[0]})`
      : `${entry.codesWithoutPhase.length} Kurse ohne Kursphase (${entry.codesWithoutPhase.join(", ")})`;
  }
  return "vollständig";
}

function fullStatus(entry: SemesterEntry): string {
  if (!entry.phaseCount) return "In diesem Semester ist noch keine Kursphase gespeichert.";
  const parts = [entry.phaseCount === 1 ? "1 Kursphase" : `${entry.phaseCount} Kursphasen`];
  parts.push(entry.codesWithoutPhase.length
    ? `ohne Kursphase: ${entry.codesWithoutPhase.join(", ")}`
    : "jeder Kurs hat hier mindestens eine Kursphase");
  if (entry.codesWithOverlap.length) parts.push(`Fehler — überlappende Kursphasen: ${entry.codesWithOverlap.join(", ")}`);
  return parts.join(" · ");
}

function CreatePhasesForm({ blockPlanId, courses, semesters, semester, defaults, onSaved }: {
  blockPlanId: string;
  courses: PhaseCourse[];
  semesters: number;
  semester: number;
  defaults: NextPhaseDefaults;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<PhaseFormState, FormData>(async (previous, formData) => {
    const result = await createPhasesAction(previous, formData);
    if (result.success) onSaved(result.success);
    return result;
  }, {});
  const ids = { error: useId(), consequence: useId(), semester: useId(), type: useId(), ambiguous: useId() };
  // After a save the server supplies the defaults for the next phase; a rejected save keeps what was entered.
  const values = state.values ?? state.next ?? defaults;
  const active = state.next ?? defaults;
  const selected = new Set(values.courseIds);
  const invalid = (field: PhaseField) => state.field === field;
  const periodHint = "Der Zeitraum gilt einschließlich beider Grenztage; Start- und Enddatum dürfen derselbe Tag sein.";
  return <form key={state.token ?? "initial"} action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <p>Alle Angaben sind erforderlich. Die Kursphase entsteht zunächst in Semester {semester}; Sie können ein anderes Semester wählen.</p>
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    <fieldset className="account-fieldset" aria-describedby={`${ids.consequence}${invalid("courseIds") ? ` ${ids.error}` : ""}`}>
      <legend>Kurse für die neue Kursphase</legend>
      <p id={ids.consequence}>
        Für jeden ausgewählten Kurs entsteht eine eigenständige Kursphase mit zunächst gleichen Angaben. Danach besteht keine
        gemeinsame Identität: Eine spätere Änderung oder Löschung wirkt nur auf die jeweils bearbeitete Kursphase.
      </p>
      {courses.map((course) => <label key={course.id}>
        <input type="checkbox" name="courseIds" value={course.id} defaultChecked={selected.has(course.id)} /> {course.code}
      </label>)}
    </fieldset>
    {active.ambiguousPredecessors.length ? <p id={ids.ambiguous} className="empty-note">
      Startdatum und Phasentyp bleiben leer, weil die ausgewählten Kurse unterschiedlich weit geplant sind: {active.ambiguousPredecessors
        .map((entry) => entry.endDate
          ? `${entry.code} bis ${formatCalendarDay(entry.endDate, { weekday: true })}`
          : `${entry.code} noch ohne Kursphase`)
        .join(", ")}.
    </p> : null}
    <label htmlFor={ids.semester}>Semester</label>
    <select id={ids.semester} name="semester" required defaultValue={values.semester}
      aria-invalid={invalid("semester") || undefined} aria-describedby={invalid("semester") ? ids.error : undefined}>
      {Array.from({ length: semesters }, (_, index) => index + 1).map((entry) => <option key={entry} value={entry}>Semester {entry}</option>)}
    </select>
    <label htmlFor={ids.type}>Phasentyp</label>
    <select id={ids.type} name="type" required defaultValue={values.type}
      aria-invalid={invalid("type") || undefined} aria-describedby={invalid("type") ? ids.error : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" defaultValue={values.startDate} required
      invalid={invalid("startDate")} errorId={ids.error} hint={periodHint}
      autoFocus={Boolean(state.token) && !values.startDate} />
    <DateField label="Enddatum" name="endDate" defaultValue={values.endDate} required
      invalid={invalid("endDate")} errorId={ids.error}
      autoFocus={Boolean(state.token) && Boolean(values.startDate)} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Kursphasen werden angelegt …" : "Anlegen und nächste erfassen"}</button>
  </form>;
}

export function PhaseSection({ blockPlanId, courses, semesters, semester, overview, phases, context, nextDefaults }: {
  blockPlanId: string;
  courses: PhaseCourse[];
  semesters: number;
  semester: number;
  overview: SemesterEntry[];
  phases: EditablePhase[];
  context: SemesterContext;
  nextDefaults: NextPhaseDefaults;
}) {
  // The status lives on the section, because a moved or deleted phase takes its own editor and state with it.
  const [status, setStatus] = useState<string | null>(null);
  const entry = overview[semester - 1];
  return <section aria-labelledby="draft-heading">
    <h2 id="draft-heading">Kursphasen</h2>
    <p>Der Verlauf wird semesterweise erfasst. Jede Anlage, Änderung und Löschung wird einzeln gespeichert.</p>
    <p role="status">{status ?? ""}</p>

    <nav aria-label="Semester des Blockplans">
      <ul className="semester-bar">{overview.map((item) => <li key={item.semester}>
        <Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${item.semester}`}
          aria-current={item.semester === semester ? "page" : undefined}>
          Semester {item.semester}
        </Link>
        <span>{shortStatus(item)}</span>
      </li>)}</ul>
    </nav>

    <h3>Semester {semester}</h3>
    {entry ? <p>{fullStatus(entry)}</p> : null}

    {context.before.length ? <div className="entry-context">
      <h4>Vor diesem Semester</h4>
      <ul>{context.before.map((item) => <li key={item.code}>
        {item.code}: Semester {item.semester} · {phaseTypeLabel(item.type)} bis {formatCalendarDay(item.endDate, { weekday: true })}
        {" "}<Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${item.semester}`}>Zu Semester {item.semester}</Link>
      </li>)}</ul>
    </div> : null}

    {phases.length ? <ul className="entry-list">{phases.map((phase) => <li key={phase.id}>
      <CollapsibleEditor
        heading={`${phase.code}: ${phaseTypeLabel(phase.type)} ${formatCalendarPeriod(phase.startDate, phase.endDate, { weekday: true })}`}
        openLabel={`Kursphase bearbeiten (${phase.code}, ${formatCalendarPeriod(phase.startDate, phase.endDate)})`}
        closeLabel={`Bearbeitung schließen (${phase.code}, ${formatCalendarPeriod(phase.startDate, phase.endDate)})`}>
        <PhaseEditorForms blockPlanId={blockPlanId} phase={phase} semesters={semesters} openSemester={semester} onSaved={setStatus} />
      </CollapsibleEditor>
    </li>)}</ul> : <p className="empty-note">In Semester {semester} ist noch keine Kursphase gespeichert.</p>}

    {context.after.length ? <div className="entry-context">
      <h4>Nach diesem Semester</h4>
      <ul>{context.after.map((item) => <li key={item.code}>
        {item.code}: Semester {item.semester} · {phaseTypeLabel(item.type)} ab {formatCalendarDay(item.startDate, { weekday: true })}
        {" "}<Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${item.semester}`}>Zu Semester {item.semester}</Link>
      </li>)}</ul>
      {context.unplanned.map((span) => <p key={span.code}>
        Bei {span.code} sind zwischen {formatCalendarDay(span.from)} und {formatCalendarDay(span.to)} noch {span.days} Tage keiner Kursphase zugeordnet.
      </p>)}
    </div> : null}

    <h4>Nächste Kursphase anlegen</h4>
    <CreatePhasesForm blockPlanId={blockPlanId} courses={courses} semesters={semesters} semester={semester}
      defaults={nextDefaults} onSaved={setStatus} />
  </section>;
}
