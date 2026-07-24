import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { CreateBlockPlanFromCourseForm } from "@/components/block-plan-forms";
import { DeleteCourseForm, EditCourseForm } from "@/components/course-forms";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

import { blockPlanDisplayNames } from "../../blockplaene/data";
import { programOptions, searchParam } from "../data";

export default async function CourseDetailPage({ params, searchParams }: PageProps<"/intern/kurse/[courseId]">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const { courseId } = await params;
  const course = sqlite.prepare(`SELECT course.id, course.code, course.program_id AS programId, course.study_start AS studyStart, course.study_end AS studyEnd,
      course.block_plan_id AS blockPlanId, program.area_id AS areaId,
      (SELECT version.block_plan_name FROM published_course_snapshots snap JOIN published_versions version ON version.id = snap.version_id WHERE snap.source_course_id = course.id) AS publishedIn
    FROM courses course JOIN programs program ON program.id = course.program_id WHERE course.id = ?`).get(courseId) as
    | { id: string; code: string; programId: string; studyStart: string; studyEnd: string; blockPlanId: string | null; areaId: string; publishedIn: string | null }
    | undefined;
  if (!course) notFound();
  if (!account.systemAdmin && !account.areaIds.includes(course.areaId)) notFound();
  const created = searchParam(await searchParams, "angelegt") === "1";
  const programs = programOptions(account);

  return <SiteShell><section className="search-panel" aria-labelledby="course-detail-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="course-detail-heading">Kurs {course.code}</h1>
    {created ? <p role="status">Der Kurs wurde angelegt.</p> : null}

    <h2>Kursangaben</h2>
    <EditCourseForm courseId={course.id} programs={programs} course={{ code: course.code, programId: course.programId, studyStart: course.studyStart, studyEnd: course.studyEnd }} />

    <h2>Blockplan</h2>
    {course.blockPlanId
      ? <p>Dieser Kurs gehört zum Blockplan <Link className="text-link" href={`/intern/blockplaene/${course.blockPlanId}`}>{blockPlanDisplayNames([course.blockPlanId]).get(course.blockPlanId)}</Link>. Dort können Sie ihn lösen und weitere Kurse zuordnen.</p>
      : <CreateBlockPlanFromCourseForm courseId={course.id} code={course.code} />}

    <h2>Löschen</h2>
    {course.publishedIn
      ? <p className="empty-note">Dieser Kurs ist in der veröffentlichten Fassung „{course.publishedIn}“ öffentlich sichtbar und kann nicht gelöscht werden. Nehmen Sie die Fassung zurück oder veröffentlichen Sie sie ohne diesen Kurs neu.</p>
      : <DeleteCourseForm courseId={course.id} code={course.code} />}

    <p><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </section></SiteShell>;
}
