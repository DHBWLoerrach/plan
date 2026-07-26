import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { AttachCourseForm, DeleteBlockPlanForm, DetachCourseForm, RenameBlockPlanForm } from "@/components/block-plan-forms";
import { type EventEntry, EventSection } from "@/components/event-section";
import { PhaseSection } from "@/components/phase-section";
import { WithdrawForm } from "@/components/publication-forms";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { type DraftEvent, deriveEventSemester } from "@/lib/domain/publication";
import { nextPhaseDefaults, semesterContext } from "@/lib/domain/phase-sequence";
import { semesterOverview } from "@/lib/domain/semester-overview";
import { getActiveAccount } from "@/lib/internal-auth";
import { listAttachableCourses, maximumCoursesPerBlockPlan } from "@/lib/services/block-plan-admin";
import { publicationIssuesForDraft } from "@/lib/services/publication";

import { type PlanPhase, blockPlanCourses, blockPlanDraftEvents, blockPlanDraftPhases, findInternalBlockPlan, publicationStateLabel } from "../data";
import { searchParam } from "../../kurse/data";

type WorkspaceView = "kursphasen" | "termine" | "einstellungen";

function workspaceUrl(blockPlanId: string, view: WorkspaceView, semester?: number): string {
  const query = new URLSearchParams({ ansicht: view });
  if (view === "kursphasen" && semester) query.set("semester", String(semester));
  return `/intern/blockplaene/${blockPlanId}?${query}`;
}

/**
 * Groups the affected courses of an event by the semester derived from their course phases. In an incomplete draft a
 * phase covering the start day may be missing; that group then says so instead of hiding the gap.
 */
function eventEntries(events: DraftEvent[], phases: PlanPhase[], courseCodes: Map<string, string>): EventEntry[] {
  return events.map((event) => {
    const bySemester = new Map<number | null, string[]>();
    for (const courseId of event.courseIds) {
      const semester = deriveEventSemester(phases, courseId, event.startDate);
      const codes = bySemester.get(semester) ?? [];
      codes.push(courseCodes.get(courseId) ?? courseId);
      bySemester.set(semester, codes);
    }
    return {
      event,
      derived: [...bySemester].map(([semester, codes]) => ({ semester, codes })),
    };
  });
}

