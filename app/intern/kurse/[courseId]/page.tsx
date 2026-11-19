import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { CourseCalendar } from "@/components/course-calendar";
import { DeleteCourseForm, EditCourseForm } from "@/components/course-forms";
import { CoursePlanWorkspace } from "@/components/course-plan-editor";
import { CoursePublicationControls } from "@/components/course-publication-controls";
import { CourseViewSwitch } from "@/components/course-view-switch";
import { InternalNav } from "@/components/internal-nav";
import { PlanEventTable, PlanMatrix } from "@/components/plan-matrix";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { comparisonScope, comparisonScopes, coursePath, defaultComparisonScope, type ComparisonScope } from "@/lib/domain/course-comparison";
import { calendarEventsForView, courseCalendarView, normalizeCalendarAnchor, type CourseCalendarView } from "@/lib/domain/course-calendar";
import { publicationStateLabels } from "@/lib/domain/course-status";
import { nextYearCourseCode } from "@/lib/domain/generated-course-plan";
import { validatePublication, type PlanEvent, type PlanPhase } from "@/lib/domain/publication";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { readCourseCalendar } from "@/lib/services/course-calendar-feed";

import { searchParam } from "../../search-params";
import { coursePlanData, findCourseIdByCode, findInternalCourse, programOptions, type InternalCourse, type PlanCourse } from "../data";

/**
 * How wide the comparison view reaches. It is chosen anew on every visit and never stored, so it lives in the address
 * alone. Links rather than a form: each option is a page of its own that can be shared, bookmarked and reached without
 * JavaScript. It stands above both tables it governs, while the selection of visible matrix columns belongs to the
 * matrix and stays in its head.
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

/**
 * `state` is left out where the line below the heading names it together with what follows from it: the planning
 * state of a course one may edit carries the publication there, and saying it twice within three lines says nothing.
 */
function CourseHeading({ course, state = true }: { course: CourseHeadingData; state?: boolean }) {
  return <>
    <p className="eyebrow">Interner Bereich</p>
    <h1>Kurs {course.code}</h1>
    <p>{course.program} · Bereich {course.areaName} · Studienzeitraum {formatCalendarPeriod(course.studyStart, course.studyEnd)}{state ? ` · ${publicationStateLabels[course.state]}` : ""}</p>
  </>;
}

async function CourseCalendarContent({ courseId, courseCode, anchor, view }: { courseId: string; courseCode: string; anchor: string; view: CourseCalendarView }) {
  const result = await readCourseCalendar(courseCode);
  const initialResult = result.kind === "available"
    ? { kind: "available" as const, events: calendarEventsForView(result.events, anchor, view) }
    : result;
  return <CourseCalendar courseId={courseId} initialAnchor={anchor} initialView={view} initialResult={initialResult} />;
}

/**
 * The way from a course to the same course of the following year — the one adoption every course of study needs once
 * a year. It leads into the adoption form with this course as the template and everything else proposed, instead of
 * through the choice of a way and a list of every course there is. Where that course exists already, it is linked
 * rather than offered a second time: creating it again would only be refused for its code.
 */
function NextYear({ course }: { course: PlanCourse }) {
  const nextCode = nextYearCourseCode(course.code, berlinCalendarDay());
  const existingId = nextCode ? findCourseIdByCode(sqlite, nextCode) : undefined;
  if (existingId) return <p className="course-next">Nächster Jahrgang: <Link className="text-link" href={coursePath(existingId)}>{nextCode}</Link></p>;
  return <p className="course-next">
    <Link className="button button--ghost" href={`/intern/kurse/neu/vorlage?vorlage=${encodeURIComponent(course.id)}&jahrgang=naechster`}>Für nächsten Jahrgang übernehmen</Link>
    <span>Legt {nextCode ? <strong>{nextCode}</strong> : "einen neuen Kurs"} mit diesem Kursverlauf und diesen Terminen an, um ein Jahr versetzt.</span>
  </p>;
}

