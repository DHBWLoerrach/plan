"use client";

import { useActionState, useId } from "react";

import { ConfirmAction } from "@/components/editor-controls";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import type { AttachableCourse } from "@/lib/services/block-plan-admin";

import {
  type BlockPlanFormState,
  attachCourseAction,
  createBlockPlanFromCourseAction,
  deleteBlockPlanAction,
  detachCourseAction,
  renameBlockPlanAction,
} from "@/app/intern/blockplaene/actions";

export function CreateBlockPlanFromCourseForm({ courseId, code }: { courseId: string; code: string }) {
  const [state, formAction, isPending] = useActionState<BlockPlanFormState, FormData>(createBlockPlanFromCourseAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="courseId" value={courseId} />
    <p>Der Blockplan entsteht gemeinsam mit der Zuordnung von Kurs {code}. Weitere Kurse desselben Bereichs, Jahrgangs und derselben Studiendauer können Sie danach zuordnen.</p>
    {state.error ? <p role="alert">{state.error}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Blockplan wird angelegt …" : "Blockplan aus diesem Kurs anlegen"}</button>
  </form>;
}

/**
 * Creating a block plan from the list: it always starts from a block-plan-less course, because creation and the first
 * course assignment are one operation (FACHLICHE_REGELN.md).
 */
export function CreateBlockPlanForm({ courses }: { courses: AttachableCourse[] }) {
  const [state, formAction, isPending] = useActionState<BlockPlanFormState, FormData>(createBlockPlanFromCourseAction, {});
  const courseFieldId = useId();
  const errorId = useId();
  return <form action={formAction} className="account-form">
    <label htmlFor={courseFieldId}>Blockplan aus blockplanlosem Kurs anlegen</label>
    <select id={courseFieldId} name="courseId" required defaultValue=""
      aria-describedby={state.error ? errorId : undefined} aria-invalid={state.error ? true : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.program} ({formatCalendarPeriod(course.studyStart, course.studyEnd)})</option>)}
    </select>
    {state.error ? <p id={errorId} role="alert">{state.error}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Blockplan wird angelegt …" : "Blockplan anlegen"}</button>
  </form>;
}

export function RenameBlockPlanForm({ blockPlanId, name, derivedName }: { blockPlanId: string; name: string | null; derivedName: string }) {
  const [state, formAction, isPending] = useActionState<BlockPlanFormState, FormData>(renameBlockPlanAction, {});
  const nameFieldId = useId();
  const hintId = useId();
  const errorId = useId();
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <label htmlFor={nameFieldId}>Bezeichnung (optional)</label>
    <input id={nameFieldId} name="name" type="text" maxLength={160} defaultValue={name ?? ""} autoComplete="off"
      aria-describedby={state.error ? `${errorId} ${hintId}` : hintId} aria-invalid={state.error ? true : undefined} />
    <p id={hintId}>Ohne Bezeichnung heißt der Blockplan „{derivedName}“ — abgeleitet aus Jahrgang und aktuellen Kurskennungen.</p>
    {state.error ? <p id={errorId} role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Wird gespeichert …" : "Bezeichnung speichern"}</button>
  </form>;
}

export function AttachCourseForm({ blockPlanId, courses }: { blockPlanId: string; courses: AttachableCourse[] }) {
  const [state, formAction, isPending] = useActionState<BlockPlanFormState, FormData>(attachCourseAction, {});
  const courseFieldId = useId();
  const errorId = useId();
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <label htmlFor={courseFieldId}>Kurs zuordnen</label>
    <select id={courseFieldId} name="courseId" required defaultValue=""
      aria-describedby={state.error ? errorId : undefined} aria-invalid={state.error ? true : undefined}>
      <option value="" disabled>Bitte wählen</option>
      {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.program} ({formatCalendarPeriod(course.studyStart, course.studyEnd)})</option>)}
    </select>
    {state.error ? <p id={errorId} role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <button className="button" type="submit" disabled={isPending}>{isPending ? "Kurs wird zugeordnet …" : "Kurs zuordnen"}</button>
  </form>;
}

export function DetachCourseForm({ blockPlanId, courseId, code }: { blockPlanId: string; courseId: string; code: string }) {
  const [state, formAction, isPending] = useActionState<BlockPlanFormState, FormData>(detachCourseAction, {});
  return <form action={formAction}>
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="courseId" value={courseId} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <ConfirmAction openLabel={`Kurs ${code} lösen`} heading={`Kurs ${code} vom Blockplan lösen`}
      consequence="Der Kurs bleibt bestehen und wird blockplanlos. Seine Kursphasen und seine Zuordnungen zu prüfungsrelevanten Terminen in diesem Entwurf entfallen."
      confirmLabel="Kurs lösen" pendingLabel="Wird gelöst …" isPending={isPending} danger />
  </form>;
}

export function DeleteBlockPlanForm({ blockPlanId, displayName, courseCodes }: { blockPlanId: string; displayName: string; courseCodes: string[] }) {
  const [state, formAction, isPending] = useActionState<BlockPlanFormState, FormData>(deleteBlockPlanAction, {});
  return <form action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    {state.error ? <p role="alert">{state.error}</p> : null}
    <ConfirmAction openLabel="Blockplan löschen" heading={`Blockplan „${displayName}“ löschen`}
      consequence={`Der Blockplan wird mit seinem Entwurf, also allen Kursphasen und prüfungsrelevanten Terminen, dauerhaft entfernt. Die Kurse ${courseCodes.join(", ")} bleiben bestehen und werden blockplanlos.`}
      confirmLabel="Endgültig löschen" pendingLabel="Wird gelöscht …" isPending={isPending} danger />
  </form>;
}
