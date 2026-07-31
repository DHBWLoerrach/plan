import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { DeleteCourseForm, EditCourseForm } from "@/components/course-forms";
import { CoursePublicationControls } from "@/components/course-publication-controls";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { areaAccessLabel, publicationStateLabels, workInProgressLabel } from "@/lib/domain/course-status";
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
  const created = searchParam(await searchParams, "angelegt") === "1";
  const publication = course.editable ? readPublicationPreview(sqlite, course.id)! : null;

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel" aria-labelledby="course-detail-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="course-detail-heading">Kurs {course.code}</h1>
    {created ? <p role="status">Der Kurs wurde angelegt.</p> : null}
    <p>Bereich {course.areaName} · {areaAccessLabel(course.editable)} · {publicationStateLabels[course.state]}{course.workInProgress ? ` · ${workInProgressLabel}` : ""}</p>
    {course.workInProgress ? <p className="notice">Dieser Kurs ist nicht veröffentlicht. Er darf einen unvollständigen Planungsstand enthalten.</p> : null}

    <h2>Kursangaben</h2>
    {course.editable
      ? <EditCourseForm courseId={course.id} programs={programOptions(sqlite, account)} course={{ code: course.code, programId: course.programId, studyStart: course.studyStart, studyEnd: course.studyEnd }} published={course.state === "PUBLISHED"} />
      : <><p>Kurskennung {course.code} · Studiengang {course.program} · Studienzeitraum {course.studyStart} – {course.studyEnd}</p>
        <p className="notice">Dieser Kurs gehört zum Bereich {course.areaName}, der Ihnen nicht zugeordnet ist. Sie können ihn lesen, aber nicht bearbeiten, löschen oder veröffentlichen.</p></>}

    <h2>Planungsstand</h2>
    <p>Kursverlauf und prüfungsrelevante Termine sehen Sie über einen Zuschnitt aus der Kursliste. Ein Zuschnitt wird nicht gespeichert und kann jederzeit anders gewählt werden.</p>

    {course.editable && publication ? <>
      <CoursePublicationControls courseId={course.id} updatedAt={publication.course.updatedAt} publishedAt={publication.course.publishedAt} issues={publication.issues.map((issue) => issue.message)} />

      <h2>Löschen</h2>
      {course.publishedAt
        ? <p className="empty-note">Dieser Kurs ist öffentlich sichtbar und kann nicht gelöscht werden. Nehmen Sie die Veröffentlichung oben zuerst zurück.</p>
        : <DeleteCourseForm courseId={course.id} code={course.code} />}
    </> : null}

    <p><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </section></SiteShell>;
}