const backToList = <p className="plan-detail__back"><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>;

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
      {backToList}
    </article></SiteShell>;
  }

  /* The comparison is a view of its own, told from the planning state by its parameter being there at all: the courses
     of the year side by side, in full and only to be read. Whatever the parameter says that is no known width is the
     default one — a view cannot be wrong. */
  const comparisonParameter = searchParam(raw, "vergleich");
  if (comparisonParameter !== null) {
    const scope = comparisonScope(comparisonParameter);
    const plan = coursePlanData(sqlite, account, courseId, scope);
    if (!plan) notFound();
    const { course, comparison, phases, events } = plan;
    const courses = [course, ...comparison];
    /* Marked in the matrix is every course whose plan is not published yet, so no progression is read as settled
       (ADR 0011) — the one this page belongs to included. One rule for every column is what makes the heading
       readable: were that column exempt, a missing mark would mean „published“ beside it and „not covered here“ on it. */
    const unpublishedCourseIds = courses.filter((candidate) => candidate.state === "UNPUBLISHED").map((candidate) => candidate.id);
    return <SiteShell nav={<InternalNav account={account} current="kurse" />}><article className="plan-detail">
      <CourseHeading course={course} />
      <CourseViewSwitch courseId={course.id} current="comparison" />
      <ComparisonSwitch courseId={course.id} scope={scope} shown={comparison.length} />
      <PlanMatrix courses={courses} phases={phases} primaryCourseId={course.id} unpublishedCourseIds={unpublishedCourseIds} />
      <PlanEventTable courses={courses} phases={phases} events={events} emptyNote="Für die gezeigten Kurse ist kein prüfungsrelevanter Termin gespeichert." />
      {backToList}
    </article></SiteShell>;
  }

  /* The planning state reads the parallel courses of the study program along, because those are the ones whose plan
     is usually meant to agree with this one: it says where they differ and offers them as targets of a transfer. */
  const plan = coursePlanData(sqlite, account, courseId, defaultComparisonScope);
  if (!plan) notFound();
  const { course, comparison, phases, events } = plan;
  const created = searchParam(raw, "angelegt") === "1";

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><article className="plan-detail">
    <CourseHeading course={course} state={!course.editable} />
    {created ? <p role="status">Der Kurs wurde angelegt.</p> : null}

    <CourseViewSwitch courseId={course.id} current="plan" />

    {/* Everything that writes is reserved to the own areas (ADR 0011). A foreign course therefore carries neither
        publication, nor forms, nor course details, and says once — here, where they would have begun — why. */}
    {course.editable
      ? <CoursePublicationControls courseId={course.id} code={course.code} updatedAt={course.updatedAt} publishedAt={course.publishedAt}
          publishedOn={course.publishedAt ? berlinCalendarDay(new Date(course.publishedAt)) : null}
          issues={courseIssues(course, phases, events).map((issue) => issue.message)} />
      : <p className="notice">Dieser Kurs gehört zum Bereich {course.areaName}, der Ihnen nicht zugeordnet ist: Sie können ihn lesen, aber nicht bearbeiten, löschen oder veröffentlichen.</p>}

    <CoursePlanWorkspace course={course} parallels={comparison} phases={phases} events={events} />

    {course.editable ? <NextYear course={course} /> : null}

    {/* Code, study program and study period are set once and hardly ever again, and deleting is rarer still. Both
        rest behind one line at the end of the page instead of holding a section of their own. */}
    {course.editable ? <details className="disclosure course-settings">
      <summary><span className="disclosure__summary">Kursangaben ändern oder Kurs löschen</span></summary>
      <div className="disclosure__body">
        <h2>Kursangaben</h2>
        <EditCourseForm courseId={course.id} programs={programOptions(sqlite, account)} course={{ code: course.code, programId: course.programId, studyStart: course.studyStart, studyEnd: course.studyEnd }} published={course.state === "PUBLISHED"} />
        <h2>Kurs löschen</h2>
        {course.publishedAt
          ? <p className="empty-note">Dieser Kurs ist öffentlich sichtbar und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung oben zuerst zurück.</p>
          : <DeleteCourseForm courseId={course.id} code={course.code} />}
      </div>
    </details> : null}

    {backToList}
  </article></SiteShell>;
}
