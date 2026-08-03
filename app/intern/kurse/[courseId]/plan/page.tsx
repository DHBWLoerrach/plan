import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { CoursePlanEditor } from "@/components/course-plan-editor";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { comparisonScope, comparisonScopes, coursePlanPath, type ComparisonScope } from "@/lib/domain/course-comparison";
import { areaAccessLabel, publicationStateLabels, workInProgressLabel } from "@/lib/domain/course-status";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { searchParam } from "../../../search-params";
import { coursePlanData, type PlanCourse } from "../../data";

/**
 * The comparison is chosen anew on every visit and never stored, so it lives in the address alone. Links rather than a
 * form: each option is a page of its own that can be shared, bookmarked and reached without JavaScript.
 */
function ComparisonSwitch({ courseId, scope, shown }: { courseId: string; scope: ComparisonScope; shown: number }) {
  const current = comparisonScopes.find((entry) => entry.scope === scope)!;
  return <div className="comparison-switch">
    <p className="comparison-switch__label" id="comparison-label">Vergleich mit:</p>
    <ul className="comparison-switch__options" aria-labelledby="comparison-label">
      {comparisonScopes.map((entry) => <li key={entry.scope}>
        <Link href={coursePlanPath(courseId, entry.scope)} aria-current={entry.scope === scope ? "page" : undefined}>{entry.label}</Link>
      </li>)}
    </ul>
    <p className="comparison-switch__hint">
      {current.description} {shown ? `Zurzeit ${shown === 1 ? "steht 1 Kurs" : `stehen ${shown} Kurse`} daneben.` : "Zurzeit steht kein weiterer Kurs daneben."}
    </p>
  </div>;
}

/**
 * What this course's state means for whoever opened it: whether it may be written to here, and whether its plan may
 * still be incomplete. For a foreign course both are one situation and are said in one sentence — this page is the
 * whole course, so the reason one may only read stands here rather than on a page one no longer passes (ADR 0011).
 */
function PlanNotice({ course }: { course: PlanCourse }) {
  if (course.editable) {
    return course.workInProgress ? <p className="notice">Dieser Kurs ist nicht veröffentlicht. Er darf einen unvollständigen Planungsstand enthalten.</p> : null;
  }
  return <p className="notice">Dieser Kurs gehört zum Bereich {course.areaName}, der Ihnen nicht zugeordnet ist: Sie können ihn lesen, aber nicht bearbeiten, löschen oder veröffentlichen{course.workInProgress ? ", und sein noch unveröffentlichter Planungsstand darf unvollständig sein" : ""}.</p>;
}

export default async function CoursePlanPage({ params, searchParams }: PageProps<"/intern/kurse/[courseId]/plan">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  // Reading across areas is a permission of Bereichsbearbeitung and Systemadministration, not of every session (ADR 0011).
  if (!managesAnyArea(account)) redirect("/intern");
  const { courseId } = await params;
  const scope = comparisonScope(searchParam(await searchParams, "vergleich"));
  const plan = coursePlanData(sqlite, account, courseId, scope);
  if (!plan) notFound();
  const { course } = plan;

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><article className="plan-detail">
    <p className="eyebrow">Interne Bearbeitung</p>
    <h1>Planungsstand {course.code}</h1>
    <p>{course.program} · Bereich {course.areaName} · Studienzeitraum {course.studyStart} – {course.studyEnd} · {areaAccessLabel(course.editable)} · {publicationStateLabels[course.state]}{course.workInProgress ? ` · ${workInProgressLabel}` : ""}</p>
    <PlanNotice course={course} />
    <ComparisonSwitch courseId={course.id} scope={scope} shown={plan.comparison.length} />
    <CoursePlanEditor course={course} comparison={plan.comparison} phases={plan.phases} events={plan.events} />
    {/* A foreign course has no page behind this one — the course address leads back here — so the way out is the list. */}
    <p className="plan-detail__back">{course.editable
      ? <Link className="text-link" href={`/intern/kurse/${course.id}`}>Zurück zum Kurs {course.code}</Link>
      : <Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link>}</p>
  </article></SiteShell>;
}
