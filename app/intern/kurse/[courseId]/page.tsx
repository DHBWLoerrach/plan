import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { CourseCalendar } from "@/components/course-calendar";
import { DeleteCourseForm, EditCourseForm } from "@/components/course-forms";
import { CourseEventEditor, CoursePhaseEditor } from "@/components/course-plan-editor";
import { CoursePublicationControls } from "@/components/course-publication-controls";
import { CourseViewSwitch } from "@/components/course-view-switch";
import { InternalNav } from "@/components/internal-nav";
import { PlanEventTable, PlanMatrix } from "@/components/plan-matrix";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { comparisonScope, comparisonScopes, coursePath, type ComparisonScope } from "@/lib/domain/course-comparison";
import { calendarEventsForView, courseCalendarView, normalizeCalendarAnchor, type CourseCalendarView } from "@/lib/domain/course-calendar";
import { publicationStateLabels } from "@/lib/domain/course-status";
import { validatePublication, type PlanEvent, type PlanPhase } from "@/lib/domain/publication";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { readCourseCalendar } from "@/lib/services/course-calendar-feed";

import { searchParam } from "../../search-params";
import { coursePlanData, findInternalCourse, programOptions, type InternalCourse, type PlanCourse } from "../data";

/**
 * The comparison is chosen anew on every visit and never stored, so it lives in the address alone. Links rather than a
 * form: each option is a page of its own that can be shared, bookmarked and reached without JavaScript. It stands above
 * both sections it governs — course progression and dates alike are read against the same set of courses, while the
 * selection of visible matrix columns belongs to the matrix and stays in its head.
 */
function ComparisonSwitch({ courseId, scope, shown }: { courseId: string; scope: ComparisonScope; shown: number }) {
  const current = comparisonScopes.find((entry) => entry.scope === scope)!;
  return <div className="comparison-switch">
    <p className="comparison-switch__label" id="comparison-label">Vergleich mit:</p>
    <ul className="comparison-switch__options" aria-labelledby="comparison-label">
      {comparisonScopes.map((entry) => <li key={entry.scope}>
        <Link href={coursePath(courseId, entry.scope)} aria-current={entry.scope === scope ? "page" : undefined}>{entry.label}</Link>
      </li>)}
    </ul>
    <p className="comparison-switch__hint">
      {current.description} {shown ? `Zurzeit ${shown === 1 ? "steht 1 Kurs" : `stehen ${shown} Kurse`} daneben.` : "Zurzeit steht kein weiterer Kurs daneben."}
    </p>
  </div>;
}

/** The open points of one course: the publication rules its current plan violates (ADR 0012). */
function courseIssues(course: PlanCourse, phases: PlanPhase[], events: PlanEvent[]) {
  return validatePublication({
    course,
    phases: phases.filter((phase) => phase.courseId === course.id),
    events: events.filter((event) => event.courseIds.includes(course.id)),
  });
}

type CourseHeadingData = Pick<InternalCourse, "code" | "program" | "areaName" | "studyStart" | "studyEnd" | "state">;

function CourseHeading({ course }: { course: CourseHeadingData }) {
  return <>
    <p className="eyebrow">Interner Bereich</p>
    <h1>Kurs {course.code}</h1>
    <p>{course.program} · Bereich {course.areaName} · Studienzeitraum {formatCalendarPeriod(course.studyStart, course.studyEnd)} · {publicationStateLabels[course.state]}</p>
  </>;
}

async function CourseCalendarContent({ courseId, courseCode, anchor, view }: { courseId: string; courseCode: string; anchor: string; view: CourseCalendarView }) {
  const result = await readCourseCalendar(courseCode);
  const initialResult = result.kind === "available"
    ? { kind: "available" as const, events: calendarEventsForView(result.events, anchor, view) }
    : result;
  return <CourseCalendar courseId={courseId} initialAnchor={anchor} initialView={view} initialResult={initialResult} />;
}

