import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { DeleteCourseForm, EditCourseForm } from "@/components/course-forms";
import { CoursePublicationControls } from "@/components/course-publication-controls";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { coursePlanPath } from "@/lib/domain/course-comparison";
import { publicationStateLabels, workInProgressLabel } from "@/lib/domain/course-status";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { readPublicationPreview } from "@/lib/services/publication";

import { searchParam } from "../../search-params";
import { findInternalCourse, programOptions } from "../data";

export default async function CourseDetailPage({ params, searchParams }: PageProps<"/intern/kurse/[courseId]">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  // Reading across areas is a permission of Bereichsbearbeitung and Systemadministration, not of every session.
  if (!managesAnyArea(account)) redirect("/intern");
  const { courseId } = await params;
  const course = findInternalCourse(sqlite, courseId, account);
  if (!course) notFound();
  /* Everything this page holds beyond the course's own designations — editing, publishing, deleting — is a write and
     therefore reserved to the own areas (ADR 0011). For a foreign course the plan page shows the same designations
     and is the only thing left to do with it, so it is where the course leads instead of to a page of leftovers. */
  if (!course.editable) redirect(coursePlanPath(course.id));
  const created = searchParam(await searchParams, "angelegt") === "1";
  const publication = readPublicationPreview(sqlite, course.id)!;

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel" aria-labelledby="course-detail-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="course-detail-heading">Kurs {course.code}</h1>
    {created ? <p role="status">Der Kurs wurde angelegt.</p> : null}
    <p>Bereich {course.areaName} · {publicationStateLabels[course.state]}{course.workInProgress ? ` · ${workInProgressLabel}` : ""}</p>
    {course.workInProgress ? <p className="notice">Dieser Kurs ist nicht veröffentlicht. Er darf einen unvollständigen Planungsstand enthalten.</p> : null}

    <h2>Kursangaben</h2>
    <EditCourseForm courseId={course.id} programs={programOptions(sqlite, account)} course={{ code: course.code, programId: course.programId, studyStart: course.studyStart, studyEnd: course.studyEnd }} published={course.state === "PUBLISHED"} />

    <h2>Planungsstand</h2>
    <p>Kursverlauf und prüfungsrelevante Termine dieses Kurses stehen auf einer eigenen Seite. Dort ist der Kurs der Gegenstand der Bearbeitung; seine Parallelkurse stehen zum Vergleich daneben, ohne mitbearbeitet zu werden.</p>
    <p><Link className="button button--compact" href={coursePlanPath(course.id)}>Planungsstand bearbeiten</Link></p>

    <CoursePublicationControls courseId={course.id} updatedAt={publication.course.updatedAt} publishedAt={publication.course.publishedAt} issues={publication.issues.map((issue) => issue.message)} />

    <h2>Löschen</h2>
    {course.publishedAt
      ? <p className="empty-note">Dieser Kurs ist öffentlich sichtbar und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung oben zuerst zurück.</p>
      : <DeleteCourseForm courseId={course.id} code={course.code} />}

    <p><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </section></SiteShell>;
}
