import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { AttachCourseForm, DeleteBlockPlanForm, DetachCourseForm, RenameBlockPlanForm } from "@/components/block-plan-forms";
import { CreateEventForm, EventEditor } from "@/components/event-forms";
import { PhaseSection } from "@/components/phase-section";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import { type DraftEvent, deriveEventSemester } from "@/lib/domain/publication";
import { nextPhaseDefaults, semesterContext } from "@/lib/domain/phase-sequence";
import { semesterOverview } from "@/lib/domain/semester-overview";
import { getActiveAccount } from "@/lib/internal-auth";
import { listAttachableCourses, maximumCoursesPerBlockPlan } from "@/lib/services/block-plan-admin";

import { type PlanPhase, blockPlanCourses, blockPlanDraftEvents, blockPlanDraftPhases, publicationStateLabel } from "../data";
import { searchParam } from "../../kurse/data";
import { publishAction, withdrawAction } from "../../actions";

/** Without an end date an event denotes exactly its start day, otherwise the inclusive range (FACHLICHE_REGELN.md). */
function eventPeriod(event: DraftEvent): string {
  return event.endDate ? `${event.startDate} – ${event.endDate}` : event.startDate;
}

/**
 * Names the semester derived from the course phases for every affected course. In an incomplete draft a phase covering
 * the start day may be missing; the working view then says so instead of hiding the gap.
 */
function affectedCourseLabels(event: DraftEvent, phases: PlanPhase[], courseCodes: Map<string, string>): string[] {
  return event.courseIds.map((courseId) => {
    const semester = deriveEventSemester(phases, courseId, event.startDate);
    const code = courseCodes.get(courseId) ?? courseId;
    return semester ? `${code} (Semester ${semester})` : `${code} (Semester noch nicht ableitbar — für den Starttag fehlt eine Kursphase)`;
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
  const eventDeleted = searchParam(query, "termin-geloescht") === "1";
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

  return <SiteShell><article className="plan-detail">
    <p className="eyebrow">Interner Entwurf</p>
    <h1>{displayName}</h1>
    {created ? <p role="status">Der Blockplan wurde mit dem Kurs {courses[0]?.code} angelegt.</p> : null}
    <p className="plan-area">{plan.areaName} · Jahrgang {courses[0]?.studyStart.slice(0, 4)}</p>
    <dl className="course-list">
      <dt>Zugeordnete Kurse</dt><dd>{courses.map((course) => <span key={course.id}>{course.code}</span>)}</dd>
      <dt>Veröffentlichungszustand</dt><dd>{publicationState}</dd>
      <dt>Letzte Entwurfsänderung</dt><dd>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(plan.draftUpdatedAt))}{plan.draftUpdatedBy ? ` durch ${plan.draftUpdatedBy}` : ""}</dd>
    </dl>

    <section aria-labelledby="name-heading">
      <h2 id="name-heading">Bezeichnung</h2>
      <RenameBlockPlanForm blockPlanId={plan.id} name={plan.name} derivedName={derivedName} />
    </section>

    <section aria-labelledby="courses-heading">
      <h2 id="courses-heading">Kurse</h2>
      <table className="event-table">
        <thead><tr><th scope="col">Kurskennung</th><th scope="col">Studiengang</th><th scope="col">Studienzeitraum</th><th scope="col">Zuordnung</th></tr></thead>
        <tbody>{courses.map((course) => <tr key={course.id}>
          <td><Link className="text-link" href={`/intern/kurse/${course.id}`}>{course.code}</Link></td>
          <td>{course.program}</td>
          <td>{course.studyStart} – {course.studyEnd}</td>
          <td>{courses.length > 1
            ? <DetachCourseForm blockPlanId={plan.id} courseId={course.id} code={course.code} />
            : "Letzter Kurs — nicht lösbar"}</td>
        </tr>)}</tbody>
      </table>
      {courses.length >= maximumCoursesPerBlockPlan
        ? <p className="empty-note">Dieser Blockplan enthält die Höchstzahl von {maximumCoursesPerBlockPlan} Kursen.</p>
        : attachable.length
          ? <AttachCourseForm blockPlanId={plan.id} courses={attachable} />
          : <p className="empty-note">Es gibt derzeit keinen blockplanlosen Kurs mit demselben Bereich, Jahrgang und derselben Studiendauer.</p>}
    </section>

    {requestedSemester && !knownSemester
      ? <p role="status">Semester {requestedSemester} gibt es in diesem Blockplan nicht. Angezeigt wird Semester 1.</p>
      : null}
    <PhaseSection blockPlanId={plan.id} courses={courses} semesters={semesters} semester={semester}
      overview={overview} phases={semesterPhases} context={context} nextDefaults={nextDefaults} />

    <section aria-labelledby="events-heading">
      <h2 id="events-heading">Prüfungsrelevante Termine</h2>
      {eventDeleted ? <p role="status">Der Termin wurde aus dem Entwurf gelöscht.</p> : null}
      {events.length
        ? <>
          <div className="matrix-wrap" tabIndex={0}>
            <table className="event-table">
              <thead><tr><th scope="col">Zeitangabe</th><th scope="col">Kategorie</th><th scope="col">Titel</th><th scope="col">Betroffene Kurse und Semester</th></tr></thead>
              <tbody>{events.map((event) => <tr key={event.id}>
                <td>{eventPeriod(event)}{event.provisional ? <span className="provisional">Vorläufig</span> : null}</td>
                <td>{eventCategoryLabel(event.category)}</td>
                <td><strong>{event.title}</strong>{event.description ? <p>{event.description}</p> : null}</td>
                <td>{affectedCourseLabels(event, phases, courseCodes).join(", ")}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {events.map((event) => <EventEditor key={event.id} blockPlanId={plan.id} courses={courses} event={event} />)}
        </>
        : <p className="empty-note">Noch keine prüfungsrelevanten Termine im Entwurf.</p>}
      <h3>Neuen Termin anlegen</h3>
      <CreateEventForm blockPlanId={plan.id} courses={courses} />
    </section>

    <section aria-labelledby="publication-heading">
      <h2 id="publication-heading">Veröffentlichung</h2>
      <p>Zustand: {publicationState}</p>
      {plan.versionId ? <form action={withdrawAction}><input type="hidden" name="blockPlanId" value={plan.id} /><input type="hidden" name="publishedVersionId" value={plan.versionId} /><button className="button" type="submit">Veröffentlichung zurücknehmen</button></form> : null}
      <form action={publishAction}><input type="hidden" name="blockPlanId" value={plan.id} /><input type="hidden" name="draftUpdatedAt" value={plan.draftUpdatedAt} /><input type="hidden" name="publishedVersionId" value={plan.versionId ?? ""} /><button className="button" type="submit">Entwurf veröffentlichen</button></form>
      <p>Beim Veröffentlichen wird der gespeicherte Entwurf erneut geprüft und als eigenständige öffentliche Fassung kopiert.</p>
    </section>

    <section aria-labelledby="delete-heading">
      <h2 id="delete-heading">Löschen</h2>
      {plan.versionId
        ? <p className="empty-note">Dieser Blockplan besitzt eine veröffentlichte Fassung und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung zuerst zurück.</p>
        : <DeleteBlockPlanForm blockPlanId={plan.id} displayName={displayName} courseCodes={courses.map((course) => course.code)} />}
    </section>

    <p><Link className="text-link" href="/intern">Zurück zu den Blockplänen</Link></p>
  </article></SiteShell>;
}
