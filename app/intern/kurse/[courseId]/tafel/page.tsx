import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { CourseViewSwitch } from "@/components/course-view-switch";
import { InternalNav } from "@/components/internal-nav";
import { PlanningBoard } from "@/components/planning-board";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { formatCalendarPeriod } from "@/lib/domain/calendar-format";
import { comparisonScope, comparisonScopes } from "@/lib/domain/course-comparison";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { coursePlanData } from "@/lib/services/internal-course-plan";

import { searchParam } from "../../../search-params";

export default async function PlanningBoardPage({ params, searchParams }: PageProps<"/intern/kurse/[courseId]/tafel">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const { courseId } = await params;
  const raw = await searchParams;
  const scope = comparisonScope(searchParam(raw, "vergleich"));
  const plan = coursePlanData(sqlite, account, courseId, scope);
  if (!plan) notFound();
  const { course, comparison, phases, events } = plan;

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><article className="plan-detail">
    <p className="eyebrow">Interner Bereich</p>
    <h1>Kurs {course.code}</h1>
    <p>{course.program} · Bereich {course.areaName} · Studienzeitraum {formatCalendarPeriod(course.studyStart, course.studyEnd)}</p>
    <CourseViewSwitch courseId={course.id} current="board" />
    <nav className="comparison-switch" aria-label="Kurse auf der Tafel">
      <p className="comparison-switch__label">Darunter:</p>
      <ul className="comparison-switch__options">
        {comparisonScopes.map((entry) => <li key={entry.scope}>
          <Link href={`/intern/kurse/${encodeURIComponent(course.id)}/tafel?vergleich=${entry.parameter}`} aria-current={entry.scope === scope ? "page" : undefined}>{entry.label}</Link>
        </li>)}
      </ul>
    </nav>
    <PlanningBoard course={course} parallels={comparison} phases={phases} events={events} today={berlinCalendarDay()} />
  </article></SiteShell>;
}
