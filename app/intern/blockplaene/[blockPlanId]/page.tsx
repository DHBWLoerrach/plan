import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { AttachCourseForm, DeleteBlockPlanForm, DetachCourseForm, RenameBlockPlanForm } from "@/components/block-plan-forms";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { blockPlanDisplayName } from "@/lib/domain/block-plan-name";
import { getActiveAccount } from "@/lib/internal-auth";
import { listAttachableCourses, maximumCoursesPerBlockPlan } from "@/lib/services/block-plan-admin";

import { blockPlanCourses, publicationStateLabel } from "../data";
import { searchParam } from "../../kurse/data";
import { publishAction, withdrawAction } from "../../actions";

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

  const created = searchParam(await searchParams, "angelegt") === "1";
  const courses = blockPlanCourses(plan.id);
  const displayName = blockPlanDisplayName(plan.name, courses);
  const derivedName = blockPlanDisplayName(null, courses);
  const publicationState = publicationStateLabel({ hasEverBeenPublished: Boolean(plan.hasEverBeenPublished), publishedVersionId: plan.versionId });
  const attachable = courses.length < maximumCoursesPerBlockPlan ? listAttachableCourses(sqlite, plan.id) : [];
  const phases = sqlite.prepare(`SELECT phase.semester, phase.phase_type AS type, phase.start_date AS startDate, phase.end_date AS endDate, course.code
    FROM draft_phases phase JOIN courses course ON course.id = phase.course_id WHERE phase.block_plan_id = ? ORDER BY phase.semester, phase.start_date`).all(plan.id) as
    { semester: number; type: string; startDate: string; endDate: string; code: string }[];

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

    <section aria-labelledby="draft-heading">
      <h2 id="draft-heading">Gespeicherter Entwurf</h2>
      {phases.length
        ? <table className="event-table">
          <thead><tr><th scope="col">Kurs</th><th scope="col">Semester</th><th scope="col">Zeitraum</th><th scope="col">Phasentyp</th></tr></thead>
          <tbody>{phases.map((phase) => <tr key={`${phase.code}-${phase.semester}-${phase.startDate}`}>
            <td>{phase.code}</td><td>{phase.semester}</td><td>{phase.startDate} – {phase.endDate}</td><td>{phase.type === "THEORY" ? "Theorie" : "Praxis"}</td>
          </tr>)}</tbody>
        </table>
        : <p className="empty-note">Noch keine Kursphasen gespeichert. Ein Entwurf kann erst nach vollständiger Verlaufserfassung veröffentlicht werden.</p>}
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
