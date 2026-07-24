import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

export default async function CoursesPage() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const courses = sqlite.prepare(`SELECT course.code, program.name AS program, course.study_start AS studyStart, course.study_end AS studyEnd, plan.id AS blockPlanId
    FROM courses course JOIN programs program ON program.id = course.program_id LEFT JOIN block_plans plan ON plan.id = course.block_plan_id
    WHERE ? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?) ORDER BY course.code COLLATE NOCASE`).all(account.systemAdmin ? 1 : 0, account.id) as { code: string; program: string; studyStart: string; studyEnd: string; blockPlanId: string | null }[];
  return <SiteShell><section className="search-panel"><p className="eyebrow">Interner Bereich</p><h1>Kurse</h1>
    {courses.length ? <table className="event-table"><thead><tr><th scope="col">Kurskennung</th><th scope="col">Studiengang</th><th scope="col">Studienzeitraum</th><th scope="col">Zuordnung</th></tr></thead><tbody>{courses.map((course) => <tr key={course.code}><td>{course.code}</td><td>{course.program}</td><td>{course.studyStart} – {course.studyEnd}</td><td>{course.blockPlanId ? "Blockplan zugeordnet" : "Blockplanlos"}</td></tr>)}</tbody></table> : <p className="empty-note">Noch keine Kurse vorhanden.</p>}
  </section></SiteShell>;
}
