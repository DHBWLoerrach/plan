"use client";

import { useActionState, useId } from "react";

import { type PhaseDetailsFormState, type PhaseFormState, deletePhaseAction, updatePhaseAction } from "@/app/intern/blockplaene/actions";
import { DateField } from "@/components/date-field";
import { ConfirmDeleteForm } from "@/components/editor-controls";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { type PhaseType, phaseTypes } from "@/lib/domain/phase-type";
import type { PhaseField } from "@/lib/services/phase-admin";

export type EditablePhase = { id: string; courseId: string; code: string; semester: number; type: PhaseType; startDate: string; endDate: string };

const periodHint = "Der Zeitraum gilt einschließlich beider Grenztage; Start- und Enddatum dürfen derselbe Tag sein.";

function EditPhaseForm({ blockPlanId, phase, semesters, openSemester, onSaved }: {
  blockPlanId: string;
  phase: EditablePhase;
  semesters: number;
  openSemester: number;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<PhaseDetailsFormState, FormData>(async (previous, formData) => {
    const result = await updatePhaseAction(previous, formData);
    if (result.success) {
      onSaved(result.movedToSemester
        ? `Die Kursphase von ${phase.code} wurde nach Semester ${result.movedToSemester} verschoben.`
        : result.success);
    }
    return result;
  }, {});
  const ids = { error: useId(), semester: useId(), type: useId() };
  // A rejected save keeps what was entered; otherwise the saved phase provides the defaults.
  const values = state.values ?? { semester: String(phase.semester), type: phase.type, startDate: phase.startDate, endDate: phase.endDate };
  const invalid = (field: PhaseField) => state.field === field;
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="phaseId" value={phase.id} />
    <input type="hidden" name="openSemester" value={openSemester} />
    <p>Alle Angaben sind erforderlich. Die Änderung wirkt nur auf diese Kursphase von {phase.code}.</p>
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    <label htmlFor={ids.semester}>Semester</label>
    <select id={ids.semester} name="semester" required defaultValue={values.semester}
      aria-invalid={invalid("semester") || undefined} aria-describedby={invalid("semester") ? ids.error : undefined}>
      {Array.from({ length: semesters }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
    </select>
    <label htmlFor={ids.type}>Phasentyp</label>
    <select id={ids.type} name="type" required defaultValue={values.type}
      aria-invalid={invalid("type") || undefined} aria-describedby={invalid("type") ? ids.error : undefined}>
      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" defaultValue={values.startDate} required
      invalid={invalid("startDate")} errorId={ids.error} hint={periodHint} />
    <DateField label="Enddatum" name="endDate" defaultValue={values.endDate} required
      invalid={invalid("endDate")} errorId={ids.error} />
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Kursphase speichern"}</button>
  </form>;
}

function DeletePhaseForm({ blockPlanId, phase, onSaved }: { blockPlanId: string; phase: EditablePhase; onSaved: (message: string) => void }) {
  const [state, formAction, isPending] = useActionState<PhaseFormState, FormData>(async (previous, formData) => {
    const result = await deletePhaseAction(previous, formData);
    if (result.success) onSaved(`Die Kursphase von ${phase.code} wurde aus dem Entwurf gelöscht.`);
    return result;
  }, {});
  return <ConfirmDeleteForm action={formAction} error={state.error} isPending={isPending}
    openLabel={`Kursphase von ${phase.code} löschen`}
    confirmLabel="Endgültig löschen"
    heading={`Kursphase von ${phase.code} löschen`}
    consequence={`Die Kursphase vom ${formatCalendarPeriod(phase.startDate, phase.endDate)} wird aus dem Entwurf entfernt. Kursphasen anderer Kurse bleiben bestehen, auch wenn sie gemeinsam angelegt wurden.`}>
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="phaseId" value={phase.id} />
  </ConfirmDeleteForm>;
}

export function PhaseEditorForms({ blockPlanId, phase, semesters, openSemester, onSaved }: {
  blockPlanId: string;
  phase: EditablePhase;
  semesters: number;
  openSemester: number;
  onSaved: (message: string) => void;
}) {
  return <>
    <EditPhaseForm blockPlanId={blockPlanId} phase={phase} semesters={semesters} openSemester={openSemester} onSaved={onSaved} />
    <DeletePhaseForm blockPlanId={blockPlanId} phase={phase} onSaved={onSaved} />
  </>;
}
