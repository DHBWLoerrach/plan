import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

import { searchParam } from "./data";

type CourseRow = {
  id: string; code: string; program: string; areaName: string;
  studyStart: string; studyEnd: string; blockPlanId: string | null; publishedIn: string | null;
};

export default async function CoursesPage({ searchParams }: PageProps<"/intern/kurse">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const raw = await searchParams;
  const scope = account.systemAdmin ? 1 : 0;
  const area = searchParam(raw, "area");
  const program = searchParam(raw, "program");
  const year = searchParam(raw, "year");
  const rawAssignment = searchParam(raw, "assignment");
  const assignment = rawAssignment === "assigned" || rawAssignment === "unassigned" ? rawAssignment : null;

  const areas = sqlite.prepare(`SELECT id, name FROM areas WHERE ? = 1 OR id IN (SELECT area_id FROM area_assignments WHERE user_id = ?) ORDER BY name COLLATE NOCASE`).all(scope, account.id) as { id: string; name: string }[];
  const programs = sqlite.prepare(`SELECT id, name, area_id AS areaId FROM programs WHERE ? = 1 OR area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?) ORDER BY name COLLATE NOCASE`).all(scope, account.id) as { id: string; name: string; areaId: string }[];
  const years = sqlite.prepare(`SELECT DISTINCT substr(course.study_start, 1, 4) AS year FROM courses course JOIN programs prog ON prog.id = course.program_id
    WHERE ? = 1 OR prog.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?) ORDER BY year DESC`).all(scope, account.id) as { year: string }[];

  const courses = sqlite.prepare(`SELECT course.id, course.code, program.name AS program, area.name AS areaName,
      course.study_start AS studyStart, course.study_end AS studyEnd, course.block_plan_id AS blockPlanId,
      (SELECT version.block_plan_name FROM published_course_snapshots snap JOIN published_versions version ON version.id = snap.version_id WHERE snap.source_course_id = course.id) AS publishedIn
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    WHERE (? = 1 OR program.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))
      AND (? IS NULL OR program.area_id = ?)
      AND (? IS NULL OR course.program_id = ?)
      AND (? IS NULL OR substr(course.study_start, 1, 4) = ?)
      AND (? IS NULL OR (CASE WHEN course.block_plan_id IS NULL THEN 'unassigned' ELSE 'assigned' END) = ?)
    ORDER BY course.code COLLATE NOCASE`).all(
    scope, account.id, area, area, program, program, year, year, assignment, assignment,
  ) as CourseRow[];

  return <SiteShell><section className="search-panel" aria-labelledby="courses-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="courses-heading">Kurse</h1>
    <p><Link className="button" href="/intern/kurse/neu">Kurs anlegen</Link></p>
    <form className="filter-grid" role="search" aria-label="Kurse filtern">
      <label>Bereich<select name="area" defaultValue={area ?? ""}><option value="">Alle Bereiche</option>{areas.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Studiengang<select name="program" defaultValue={program ?? ""}><option value="">Alle Studiengänge</option>{programs.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Jahrgang<select name="year" defaultValue={year ?? ""}><option value="">Alle Jahrgänge</option>{years.map((option) => <option key={option.year} value={option.year}>{option.year}</option>)}</select></label>
      <label>Zuordnung<select name="assignment" defaultValue={assignment ?? ""}><option value="">Alle</option><option value="assigned">Blockplan zugeordnet</option><option value="unassigned">Blockplanlos</option></select></label>
      <div className="filter-actions"><button className="button" type="submit">Filtern</button><Link href="/intern/kurse">Filter zurücksetzen</Link></div>
    </form>
    {courses.length ? <div className="matrix-wrap" tabIndex={0}><table className="event-table"><thead><tr><th scope="col">Kurskennung</th><th scope="col">Studiengang</th><th scope="col">Bereich</th><th scope="col">Studienzeitraum</th><th scope="col">Zuordnung</th><th scope="col">Verwalten</th></tr></thead>
      <tbody>{courses.map((course) => <tr key={course.id}>
        <td>{course.code}</td><td>{course.program}</td><td>{course.areaName}</td><td>{course.studyStart} – {course.studyEnd}</td>
        <td>{course.publishedIn ? `Öffentlich sichtbar (${course.publishedIn})` : course.blockPlanId ? "Blockplan zugeordnet" : "Blockplanlos"}</td>
        <td><Link className="text-link" href={`/intern/kurse/${course.id}`}>Verwalten</Link></td>
      </tr>)}</tbody></table></div> : <p className="empty-note">Für diese Filter gibt es keine Kurse.</p>}
  </section></SiteShell>;
}
