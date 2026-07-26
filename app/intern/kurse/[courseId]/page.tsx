import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { CreateBlockPlanFromCourseForm } from "@/components/block-plan-forms";
import { DeleteCourseForm, EditCourseForm } from "@/components/course-forms";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

import { blockPlanSummaries } from "../../blockplaene/data";
import { searchParam } from "../../search-params";
import { findInternalCourse, programOptions } from "../data";

export default async function CourseDetailPage({ params, searchParams }: PageProps<"/intern/kurse/[courseId]">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const { courseId } = await params;
  const course = findInternalCourse(sqlite, courseId, account);
  if (!course) notFound();
  const created = searchParam(await searchParams, "angelegt") === "1";
  const programs = programOptions(sqlite, account);

  return <SiteShell><InternalNav account={account} current="kurse" /><section className="search-panel" aria-labelledby="course-detail-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="course-detail-heading">Kurs {course.code}</h1>
    {created ? <p role="status">Der Kurs wurde angelegt.</p> : null}

    <h2>Kursangaben</h2>
    <EditCourseForm courseId={course.id} programs={programs} course={{ code: course.code, programId: course.programId, studyStart: course.studyStart, studyEnd: course.studyEnd }} />

    <h2>Blockplan</h2>
    {course.blockPlanId
      ? <p>Dieser Kurs gehört zum Blockplan <Link className="text-link" href={`/intern/blockplaene/${course.blockPlanId}`}>{blockPlanSummaries(sqlite, [course.blockPlanId]).get(course.blockPlanId)?.displayName}</Link>. Dort können Sie ihn lösen und weitere Kurse zuordnen.</p>
      : <CreateBlockPlanFromCourseForm courseId={course.id} code={course.code} />}

    <h2>Löschen</h2>
    {course.publishedIn
      ? <p className="empty-note">Dieser Kurs ist in der veröffentlichten Fassung „{course.publishedIn}“ öffentlich sichtbar und kann nicht gelöscht werden. Nehmen Sie die Fassung zurück oder veröffentlichen Sie sie ohne diesen Kurs neu.</p>
      : <DeleteCourseForm courseId={course.id} code={course.code} />}

    <p><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </section></SiteShell>;
}
