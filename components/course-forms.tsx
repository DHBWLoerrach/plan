"use client";

import { useActionState, useId, useState } from "react";

import { type CourseFormState, createCourseAction, deleteCourseAction, updateCourseAction } from "@/app/intern/kurse/actions";

type Program = { id: string; label: string };
type Course = { code: string; programId: string; studyStart: string; studyEnd: string };

function CourseFields({ programs, course }: { programs: Program[]; course?: Course }) {
  const ids = { code: useId(), program: useId(), start: useId(), end: useId() };
  return <>
    <label htmlFor={ids.code}>Kurskennung</label>
    <input id={ids.code} name="code" type="text" required maxLength={32} defaultValue={course?.code} autoComplete="off" />
    <label htmlFor={ids.program}>Studiengang</label>
    <select id={ids.program} name="programId" required defaultValue={course?.programId ?? ""}>
      <option value="" disabled>Bitte wählen</option>
      {programs.map((program) => <option key={program.id} value={program.id}>{program.label}</option>)}
    </select>
    <label htmlFor={ids.start}>Studienbeginn</label>
    <input id={ids.start} name="studyStart" type="date" required defaultValue={course?.studyStart} />
    <label htmlFor={ids.end}>Studienende</label>
    <input id={ids.end} name="studyEnd" type="date" required defaultValue={course?.studyEnd} />
  </>;
}

export function CreateCourseForm({ programs }: { programs: Program[] }) {
  const [state, formAction, isPending] = useActionState<CourseFormState, FormData>(createCourseAction, {});
  return <form action={formAction} className="account-form">
    <CourseFields programs={programs} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Kurs wird angelegt …" : "Kurs anlegen"}</button>
  </form>;
}

export function EditCourseForm({ courseId, programs, course }: { courseId: string; programs: Program[]; course: Course }) {
  const [state, formAction, isPending] = useActionState<CourseFormState, FormData>(updateCourseAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="courseId" value={courseId} />
    <CourseFields programs={programs} course={course} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Kursangaben speichern"}</button>
  </form>;
}

export function DeleteCourseForm({ courseId, code }: { courseId: string; code: string }) {
  const [state, formAction, isPending] = useActionState<CourseFormState, FormData>(deleteCourseAction, {});
  const [confirming, setConfirming] = useState(false);
  return <form action={formAction} className="account-form">
    <input type="hidden" name="courseId" value={courseId} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    {confirming ? <div className="confirm-region" role="group" aria-label="Kurs löschen bestätigen">
      <p><strong>Kurs {code} löschen</strong></p>
      <p>Der Kurs {code} wird dauerhaft entfernt. Ist er einem Blockplan zugeordnet, wird er daraus gelöst und seine Kursphasen sowie Terminzuordnungen im Entwurf entfallen. Der letzte Kurs eines Blockplans kann nicht gelöscht werden.</p>
      <button className="button button--danger" type="submit" disabled={isPending}>{isPending ? "Wird gelöscht …" : "Endgültig löschen"}</button>
      <button className="button button--ghost" type="button" onClick={() => setConfirming(false)}>Abbrechen</button>
    </div> : <button className="button button--danger" type="button" onClick={() => setConfirming(true)}>Kurs löschen</button>}
  </form>;
}
