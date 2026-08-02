"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { type CourseFormState, createGeneratedCourseAction } from "@/app/intern/kurse/actions";
import { isCalendarDay, plusDays } from "@/lib/domain/calendar-day";
import { formatCalendarPeriod, formatPeriodDuration, weekdayName } from "@/lib/domain/calendar-format";
import { courseCodeYear, generateCoursePlan, type PlannedPhase, proposedStudyEnd, proposedStudyStart } from "@/lib/domain/generated-course-plan";
import { type PhaseType, phaseTypeLabel, phaseTypes } from "@/lib/domain/phase-type";

type Program = { id: string; label: string; semesters: number };

/** The two phase types as the choice of the starting phase presents them: what they are and where they take place. */
const startPhaseChoices: { value: PhaseType; note: string }[] = [
  { value: "THEORY", note: "Start an der Hochschule" },
  { value: "PRACTICE", note: "Start im Dualen Partnerunternehmen" },
];

/** A calendar day field that follows a value computed elsewhere, naming the weekday of the day it currently holds. */
function PeriodField({ label, name, value, hint, onChange }: { label: string; name: string; value: string; hint: string; onChange: (value: string) => void }) {
  const ids = { field: useId(), hint: useId() };
  const weekday = isCalendarDay(value) ? weekdayName(value) : "";
  return <div className="period-field">
    <label htmlFor={ids.field}>{label}</label>
    <input id={ids.field} name={name} type="date" required value={value} aria-describedby={ids.hint}
      onChange={(event) => onChange(event.target.value)} />
    <p id={ids.hint} className="field-hint">{weekday ? `${weekday} · ` : ""}{hint}</p>
  </div>;
}

/**
 * Creating a course with a generated course progression — the second of the two ways.
 *
 * Everything shown is derived during rendering: the study period from the course code and the study program, the
 * course progression from the study period and the starting phase. Adjusted phases are therefore kept together with
 * the state they were adjusted in, and any change to that state returns the progression to the generated one. What is
 * written is checked again on the server from the same rules.
 */
