"use client";

import Link from "next/link";
import { Fragment, type ReactNode, useActionState, useId, useState } from "react";

import { type PhaseFormState, createPhasesAction } from "@/app/intern/blockplaene/actions";
import { DateField } from "@/components/date-field";
import { CollapsibleEditor } from "@/components/editor-controls";
import { type EditablePhase, PhaseEditorForms } from "@/components/phase-forms";
import { formatCalendarDay, formatCalendarPeriod, formatPeriodDuration } from "@/lib/domain/calendar-format";
import {
  type NextPhaseDefaults,
  type PhaseGap,
  type SemesterContext,
  phaseGapsForSemester,
  suggestedPhaseTypeForGap,
} from "@/lib/domain/phase-sequence";
import { phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";
import type { PublicationIssue } from "@/lib/domain/publication";
import { semesterWorkState, type SemesterEntry } from "@/lib/domain/semester-overview";
import type { PhaseField } from "@/lib/services/phase-admin";

type PhaseCourse = { id: string; code: string; studyStart: string; studyEnd: string };

function phaseWorkspaceUrl(blockPlanId: string, semester: number): string {
  return `/intern/blockplaene/${blockPlanId}?ansicht=kursphasen&semester=${semester}`;
}

/** The phase composition is useful context, but the release check decides whether work remains. */
function composition(entry: SemesterEntry, courseCount: number): string {
  const parts = entry.phasesPerCourse.map(({ type, min, max }) => {
    const label = phaseTypeLabel(type);
    if (min !== max) return `${min}–${max} ${label}`;
    return courseCount > 1 ? `je ${min} ${label}` : `${min} ${label}`;
  });
  return parts.length ? parts.join(", ") : "keine Kursphase";
}

function continuationDefaults(
  base: NextPhaseDefaults,
  course: PhaseCourse,
  semester: number,
  gap: PhaseGap,
): NextPhaseDefaults {
  return {
    ...base,
    courseIds: [course.id],
    semester: String(semester),
    type: suggestedPhaseTypeForGap(gap),
    startDate: gap.from,
    endDate: "",
    ambiguousPredecessors: [],
  };
}

function GapEntry({ from, to, days, onContinue }: {
  from: string;
  to?: string;
  days?: number;
  onContinue: () => void;
}) {
  return <li className="phase-gap">
    <div>
      <strong>Lücke im Verlauf</strong>
      <span>
        {to
          ? `${formatCalendarDay(from, { weekday: true })} bis ${formatCalendarDay(to, { weekday: true })}${days ? ` · ${days} Tage` : ""}`
          : `ab ${formatCalendarDay(from, { weekday: true })}`}
      </span>
    </div>
    <button className="button button--ghost button--compact" type="button" onClick={onContinue}>Kursphase direkt anschließen</button>
  </li>;
}

function CreatePhasesForm({ blockPlanId, courses, semesters, semester, defaults, focusOnOpen, onSaved, onClose }: {
  blockPlanId: string;
  courses: PhaseCourse[];
  semesters: number;
  semester: number;
  defaults: NextPhaseDefaults;
  focusOnOpen: boolean;
  onSaved: (message: ReactNode) => void;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<PhaseFormState, FormData>(async (previous, formData) => {
    const continueCapturing = formData.get("afterSave") === "continue";
    const result = await createPhasesAction(previous, formData);
    if (result.success) {
      onSaved(result.createdInSemester
        ? <>{result.success} <Link className="text-link" href={phaseWorkspaceUrl(blockPlanId, result.createdInSemester)}>Zu Semester {result.createdInSemester}</Link></>
        : result.success);
      if (!continueCapturing) onClose();
    }
    // A rejected save must keep the token of the last successful one, or the form remounts and the keyboard focus
    // needed to fix the error is lost instead of remaining at the invalid field.
    return result.error ? { ...result, token: previous.token } : result;
  }, {});
  const ids = { error: useId(), consequence: useId(), semester: useId(), type: useId(), ambiguous: useId() };
  // After a save the server supplies the defaults for the next phase; a rejected save keeps what was entered.
  const values = state.values ?? state.next ?? defaults;
  const active = state.next ?? defaults;
  const selected = new Set(values.courseIds);
  const invalid = (field: PhaseField) => state.field === field;
  const periodHint = "Start- und Endtag gehören zur Kursphase.";
  const shouldFocusEmptyField = focusOnOpen || Boolean(state.token);
  return <form key={state.token ?? "initial"} action={formAction} className="account-form">
    <input type="hidden" name="blockPlanId" value={blockPlanId} />
    <input type="hidden" name="openSemester" value={semester} />
    {state.error ? <p id={ids.error} role="alert">{state.error}</p> : null}
    <fieldset className="account-fieldset" aria-describedby={`${ids.consequence}${invalid("courseIds") ? ` ${ids.error}` : ""}`}>
      <legend>Kurse</legend>
      <p id={ids.consequence}>Bei mehreren Kursen entstehen eigenständige Kursphasen. Spätere Änderungen wirken jeweils nur auf eine davon.</p>
      {courses.map((course) => <label key={course.id}>
        <input type="checkbox" name="courseIds" value={course.id} defaultChecked={selected.has(course.id)} /> {course.code}
      </label>)}
    </fieldset>
    {active.ambiguousPredecessors.length ? <p id={ids.ambiguous} className="empty-note">
      Die ausgewählten Kurse sind unterschiedlich weit geplant: {active.ambiguousPredecessors
        .map((entry) => entry.endDate
          ? `${entry.code} bis ${formatCalendarDay(entry.endDate, { weekday: true })}`
          : `${entry.code} noch ohne Kursphase`)
        .join(", ")}. Startdatum und Phasentyp bleiben deshalb leer.
    </p> : null}
    <label htmlFor={ids.semester}>Semester</label>
    <select id={ids.semester} name="semester" required defaultValue={values.semester}
      aria-invalid={invalid("semester") || undefined} aria-describedby={invalid("semester") ? ids.error : undefined}>
      {Array.from({ length: semesters }, (_, index) => index + 1).map((entry) => <option key={entry} value={entry}>Semester {entry}</option>)}
    </select>
    <label htmlFor={ids.type}>Phasentyp</label>
    <select id={ids.type} name="type" required defaultValue={values.type}
      aria-invalid={invalid("type") || undefined}
      aria-describedby={[invalid("type") ? ids.error : "", active.ambiguousPredecessors.length ? ids.ambiguous : ""].filter(Boolean).join(" ") || undefined}>
      <option value="" disabled>Bitte wählen</option>
      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
    <DateField label="Startdatum" name="startDate" defaultValue={values.startDate} required
      invalid={invalid("startDate")} errorId={ids.error} hint={periodHint}
      describedBy={active.ambiguousPredecessors.length ? ids.ambiguous : undefined}
      autoFocus={shouldFocusEmptyField && !values.startDate} />
    <DateField label="Enddatum" name="endDate" defaultValue={values.endDate} required
      invalid={invalid("endDate")} errorId={ids.error}
      describedBy={active.ambiguousPredecessors.length ? ids.ambiguous : undefined}
      autoFocus={shouldFocusEmptyField && Boolean(values.startDate) && !values.endDate} />
    <div className="form-actions">
      <button className="button" type="submit" name="afterSave" value="continue" disabled={isPending}>
        {isPending ? "Wird gespeichert …" : "Speichern und weitere erfassen"}
      </button>
      <button className="button button--ghost" type="submit" name="afterSave" value="close" disabled={isPending}>
        Speichern und schließen
      </button>
    </div>
  </form>;
}

export function PhaseSection({ blockPlanId, courses, semesters, semester, overview, phases, context, nextDefaults, issues }: {
  blockPlanId: string;
  courses: PhaseCourse[];
  semesters: number;
  semester: number;
  overview: SemesterEntry[];
  phases: EditablePhase[];
  context: SemesterContext;
  nextDefaults: NextPhaseDefaults;
  issues: PublicationIssue[];
}) {
  type CreateTarget = { courseId: string; from: string };
  const [status, setStatus] = useState<ReactNode>(null);
  const [createOpen, setCreateOpen] = useState(phases.length === 0);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [focusCreateForm, setFocusCreateForm] = useState(false);
  const statusIdBase = useId();
  const createHeadingId = useId();
  const entry = overview[semester - 1];
  const currentState = entry ? semesterWorkState(entry, issues) : null;
  const timelines = courses.map((course) => {
    const coursePhases = phases.filter((phase) => phase.courseId === course.id)
      .toSorted((left, right) => left.startDate.localeCompare(right.startDate));
    const before = context.before.find((item) => item.code === course.code);
    const after = context.after.find((item) => item.code === course.code);
    const gaps = phaseGapsForSemester({ course, phases, semester, semesters, before, after });
    return { course, coursePhases, before, after, gaps };
  });
  const selectedTimeline = createTarget
    ? timelines.find(({ course }) => course.id === createTarget.courseId)
    : undefined;
  const selectedGap = selectedTimeline?.gaps.find((gap) => gap.from === createTarget?.from);
  const createDefaults = selectedTimeline && selectedGap
    ? continuationDefaults(nextDefaults, selectedTimeline.course, semester, selectedGap)
    : nextDefaults;
  // The component identity follows the user's selected target. Server revalidation may change defaults, but must not
  // discard the form's action state or trigger autofocus; the inner token still resets fields after its own save.
  const createFormKey = createTarget ? `${createTarget.courseId}-${createTarget.from}` : "generic";
  const openCreate = (target: CreateTarget | null = null) => {
    setCreateTarget(target);
    setFocusCreateForm(true);
    setCreateOpen(true);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setCreateTarget(null);
    setFocusCreateForm(false);
  };

  return <section className="workspace-panel phase-workspace" aria-labelledby="draft-heading">
    <div className="workspace-heading">
      <div>
        <p className="eyebrow">Studienverlauf</p>
        <h2 id="draft-heading">Kursphasen</h2>
        <p>Wählen Sie ein Semester und ergänzen Sie den Verlauf jedes Kurses ohne zeitliche Lücken.</p>
      </div>
      {!createOpen
        ? <button className="button" type="button" onClick={() => openCreate()}>Kursphase hinzufügen</button>
        : null}
    </div>
    <p role="status">{status ?? ""}</p>

    <nav aria-label="Semester des Blockplans">
      <ul className="semester-bar">{overview.map((item) => {
        const statusId = `${statusIdBase}-${item.semester}`;
        const workState = semesterWorkState(item, issues);
        return <li key={item.semester} data-status={workState.kind}>
          <Link href={phaseWorkspaceUrl(blockPlanId, item.semester)}
            aria-current={item.semester === semester ? "page" : undefined} aria-describedby={statusId}>
            <strong>Semester {item.semester}</strong>
            <span id={statusId}>{workState.label}</span>
          </Link>
        </li>;
      })}</ul>
    </nav>

    <div className="semester-heading">
      <div>
        <p className="eyebrow">Ausgewählt</p>
        <h3>Semester {semester}</h3>
      </div>
      {entry && currentState
        ? <p className={`status-badge status-badge--${currentState.kind}`}>{currentState.label} · {composition(entry, courses.length)}</p>
        : null}
    </div>

    <div className="phase-courses">{timelines.map(({ course, coursePhases, before, after, gaps }) => {
      return <section className="phase-course" aria-labelledby={`course-${course.id}`} key={course.id}>
        <header>
          <h4 id={`course-${course.id}`}>{course.code}</h4>
          <span>{coursePhases.length === 1 ? "1 Kursphase" : `${coursePhases.length} Kursphasen`}</span>
        </header>
        <ul className="phase-timeline">
          {before ? <li className="phase-context-row">
            <span>Vorher</span>
            <strong>{phaseTypeLabel(before.type)}</strong>
            <span>bis {formatCalendarDay(before.endDate, { weekday: true })}</span>
            <Link className="text-link" href={phaseWorkspaceUrl(blockPlanId, before.semester)}>Semester {before.semester}</Link>
          </li> : null}

          {coursePhases.map((phase) => {
            const precedingGaps = gaps.filter((gap) => gap.successor === phase);
            return <Fragment key={phase.id}>
              {precedingGaps.map((gap) => <GapEntry key={gap.from}
                from={gap.from} to={gap.to} days={gap.days}
                onContinue={() => openCreate({ courseId: course.id, from: gap.from })}
              />)}
              <li className="phase-current-row"><CollapsibleEditor
                heading={<>
                  <span className={`phase-badge phase-badge--${phase.type.toLowerCase()}`}>{phaseTypeLabel(phase.type)}</span>
                  <span>{formatCalendarPeriod(phase.startDate, phase.endDate, { weekday: true })}</span>
                  <span className="phase-duration">{formatPeriodDuration(phase.startDate, phase.endDate)}</span>
                </>}
                openLabel={`Kursphase bearbeiten (${course.code}, ${formatCalendarPeriod(phase.startDate, phase.endDate)})`}
                closeLabel={`Bearbeitung schließen (${course.code}, ${formatCalendarPeriod(phase.startDate, phase.endDate)})`}>
                <PhaseEditorForms blockPlanId={blockPlanId} phase={phase} semesters={semesters} openSemester={semester} onSaved={setStatus} />
              </CollapsibleEditor></li>
            </Fragment>;
          })}

          {gaps.filter((gap) => !coursePhases.some((phase) => gap.successor === phase)).map((gap) => <GapEntry key={gap.from}
            from={gap.from} to={gap.to} days={gap.days}
            onContinue={() => openCreate({ courseId: course.id, from: gap.from })}
          />)}

          {after ? <li className="phase-context-row">
            <span>Danach</span>
            <strong>{phaseTypeLabel(after.type)}</strong>
            <span>ab {formatCalendarDay(after.startDate, { weekday: true })}</span>
            <Link className="text-link" href={phaseWorkspaceUrl(blockPlanId, after.semester)}>Semester {after.semester}</Link>
          </li> : null}

          {!coursePhases.length && !gaps.length && !after ? <li className="phase-empty-row">
            Für {course.code} ist in diesem Semester noch keine Kursphase erfasst.
          </li> : null}
        </ul>
      </section>;
    })}</div>

    {createOpen ? <aside className="create-panel" aria-labelledby={createHeadingId}>
      <div className="create-panel__heading">
        <div>
          <p className="eyebrow">Erfassungsmodus</p>
          <h3 id={createHeadingId}>Kursphase hinzufügen</h3>
        </div>
        {phases.length ? <button className="button button--ghost button--compact" type="button" onClick={closeCreate}>Schließen</button> : null}
      </div>
      <CreatePhasesForm key={createFormKey}
        blockPlanId={blockPlanId} courses={courses} semesters={semesters} semester={semester}
        defaults={createDefaults} focusOnOpen={focusCreateForm} onSaved={setStatus} onClose={closeCreate} />
    </aside> : null}
  </section>;
}
