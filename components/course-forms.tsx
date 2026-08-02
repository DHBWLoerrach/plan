"use client";

import { useActionState, useId, useState } from "react";

import { type CourseFormState, createCourseAction, deleteCourseAction, updateCourseAction } from "@/app/intern/kurse/actions";
import { ConfirmAction } from "@/components/editor-controls";
import { isCalendarDay } from "@/lib/domain/calendar-day";
import { phaseTypeLabel } from "@/lib/domain/phase-type";
import { planAdoption, proposedStudyEnd, type TemplatePhase } from "@/lib/domain/course-adoption";
// A type-only import: the module is erased here rather than pulled into the client bundle.
import type { AdoptionTemplateCourse } from "@/lib/services/course-adoption";

type Program = { id: string; label: string };
type Course = { code: string; programId: string; studyStart: string; studyEnd: string };
/** The study period as the adoption form holds it, so the preview follows every keystroke. */
type StudyPeriodControl = { studyStart: string; studyEnd: string; onStudyStart: (value: string) => void; onStudyEnd: (value: string) => void };

function CourseFields({ programs, course, period }: { programs: Program[]; course?: Course; period?: StudyPeriodControl }) {
  const ids = { code: useId(), program: useId(), start: useId(), end: useId() };
  const startProps = period ? { value: period.studyStart, onChange: (event: { target: { value: string } }) => period.onStudyStart(event.target.value) } : { defaultValue: course?.studyStart };
  const endProps = period ? { value: period.studyEnd, onChange: (event: { target: { value: string } }) => period.onStudyEnd(event.target.value) } : { defaultValue: course?.studyEnd };
  return <>
    <label htmlFor={ids.code}>Kurskennung</label>
    <input id={ids.code} name="code" type="text" required maxLength={32} defaultValue={course?.code} autoComplete="off" />
    <label htmlFor={ids.program}>Studiengang</label>
    <select id={ids.program} name="programId" required defaultValue={course?.programId ?? ""}>
      <option value="" disabled>Bitte wählen</option>
      {programs.map((program) => <option key={program.id} value={program.id}>{program.label}</option>)}
    </select>
    <label htmlFor={ids.start}>Studienbeginn</label>
    <input id={ids.start} name="studyStart" type="date" required {...startProps} />
    <label htmlFor={ids.end}>Studienende</label>
    <input id={ids.end} name="studyEnd" type="date" required {...endProps} />
  </>;
}

/** How the preview names the shift: whole weeks, in the direction the new study start lies. */
function shiftSentence(weeks: number): string {
  if (weeks === 0) return "Die Verschiebung ist null: Vorlage und neuer Kurs beginnen in derselben Woche.";
  const direction = weeks > 0 ? "später" : "früher";
  const count = Math.abs(weeks);
  return `Alle übernommenen Angaben werden um ${count === 1 ? "eine Woche" : `${count} Wochen`} nach ${direction} versetzt. Die Wochentage bleiben dabei erhalten.`;
}

function PhaseList({ heading, phases }: { heading: string; phases: { semester: number; type: TemplatePhase["type"]; startDate: string; endDate: string }[] }) {
  if (!phases.length) return null;
  return <>
    <p>{heading}</p>
    <ul>{phases.map((phase) => <li key={`${phase.semester}-${phase.startDate}`}>Semester {phase.semester} · {phaseTypeLabel(phase.type)} · {phase.startDate} bis {phase.endDate}</li>)}</ul>
  </>;
}

/**
 * The preview recomputes on every keystroke, so it is a status message: what gets cut has to reach assistive
 * technology as well, not only the eye (BARRIEREFREIHEIT.md).
 */
function AdoptionPreview({ template, studyStart, studyEnd, withPhases, withEvents }: {
  template: AdoptionTemplateCourse;
  studyStart: string;
  studyEnd: string;
  withPhases: boolean;
  withEvents: boolean;
}) {
  if (!isCalendarDay(studyStart) || !isCalendarDay(studyEnd) || studyStart >= studyEnd) {
    return <p className="empty-note" role="status">Sobald Studienbeginn und Studienende feststehen, steht hier, um wie viele Wochen die Übernahme versetzt und welche Kursphasen dabei gekürzt werden.</p>;
  }
  const adoption = planAdoption(template, { studyStart, studyEnd, withPhases, withEvents });
  const truncated = adoption.phases.filter((phase) => phase.truncated);
  return <div className="notice" role="status">
    <p>{shiftSentence(adoption.shiftWeeks)}</p>
    <p>Übernommen werden {adoption.phases.length === 1 ? "1 Kursphase" : `${adoption.phases.length} Kursphasen`} und {adoption.events.length === 1 ? "1 Termin" : `${adoption.events.length} Termine`}.</p>
    <PhaseList heading={`Auf den Studienzeitraum gekürzt ${truncated.length === 1 ? "wird diese Kursphase" : "werden diese Kursphasen"}:`} phases={truncated} />
    <PhaseList heading={`Außerhalb des Studienzeitraums ${adoption.droppedPhases.length === 1 ? "liegt diese Kursphase; sie wird nicht übernommen" : "liegen diese Kursphasen; sie werden nicht übernommen"}:`} phases={adoption.droppedPhases} />
    {truncated.length || adoption.droppedPhases.length
      ? <p>Lücken an den Rändern werden nicht automatisch geschlossen. Die Vollständigkeitsanzeige des Zuschnitts benennt sie.</p>
      : null}
  </div>;
}

