"use client";

import { useActionState, useId } from "react";

import { type PhaseDetailsFormState, type PhaseFormState, createPhasesAction, deletePhaseAction, updatePhaseAction } from "@/app/intern/blockplaene/actions";
import { CollapsibleEditor, ConfirmDeleteForm } from "@/components/editor-controls";
import { type PhaseType, phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import type { PhaseField } from "@/lib/services/phase-admin";

type PhaseCourse = { id: string; code: string };
export type EditablePhase = { id: string; courseId: string; code: string; semester: number; type: PhaseType; startDate: string; endDate: string };
type PhaseDefaults = { semester: string; type: string; startDate: string; endDate: string };

const requiredHint = "Alle Angaben sind erforderlich.";

function PhaseDetailFields({ semesters, defaults, state, errorId }: {
  semesters: number;
  defaults: PhaseDefaults;
  state: PhaseDetailsFormState;
  errorId: string;
}) {
  const ids = { semester: useId(), type: useId(), start: useId(), end: useId(), periodHint: useId() };
  // A rejected save keeps what was entered; otherwise the saved phase or the opened semester provides the defaults.
  const values = state.values ?? defaults;
  const invalid = (field: PhaseField) => state.field === field;
  const describedBy = (field: PhaseField, ...extra: string[]) => [...extra, invalid(field) ? errorId : ""].filter(Boolean).join(" ") || undefined;
  return <>
    <label htmlFor={ids.semester}>Semester</label>
    <select id={ids.semester} name="semester" required defaultValue={values.semester}
      aria-invalid={invalid("semester") || undefined} aria-describedby={describedBy("semester")}>
      <option value="" disabled>Bitte wählen</option>
      {Array.from({ length: semesters }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
    </select>
    <label htmlFor={ids.type}>Phasentyp</label>
    <select id={ids.type} name="type" required defaultValue={values.type}
      aria-invalid={invalid("type") || undefined} aria-describedby={describedBy("type")}>
      <option value="" disabled>Bitte wählen</option>
      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
    <label htmlFor={ids.start}>Startdatum</label>
    <input id={ids.start} name="startDate" type="date" required defaultValue={values.startDate}
      aria-invalid={invalid("startDate") || undefined} aria-describedby={describedBy("startDate", ids.periodHint)} />
    <label htmlFor={ids.end}>Enddatum</label>
    <input id={ids.end} name="endDate" type="date" required defaultValue={values.endDate}
      aria-invalid={invalid("endDate") || undefined} aria-describedby={describedBy("endDate", ids.periodHint)} />
    <p id={ids.periodHint}>Der Zeitraum gilt einschließlich beider Grenztage; Start- und Enddatum dürfen derselbe Tag sein.</p>
  </>;
}

export function CreatePhasesForm({ blockPlanId, courses, semesters, semester }: { blockPlanId: string; courses: PhaseCourse[]; semesters: number; semester: number }) {
  const [state, formAction, isPending] = useActionState<PhaseFormState, FormData>(createPhasesAction, {});
  const ids = { error: useId(), consequence: useId() };
  const selected = new Set(state.values?.courseIds ?? []);
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <p>{requiredHint} Die Kursphase entsteht zunächst in Semester {semester}; Sie können ein anderes Semester wählen.</p>
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    <fieldset className="account-fieldset" aria-describedby={`${ids.consequence}${state.field === "courseIds" ? ` ${ids.error}` : ""}`}>
      <legend>Kurse für die neue Kursphase</legend>
      <p id={ids.consequence}>
        Für jeden ausgewählten Kurs entsteht eine eigenständige Kursphase mit zunächst gleichen Angaben. Danach besteht keine
        gemeinsame Identität: Eine spätere Änderung oder Löschung wirkt nur auf die jeweils bearbeitete Kursphase.
      </p>
      {courses.map((course) => <label key={course.id}>
        <input type="checkbox" name="courseIds" value={course.id} defaultChecked={selected.has(course.id)} /> {course.code}
      </label>)}
    </fieldset>
    <PhaseDetailFields semesters={semesters} state={state} errorId={ids.error}
      defaults={{ semester: String(semester), type: "", startDate: "", endDate: "" }} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Kursphasen werden angelegt …" : "Kursphase(n) anlegen"}</button>
  </form>;
}

function EditPhaseForm({ blockPlanId, phase, semesters }: { blockPlanId: string; phase: EditablePhase; semesters: number }) {
  const [state, formAction, isPending] = useActionState<PhaseDetailsFormState, FormData>(updatePhaseAction, {});
  const errorId = useId();
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="phaseId" value={phase.id} />
    <p>{requiredHint} Die Änderung wirkt nur auf diese Kursphase von {phase.code}.</p>
    {state.error ? <p id={errorId} role="alert">{state.error}</p> : null}
    <PhaseDetailFields semesters={semesters} state={state} errorId={errorId}
      defaults={{ semester: String(phase.semester), type: phase.type, startDate: phase.startDate, endDate: phase.endDate }} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Kursphase speichern"}</button>
  </form>;
}

function DeletePhaseForm({ blockPlanId, phase }: { blockPlanId: string; phase: EditablePhase }) {
  const [state, formAction, isPending] = useActionState<PhaseFormState, FormData>(deletePhaseAction, {});
  return <ConfirmDeleteForm action={formAction} error={state.error} isPending={isPending}
    openLabel={`Kursphase von ${phase.code} löschen`}
    confirmLabel="Endgültig löschen"
    heading={`Kursphase von ${phase.code} löschen`}
    consequence={`Die Kursphase vom ${phase.startDate} bis ${phase.endDate} wird aus dem Entwurf entfernt. Kursphasen anderer Kurse bleiben bestehen, auch wenn sie gemeinsam angelegt wurden.`}>
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="phaseId" value={phase.id} />
    <input type="hidden" name="semester" value={phase.semester} />
  </ConfirmDeleteForm>;
}

export function PhaseEditor({ blockPlanId, phase, semesters }: { blockPlanId: string; phase: EditablePhase; semesters: number }) {
  const description = `${phase.code}: ${phaseTypeLabel(phase.type)} vom ${phase.startDate} bis ${phase.endDate}`;
  return <CollapsibleEditor heading={description} openLabel={`Kursphase bearbeiten (${description})`} closeLabel={`Bearbeitung schließen (${description})`}>
    <EditPhaseForm blockPlanId={blockPlanId} phase={phase} semesters={semesters} />
    <DeletePhaseForm blockPlanId={blockPlanId} phase={phase} />
  </CollapsibleEditor>;
}