export default async function InternalBlockPlanPage({ params, searchParams }: PageProps<"/intern/blockplaene/[blockPlanId]">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const { blockPlanId } = await params;
  const plan = findInternalBlockPlan(sqlite, blockPlanId, account);
  if (!plan) notFound();

  const query = await searchParams;
  const created = searchParam(query, "angelegt") === "1";
  const published = searchParam(query, "veroeffentlicht") === "1";
  const withdrawn = searchParam(query, "zurueckgenommen") === "1";
  const versionOutdated = searchParam(query, "fassung-veraltet") === "1";
  const requestedView = searchParam(query, "ansicht");
  const view: WorkspaceView = requestedView === "termine" || requestedView === "einstellungen" ? requestedView : "kursphasen";
  const courses = blockPlanCourses(sqlite, plan.id);
  const displayName = blockPlanDisplayName(plan.name, courses);
  const derivedName = blockPlanDisplayName(null, courses);
  const publicationState = publicationStateLabel({ hasEverBeenPublished: Boolean(plan.hasEverBeenPublished), publishedVersionId: plan.versionId });
  const attachable = courses.length < maximumCoursesPerBlockPlan ? listAttachableCourses(sqlite, plan.id) : [];
  const phases = blockPlanDraftPhases(sqlite, plan.id);
  const events = blockPlanDraftEvents(sqlite, plan.id);
  const publicationIssues = publicationIssuesForDraft(sqlite, plan.id, { courses, phases, events });
  const courseCodes = new Map(courses.map((course) => [course.id, course.code]));
  // Every assigned course carries the same number of semesters (FACHLICHE_REGELN.md), so the first one answers for the plan.
  const semesters = courses[0]?.semesters ?? 0;
  const overview = semesterOverview(courses, phases, semesters);
  const requestedSemester = searchParam(query, "semester");
  const knownSemester = overview.some((entry) => entry.semester === Number(requestedSemester));
  const semester = knownSemester ? Number(requestedSemester) : 1;
  const semesterPhases = phases.filter((phase) => phase.semester === semester);
  const context = semesterContext({ courses, phases, semester });
  const nextDefaults = nextPhaseDefaults({ phases, courses, semester });
  const entries = eventEntries(events, phases, courseCodes);
  const missingPhaseSemester = overview.find((item) => item.codesWithoutPhase.length)?.semester ?? null;
  // Course attachment only requires the same Jahrgang and Studiendauer (FACHLICHE_REGELN.md), not identical
  // start/end days, so the period can diverge between assigned courses; it is the boundary every phase and event is
  // validated against, so a divergence must be visible per course rather than hidden behind a de-duplicated chip.
  const studyPeriods = courses.map((course) => ({ code: course.code, period: formatCalendarPeriod(course.studyStart, course.studyEnd) }));
  const identicalStudyPeriod = new Set(studyPeriods.map((entry) => entry.period)).size <= 1;
  const draftState = publicationIssues.length
    ? publicationIssues.length === 1 ? "Entwurf: 1 offener Punkt" : `Entwurf: ${publicationIssues.length} offene Punkte`
    : "Entwurf ist bereit zur Veröffentlichung";
  const publicState = plan.versionId
    ? plan.publishedAt && plan.draftUpdatedAt > plan.publishedAt
      ? "Veröffentlicht · Entwurf danach geändert"
      : "Veröffentlicht · keine neueren Änderungen"
    : publicationState;

  return <SiteShell><article className="plan-detail">
    <header className="plan-workspace-header">
      <div>
        <p className="eyebrow">Interner Entwurf</p>
        <h1>{displayName}</h1>
        <p className="plan-area">{plan.areaName} · Jahrgang {courses[0]?.studyStart.slice(0, 4)}</p>
      </div>
      <aside className="publication-panel" aria-label="Arbeits- und Veröffentlichungsstand">
        <p className={publicationIssues.length ? "status-badge status-badge--warning" : "status-badge status-badge--ready"}>{draftState}</p>
        <p><strong>{publicState}</strong></p>
        <p>Gespeicherte Änderungen werden erst durch eine Freigabe öffentlich.</p>
        <Link className="button" href={`/intern/blockplaene/${plan.id}/vorschau`}>
          {publicationIssues.length ? "Entwurf prüfen" : "Vorschau und Veröffentlichung"}
        </Link>
        {plan.versionId ? <p><Link className="text-link" href={`/${plan.id}`}>Öffentliche Fassung ansehen</Link></p> : null}
        {plan.versionId
          ? <WithdrawForm blockPlanId={plan.id} publishedVersionId={plan.versionId} displayName={displayName} />
          : null}
      </aside>
    </header>
    {created ? <p role="status">Der Blockplan wurde mit dem Kurs {courses[0]?.code} angelegt.</p> : null}
    {published ? <p role="status">Die Vorschau wurde veröffentlicht. Der Blockplan ist jetzt <Link className="text-link" href={`/${plan.id}`}>öffentlich sichtbar</Link>; der Entwurf bleibt unverändert bearbeitbar.</p> : null}
    {withdrawn ? <p role="status">Die Veröffentlichung wurde zurückgenommen. Der Blockplan ist nicht mehr öffentlich sichtbar; der Entwurf ist vollständig erhalten.</p> : null}
    {versionOutdated ? <p role="alert" className="notice">
      Die Veröffentlichung, die Sie zurücknehmen wollten, war nicht mehr die angezeigte Fassung. Es wurde nichts
      geändert. Hier steht der aktuelle Veröffentlichungszustand: {publicationState}.
    </p> : null}
    <dl className="course-list">
      <dt>Zugeordnete Kurse</dt><dd>{courses.map((course) => <span key={course.id}>{course.code}</span>)}</dd>
      <dt>Studienzeitraum</dt><dd>{identicalStudyPeriod
        ? <span>{studyPeriods[0]?.period}</span>
        : studyPeriods.map((entry) => <span key={entry.code}>{entry.code}: {entry.period}</span>)}</dd>
      <dt>Letzte Entwurfsänderung</dt><dd>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(plan.draftUpdatedAt))}{plan.draftUpdatedBy ? ` durch ${plan.draftUpdatedBy}` : ""}</dd>
    </dl>

    {view === "kursphasen" && requestedSemester && !knownSemester
      ? <p role="status">Semester {requestedSemester} gibt es in diesem Blockplan nicht. Angezeigt wird Semester 1.</p>
      : null}

    <nav className="workspace-nav" aria-label="Arbeitsbereiche des Blockplans">
      <Link href={workspaceUrl(plan.id, "kursphasen", semester)} aria-current={view === "kursphasen" ? "page" : undefined}>
        Kursphasen
      </Link>
      <Link href={workspaceUrl(plan.id, "termine")} aria-current={view === "termine" ? "page" : undefined}>
        Termine <span aria-label={`${events.length} ${events.length === 1 ? "Termin" : "Termine"}`}>{events.length}</span>
      </Link>
      <Link href={workspaceUrl(plan.id, "einstellungen")} aria-current={view === "einstellungen" ? "page" : undefined}>
        Planeinstellungen
      </Link>
    </nav>

    {view === "kursphasen" ? <>
      {/* Keyed on the semester: switching semesters must reset the section's own client state (the status
          message and the create form's in-progress values), not just receive new props. */}
      <PhaseSection key={semester} blockPlanId={plan.id} courses={courses} semesters={semesters} semester={semester}
        overview={overview} phases={semesterPhases} context={context} nextDefaults={nextDefaults} issues={publicationIssues} />
    </> : null}

    {view === "termine"
      ? <EventSection blockPlanId={plan.id} courses={courses} entries={entries} missingPhaseSemester={missingPhaseSemester} />
      : null}

    {view === "einstellungen" ? <section className="workspace-panel plan-settings" aria-labelledby="settings-heading">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Selten benötigte Verwaltung</p>
          <h2 id="settings-heading">Planeinstellungen</h2>
          <p>Hier ändern Sie die Bezeichnung und Kurszuordnung des gesamten Blockplans.</p>
        </div>
      </div>

      <div className="settings-grid">
        <section aria-labelledby="name-heading">
          <h3 id="name-heading">Bezeichnung</h3>
          <RenameBlockPlanForm blockPlanId={plan.id} name={plan.name} derivedName={derivedName} />
        </section>

        <section aria-labelledby="courses-heading">
          <h3 id="courses-heading">Zugeordnete Kurse</h3>
          <ul className="entry-list">{courses.map((course) => <li key={course.id}>
            <p><strong><Link className="text-link" href={`/intern/kurse/${course.id}`}>{course.code}</Link></strong></p>
            <p className="entry-meta">{course.program} · {formatCalendarPeriod(course.studyStart, course.studyEnd)}</p>
            {courses.length > 1
              ? <DetachCourseForm blockPlanId={plan.id} courseId={course.id} code={course.code} />
              : <p className="entry-meta">Letzter Kurs — nicht lösbar</p>}
          </li>)}</ul>
          {courses.length >= maximumCoursesPerBlockPlan
            ? <p className="empty-note">Dieser Blockplan enthält die Höchstzahl von {maximumCoursesPerBlockPlan} Kursen.</p>
            : attachable.length
              ? <AttachCourseForm blockPlanId={plan.id} courses={attachable} />
              : <p className="empty-note">Es gibt derzeit keinen blockplanlosen Kurs mit demselben Bereich, Jahrgang und derselben Studiendauer.</p>}
        </section>
      </div>

      <section className="danger-zone" aria-labelledby="delete-heading">
        <h3 id="delete-heading">Gefahrenbereich</h3>
        <p>Das Löschen betrifft den gesamten Blockplan und kann nicht rückgängig gemacht werden.</p>
        {plan.versionId
          ? <p className="empty-note">Dieser Blockplan besitzt eine veröffentlichte Fassung und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung zuerst zurück.</p>
          : <DeleteBlockPlanForm blockPlanId={plan.id} displayName={displayName} courseCodes={courses.map((course) => course.code)} />}
      </section>
    </section> : null}

    <p><Link className="text-link" href="/intern">Zurück zu den Blockplänen</Link></p>
  </article></SiteShell>;
}