export default async function CoursePage({ params, searchParams }: PageProps<"/intern/kurse/[courseId]">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  // Reading across areas is a permission of Bereichsbearbeitung and Systemadministration, not of every session (ADR 0011).
  if (!managesAnyArea(account)) redirect("/intern");
  const { courseId } = await params;
  const raw = await searchParams;
  const selectedCalendarView = courseCalendarView(searchParam(raw, "kalender"));

  if (selectedCalendarView) {
    const course = findInternalCourse(sqlite, courseId, account);
    if (!course) notFound();
    const anchor = normalizeCalendarAnchor(searchParam(raw, "datum"), berlinCalendarDay());
    return <SiteShell nav={<InternalNav account={account} current="kurse" />}><article className="plan-detail">
      <CourseHeading course={course} />
      <CourseViewSwitch courseId={course.id} current="calendar" />
      <Suspense fallback={<p role="status">Vorlesungskalender wird geladen…</p>}>
        <CourseCalendarContent courseId={course.id} courseCode={course.code} anchor={anchor} view={selectedCalendarView} />
      </Suspense>
      <p className="plan-detail__back"><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
    </article></SiteShell>;
  }

  const scope = comparisonScope(searchParam(raw, "vergleich"));
  const plan = coursePlanData(sqlite, account, courseId, scope);
  if (!plan) notFound();
  const { course, comparison, phases, events } = plan;
  const created = searchParam(raw, "angelegt") === "1";
  const courses = [course, ...comparison];
  /* Marked in the matrix is every course whose plan is not published yet, so no progression is read as settled
     (ADR 0011) — the edited one included, although it names its state twice on the page around this already. One rule
     for every column is what makes the heading readable: were the edited column exempt, a missing mark would mean
     „published“ beside it and „not covered here“ on it. */
  const unpublishedCourseIds = courses.filter((candidate) => candidate.state === "UNPUBLISHED").map((candidate) => candidate.id);
  /* Without a course beside it, the chronological table would hold exactly the dates the editable list below holds,
     in exactly the same order. It is kept wherever it says more than that list — and for a foreign course it says
     everything, because there is no editable list at all. */
  const chronology = !course.editable || comparison.length > 0;

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><article className="plan-detail">
    <CourseHeading course={course} />
    {created ? <p role="status">Der Kurs wurde angelegt.</p> : null}

    <CourseViewSwitch courseId={course.id} current="plan" />

    {/* Everything that writes is reserved to the own areas (ADR 0011). A foreign course therefore carries neither
        publication, nor lists, nor course details, and says once — here, where they would have stood — why. */}
    {course.editable
      ? <CoursePublicationControls courseId={course.id} updatedAt={course.updatedAt} publishedAt={course.publishedAt} issues={courseIssues(course, phases, events).map((issue) => issue.message)} />
      : <p className="notice">Dieser Kurs gehört zum Bereich {course.areaName}, der Ihnen nicht zugeordnet ist: Sie können ihn lesen, aber nicht bearbeiten, löschen oder veröffentlichen.</p>}

    <ComparisonSwitch courseId={course.id} scope={scope} shown={comparison.length} />

    <PlanMatrix courses={courses} phases={phases} primaryCourseId={course.id} unpublishedCourseIds={unpublishedCourseIds}>
      {course.editable ? <CoursePhaseEditor course={course} comparison={comparison} phases={phases} /> : null}
    </PlanMatrix>

    <PlanEventTable courses={courses} phases={phases} events={events} chronology={chronology}>
      {course.editable ? <CourseEventEditor course={course} comparison={comparison} events={events} /> : null}
    </PlanEventTable>

    {course.editable ? <section className="workspace-panel" aria-labelledby="course-details-heading">
      <h2 id="course-details-heading">Kursangaben</h2>
      <details className="disclosure">
        <summary><span className="disclosure__summary">Kursangaben ändern</span></summary>
        <div className="disclosure__body">
          <EditCourseForm courseId={course.id} programs={programOptions(sqlite, account)} course={{ code: course.code, programId: course.programId, studyStart: course.studyStart, studyEnd: course.studyEnd }} published={course.state === "PUBLISHED"} />
        </div>
      </details>

      <h3>Löschen</h3>
      {course.publishedAt
        ? <p className="empty-note">Dieser Kurs ist öffentlich sichtbar und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung oben zuerst zurück.</p>
        : <DeleteCourseForm courseId={course.id} code={course.code} />}
    </section> : null}

    <p className="plan-detail__back"><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </article></SiteShell>;
}