export function GeneratedCourseForm({ programs, today }: { programs: Program[]; today: string }) {
  const [state, formAction, isPending] = useActionState<CourseFormState, FormData>(createGeneratedCourseAction, {});
  const [code, setCode] = useState("");
  const [programId, setProgramId] = useState(programs.length === 1 ? programs[0].id : "");
  const [startType, setStartType] = useState<PhaseType>("THEORY");
  const [studyStartEdit, setStudyStartEdit] = useState<string | null>(null);
  const [studyEndEdit, setStudyEndEdit] = useState<string | null>(null);
  const [adjusted, setAdjusted] = useState<{ signature: string; phases: PlannedPhase[] } | null>(null);
  const [boundaryError, setBoundaryError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [openPhase, setOpenPhase] = useState<number | null>(null);
  const ids = { code: useId(), program: useId(), plan: useId() };

  const semesters = programs.find((program) => program.id === programId)?.semesters ?? 6;
  const codeYear = courseCodeYear(code, today);
  const studyStart = studyStartEdit ?? proposedStudyStart(code, today);
  const studyEnd = studyEndEdit ?? (isCalendarDay(studyStart) ? proposedStudyEnd(studyStart, semesters) : "");
  const periodComplete = isCalendarDay(studyStart) && isCalendarDay(studyEnd) && studyStart < studyEnd;

  const signature = `${studyStart}|${studyEnd}|${semesters}|${startType}`;
  const generated = useMemo(
    () => (periodComplete ? generateCoursePlan({ studyStart, studyEnd, semesters, startType }) : []),
    // The signature holds exactly the four values the generation reads; listing them again would repeat it.
    [signature, periodComplete], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const phases = adjusted?.signature === signature ? adjusted.phases : generated;
  const untouched = adjusted?.signature !== signature;

  /**
   * Moves the boundary between two neighbouring phases: one fact, held by both of them, so the following phase starts
   * again on the day after. Study start and study end are not boundaries of this kind and stay where the period puts
   * them.
   */
  function moveBoundary(index: number, endDate: string) {
    const next = phases[index + 1];
    if (!isCalendarDay(endDate) || !next) return;
    const refusal = endDate < phases[index].startDate ? `Die Grenze der Phase ${index + 1} darf nicht vor deren Beginn liegen.`
      : endDate >= next.endDate ? `Die Grenze der Phase ${index + 1} würde die folgende Kursphase vollständig verdrängen.` : "";
    setBoundaryError(refusal);
    // A refused day would otherwise stay in the field it was typed into: the progression does not change, so React has
    // nothing to render anew. Counting the attempt re-keys the fields, and they hold the progression again.
    setAttempt((count) => count + 1);
    if (refusal) return;
    setAdjusted({
      signature,
      phases: phases.map((phase, position) => position === index ? { ...phase, endDate }
        : position === index + 1 ? { ...phase, startDate: plusDays(endDate, 1) } : phase),
    });
  }

  function changePhase(index: number, change: Partial<PlannedPhase>) {
    setBoundaryError("");
    setAdjusted({ signature, phases: phases.map((phase, position) => position === index ? { ...phase, ...change } : phase) });
  }

  const startHint = codeYear !== undefined
    ? `aus „${codeYear}“ in der Kurskennung`
    : studyStartEdit === null ? "nächster 1. Oktober" : "selbst gesetzt";
  const endHint = studyEndEdit === null ? `${semesters} Semester ab Studienbeginn` : "selbst gesetzt";

  return <form action={formAction} className="generated-form">
    <div className="editor-card">
      <h2>Kursangaben</h2>
      <div className="account-form">
        <label htmlFor={ids.code}>Kurskennung</label>
        <input id={ids.code} name="code" type="text" required maxLength={32} value={code} autoComplete="off"
          placeholder="z. B. TIF26A" onChange={(event) => setCode(event.target.value)} />
        <p className="field-hint">Eine Jahreszahl in der Kurskennung belegt den Studienbeginn vor.</p>
        <label htmlFor={ids.program}>Studiengang</label>
        <select id={ids.program} name="programId" required value={programId} onChange={(event) => setProgramId(event.target.value)}>
          <option value="" disabled>Bitte wählen</option>
          {programs.map((program) => <option key={program.id} value={program.id}>{program.label}</option>)}
        </select>
        <p className="field-hint">{programId
          ? `Der Studiengang bestimmt mit ${semesters} Semestern Studienende und Anzahl der Kursphasen.`
          : `Der Studiengang bestimmt mit seiner Anzahl Semester Studienende und Anzahl der Kursphasen. Bis zur Wahl rechnet der Vorschlag mit ${semesters} Semestern.`}</p>
      </div>
    </div>

    <div className="editor-card">
      <h2>Studienzeitraum <span className="proposal-tag">Vorschlag</span></h2>
      <p>Aus dem Jahrgang vorbelegt und unmittelbar änderbar.</p>
      <div className="period-fields">
        <PeriodField label="Studienbeginn" name="studyStart" value={studyStart} hint={startHint} onChange={setStudyStartEdit} />
        <PeriodField label="Studienende" name="studyEnd" value={studyEnd} hint={endHint} onChange={setStudyEndEdit} />
      </div>
    </div>

    <fieldset className="editor-card start-phase">
      <legend><h2>Startphase</h2></legend>
      <p>Danach wechseln Theorie und Praxis mit jeder Kursphase.</p>
      <div className="start-phase__options">
        {startPhaseChoices.map((choice) => <label key={choice.value}>
          <input type="radio" name="startType" value={choice.value} checked={startType === choice.value}
            onChange={() => setStartType(choice.value)} />
          <span><strong>{phaseTypeLabel(choice.value)}phase</strong><span className="start-phase__note">{choice.note}</span></span>
        </label>)}
      </div>
    </fieldset>

    <div className="editor-card">
      <h2>Studienplan <span className="proposal-tag">automatisch erzeugt</span></h2>
      <p id={ids.plan} role="status">{phases.length
        ? `${semesters} Semester · ${phases.length} Kursphasen · lückenlos über den Studienzeitraum ${formatCalendarPeriod(studyStart, studyEnd)}${untouched ? "" : " · von Ihnen angepasst"}`
        : periodComplete
          ? "Der Studienzeitraum ist zu kurz für zwei Kursphasen je Semester. Verlängern Sie ihn."
          : "Sobald Studienbeginn und Studienende feststehen, steht hier der erzeugte Kursverlauf."}</p>
      {phases.length ? <>
        <p className="plan-actions">
          <button className="button button--ghost button--compact" type="button" disabled={untouched}
            onClick={() => { setAdjusted(null); setBoundaryError(""); }}>Neu berechnen</button>
          <span className="field-hint">Verwirft eigene Anpassungen. Eine Änderung an Zeitraum, Studiengang oder Startphase tut dies ebenfalls.</span>
        </p>
        {boundaryError ? <p role="alert">{boundaryError}</p> : null}
        <ol className="plan-preview" aria-describedby={ids.plan}>
          {phases.map((phase, index) => {
            const open = openPhase === index;
            const first = index === 0;
            const last = index === phases.length - 1;
            return <li key={index} className="plan-preview__item">
              <p className="plan-preview__semester">{phase.semester === phases[index - 1]?.semester ? "" : `${phase.semester}. Semester`}</p>
              <div className="plan-preview__phase" data-phase={phase.type === "THEORY" ? "theory" : "practice"}>
                <p className="plan-preview__title"><strong>{phaseTypeLabel(phase.type)}phase</strong> <span>Phase {index + 1}</span></p>
                <p className="plan-preview__period">{formatCalendarPeriod(phase.startDate, phase.endDate, { weekday: true })} · {formatPeriodDuration(phase.startDate, phase.endDate)}</p>
                <button className="button button--ghost button--compact" type="button" aria-expanded={open}
                  onClick={() => setOpenPhase(open ? null : index)}>{open ? "Fertig" : "Anpassen"}<span className="sr-only"> — Phase {index + 1}</span></button>
                {open ? <div className="plan-preview__editor" key={attempt}>
                  <label>Phasentyp
                    <select value={phase.type} onChange={(event) => changePhase(index, { type: event.target.value as PhaseType })}>
                      {phaseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label>Semester
                    <select value={phase.semester} onChange={(event) => changePhase(index, { semester: Number(event.target.value) })}>
                      {Array.from({ length: semesters }, (_, position) => position + 1).map((semester) => <option key={semester} value={semester}>{semester}</option>)}
                    </select>
                  </label>
                  <label>Beginn
                    {first
                      ? <input type="date" value={phase.startDate} readOnly aria-describedby={`${ids.plan}-fixed`} />
                      : <input type="date" value={phase.startDate} onChange={(event) => moveBoundary(index - 1, plusDays(event.target.value, -1))} />}
                  </label>
                  <label>Ende
                    {last
                      ? <input type="date" value={phase.endDate} readOnly aria-describedby={`${ids.plan}-fixed`} />
                      : <input type="date" value={phase.endDate} onChange={(event) => moveBoundary(index, event.target.value)} />}
                  </label>
                  <p className="field-hint">{first || last
                    ? "Studienbeginn und Studienende gehören zum Studienzeitraum und werden oben geändert."
                    : "Eine verschobene Grenze verschiebt die angrenzende Kursphase mit, damit der Kursverlauf lückenlos bleibt."}</p>
                </div> : null}
              </div>
            </li>;
          })}
        </ol>
        <p id={`${ids.plan}-fixed`} className="sr-only">Dieses Datum stammt aus dem Studienzeitraum und wird dort geändert.</p>
      </> : null}
    </div>

    <input type="hidden" name="plan" value={JSON.stringify(phases)} />
    {/* The progression stays whole above; what follows the reading is the action that writes it, together with the
        summary of what it would write. Neither repeats a decision — both only make the last one reachable. */}
    <div className="generated-form__actions">
      {state.error ? <p role="alert">{state.error}</p> : null}
      <p className="generated-form__summary">{phases.length
        ? `${code.trim() || "Kurs"} · ${semesters} Semester · ${phases.length} Kursphasen · ${formatCalendarPeriod(studyStart, studyEnd)}`
        : "Noch kein vollständiger Kursverlauf."}</p>
      <button className="button" type="submit" disabled={isPending || !phases.length}>{isPending ? "Kurs wird angelegt …" : "Kurs mit Studienplan anlegen"}</button>
    </div>
  </form>;
}
