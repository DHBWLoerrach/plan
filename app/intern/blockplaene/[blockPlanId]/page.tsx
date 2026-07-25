import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { AttachCourseForm, DeleteBlockPlanForm, DetachCourseForm, RenameBlockPlanForm } from "@/components/block-plan-forms";
import { type EventEntry, EventSection } from "@/components/event-section";
import { PhaseSection } from "@/components/phase-section";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { type DraftEvent, deriveEventSemester } from "@/lib/domain/publication";
import { nextPhaseDefaults, semesterContext } from "@/lib/domain/phase-sequence";
import { semesterOverview } from "@/lib/domain/semester-overview";
import { getActiveAccount } from "@/lib/internal-auth";
import { listAttachableCourses, maximumCoursesPerBlockPlan } from "@/lib/services/block-plan-admin";

import { type PlanPhase, blockPlanCourses, blockPlanDraftEvents, blockPlanDraftPhases, publicationStateLabel } from "../data";
import { searchParam } from "../../kurse/data";
import { publishAction, withdrawAction } from "../../actions";

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
  const plan = sqlite.prepare(`SELECT plan.id, plan.name, plan.area_id AS areaId, area.name AS areaName, plan.draft_updated_at AS draftUpdatedAt,
      plan.has_ever_been_published AS hasEverBeenPublished, version.id AS versionId,
      editor.email AS draftUpdatedBy
    FROM block_plans plan JOIN areas area ON area.id = plan.area_id
    LEFT JOIN user editor ON editor.id = plan.draft_updated_by_account_id
    LEFT JOIN published_versions version ON version.block_plan_id = plan.id WHERE plan.id = ?`).get(blockPlanId) as
    | { id: string; name: string | null; areaId: string; areaName: string; draftUpdatedAt: string; hasEverBeenPublished: number; versionId: string | null; draftUpdatedBy: string | null }
    | undefined;
  if (!plan) notFound();
  if (!account.systemAdmin && !account.areaIds.includes(plan.areaId)) notFound();

  const query = await searchParams;
  const created = searchParam(query, "angelegt") === "1";
  const courses = blockPlanCourses(plan.id);
  const displayName = blockPlanDisplayName(plan.name, courses);
  const derivedName = blockPlanDisplayName(null, courses);
  const publicationState = publicationStateLabel({ hasEverBeenPublished: Boolean(plan.hasEverBeenPublished), publishedVersionId: plan.versionId });
  const attachable = courses.length < maximumCoursesPerBlockPlan ? listAttachableCourses(sqlite, plan.id) : [];
  const phases = blockPlanDraftPhases(plan.id);
  const events = blockPlanDraftEvents(plan.id);
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
  // Assigned courses share year and duration, so identical periods are named once instead of per course.
  const studyPeriods = [...new Set(courses.map((course) => formatCalendarPeriod(course.studyStart, course.studyEnd)))];

  return <SiteShell><article className="plan-detail">
    <p className="eyebrow">Interner Entwurf</p>
    <h1>{displayName}</h1>
    {created ? <p role="status">Der Blockplan wurde mit dem Kurs {courses[0]?.code} angelegt.</p> : null}
    <p className="plan-area">{plan.areaName} · Jahrgang {courses[0]?.studyStart.slice(0, 4)}</p>
    <dl className="course-list">
      <dt>Zugeordnete Kurse</dt><dd>{courses.map((course) => <span key={course.id}>{course.code}</span>)}</dd>
      <dt>Studienzeitraum</dt><dd>{studyPeriods.map((period) => <span key={period}>{period}</span>)}</dd>
      <dt>Veröffentlichungszustand</dt><dd>{publicationState}</dd>
      <dt>Letzte Entwurfsänderung</dt><dd>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(plan.draftUpdatedAt))}{plan.draftUpdatedBy ? ` durch ${plan.draftUpdatedBy}` : ""}</dd>
    </dl>

    {requestedSemester && !knownSemester
      ? <p role="status">Semester {requestedSemester} gibt es in diesem Blockplan nicht. Angezeigt wird Semester 1.</p>
      : null}
    {/* Keyed on the semester: switching semesters must reset the section's own client state (the status
        message and the create form's in-progress values), not just receive new props. */}
    <PhaseSection key={semester} blockPlanId={plan.id} courses={courses} semesters={semesters} semester={semester}
      overview={overview} phases={semesterPhases} context={context} nextDefaults={nextDefaults} />

    <EventSection blockPlanId={plan.id} courses={courses} entries={entries} missingPhaseSemester={missingPhaseSemester} />

    <section aria-labelledby="publication-heading">
      <h2 id="publication-heading">Veröffentlichung</h2>
      <p>Zustand: {publicationState}</p>
      {plan.versionId ? <form action={withdrawAction}><input type="hidden" name="blockPlanId" value={plan.id} /><input type="hidden" name="publishedVersionId" value={plan.versionId} /><button className="button" type="submit">Veröffentlichung zurücknehmen</button></form> : null}
      <form action={publishAction}><input type="hidden" name="blockPlanId" value={plan.id} /><input type="hidden" name="draftUpdatedAt" value={plan.draftUpdatedAt} /><input type="hidden" name="publishedVersionId" value={plan.versionId ?? ""} /><button className="button" type="submit">Entwurf veröffentlichen</button></form>
      <p>Beim Veröffentlichen wird der gespeicherte Entwurf erneut geprüft und als eigenständige öffentliche Fassung kopiert.</p>
    </section>

    <details className="plan-settings">
      <summary>Planeinstellungen</summary>
      <p>Bezeichnung, Kurszuordnung und Löschung ändern Sie selten — meist nur beim Anlegen des Blockplans.</p>

      <section aria-labelledby="name-heading">
        <h2 id="name-heading">Bezeichnung</h2>
        <RenameBlockPlanForm blockPlanId={plan.id} name={plan.name} derivedName={derivedName} />
      </section>

      <section aria-labelledby="courses-heading">
        <h2 id="courses-heading">Kurse</h2>
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

      <section aria-labelledby="delete-heading">
        <h2 id="delete-heading">Löschen</h2>
        {plan.versionId
          ? <p className="empty-note">Dieser Blockplan besitzt eine veröffentlichte Fassung und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung zuerst zurück.</p>
          : <DeleteBlockPlanForm blockPlanId={plan.id} displayName={displayName} courseCodes={courses.map((course) => course.code)} />}
      </section>
    </details>

    <p><Link className="text-link" href="/intern">Zurück zu den Blockplänen</Link></p>
  </article></SiteShell>;
}