/**
 * Creating a course as an adoption. The preview follows the entered study period, so the shift in weeks and the phases
 * that get cut are named before saving. What is written is computed again on the server from the same pure module.
 */
export function AdoptCourseForm({ programs, template }: { programs: Program[]; template: AdoptionTemplateCourse }) {
  const [state, formAction, isPending] = useActionState<CourseFormState, FormData>(createCourseAction, {});
  const [studyStart, setStudyStart] = useState("");
  const [studyEnd, setStudyEnd] = useState("");
  const [studyEndEdited, setStudyEndEdited] = useState(false);
  const [withPhases, setWithPhases] = useState(true);
  const [withEvents, setWithEvents] = useState(true);

  /**
   * A new study start proposes the study end anew, keeping the length of the study period of the template — but only
   * as long as nobody has corrected the study end themselves. The proposal is a suggestion, not a correction.
   */
  function changeStudyStart(value: string) {
    setStudyStart(value);
    if (isCalendarDay(value) && !studyEndEdited) setStudyEnd(proposedStudyEnd(template, value));
  }

  function changeStudyEnd(value: string) {
    setStudyEnd(value);
    setStudyEndEdited(true);
  }

  return <form action={formAction} className="account-form">
    <input type="hidden" name="templateCourseId" value={template.id} />
    <p>Vorlage: <strong>{template.code}</strong> — {template.program} ({template.areaName}), {template.semesters} Semester, Studienzeitraum {template.studyStart} – {template.studyEnd}. Sie enthält {template.phases.length === 1 ? "1 Kursphase" : `${template.phases.length} Kursphasen`} und {template.events.length === 1 ? "1 Termin" : `${template.events.length} Termine`}.</p>
    <fieldset className="account-fieldset">
      <legend>Was übernommen wird</legend>
      <label><input type="checkbox" name="withPhases" checked={withPhases} onChange={(event) => setWithPhases(event.target.checked)} /> Kursverlauf</label>
      <label><input type="checkbox" name="withEvents" checked={withEvents} onChange={(event) => setWithEvents(event.target.checked)} /> Prüfungsrelevante Termine</label>
    </fieldset>
    <CourseFields programs={programs} period={{ studyStart, studyEnd, onStudyStart: changeStudyStart, onStudyEnd: changeStudyEnd }} />
    <p>Das Studienende ist aus der Dauer des Studienzeitraums der Vorlage vorgeschlagen. Sobald Sie es selbst setzen, bleibt Ihr Wert stehen.</p>
    <AdoptionPreview template={template} studyStart={studyStart} studyEnd={studyEnd} withPhases={withPhases} withEvents={withEvents} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Kurs wird angelegt …" : "Kurs übernehmen und anlegen"}</button>
  </form>;
}

function CourseChangePreview({ before, programs, formData }: { before: Course; programs: Program[]; formData: FormData }) {
  const after = {
    code: String(formData.get("code") ?? ""),
    programId: String(formData.get("programId") ?? ""),
    studyStart: String(formData.get("studyStart") ?? ""),
    studyEnd: String(formData.get("studyEnd") ?? ""),
  };
  const programLabel = (id: string) => programs.find((program) => program.id === id)?.label ?? id;
  const rows = [
    ["Kurskennung", before.code, after.code],
    ["Studiengang", programLabel(before.programId), programLabel(after.programId)],
    ["Studienbeginn", before.studyStart, after.studyStart],
    ["Studienende", before.studyEnd, after.studyEnd],
  ].filter(([, oldValue, newValue]) => oldValue !== newValue);
  return <>
    {rows.length ? <ul>{rows.map(([label, oldValue, newValue]) => <li key={label}><strong>{label}:</strong> {oldValue} → {newValue}</li>)}</ul> : <p>Die Kursangaben bleiben unverändert.</p>}
    <p>Nach erfolgreicher Prüfung ist diese Änderung unmittelbar öffentlich sichtbar.</p>
  </>;
}

export function EditCourseForm({ courseId, programs, course, published }: { courseId: string; programs: Program[]; course: Course; published: boolean }) {
  const [state, formAction, isPending] = useActionState<CourseFormState, FormData>(updateCourseAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="courseId" value={courseId} />
    <CourseFields programs={programs} course={course} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    {published
      ? <ConfirmAction openLabel="Änderung prüfen" heading="Öffentliche Kursangaben ändern"
          consequence="Die Änderung wird nach erfolgreicher Prüfung unmittelbar öffentlich sichtbar."
          preview={(formData) => <CourseChangePreview before={course} programs={programs} formData={formData} />}
          confirmLabel="Änderung speichern und veröffentlichen" pendingLabel="Wird gespeichert …" isPending={isPending} />
      : <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Kursangaben speichern"}</button>}
  </form>;
}

export function DeleteCourseForm({ courseId, code }: { courseId: string; code: string }) {
  const [state, formAction, isPending] = useActionState<CourseFormState, FormData>(deleteCourseAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="courseId" value={courseId} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    <ConfirmAction openLabel="Kurs löschen" heading={`Kurs ${code} löschen`}
      consequence={`Der Kurs ${code} wird dauerhaft entfernt. Sein Kursverlauf und seine prüfungsrelevanten Termine entfallen mit ihm.`}
      confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={isPending} danger />
  </form>;
}
