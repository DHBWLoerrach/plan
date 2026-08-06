import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { publicationStateLabels } from "@/lib/domain/course-status";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { overviewPrograms } from "./kurse/data";

/** The page carries no visible title, so the tab is where it states which of the internal pages is open. */
export const metadata: Metadata = { title: "Übersicht" };

export default async function InternalHome() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const manages = managesAnyArea(account);
  const programs = manages ? overviewPrograms(sqlite, account, berlinCalendarDay()) : [];
  /* The area is named once the grouping spans more than one of them, because the same study program name may then
     occur twice. With a single area it would repeat that name above every group and distinguish nothing. */
  const namesAreas = new Set(programs.map((program) => program.areaName)).size > 1;

  return <SiteShell nav={<InternalNav account={account} current="home" />}><div className="internal-overview">
    {/* The header names the account, the section navigation marks this page and the tab title states it, so a visible
        title line would say a fourth time where one is. It stays for assistive technology, which reads the document
        rather than the marked navigation entry, and it keeps the study programs below it at a heading level of their
        own instead of opening the outline in the middle. */}
    <h1 className="sr-only">Übersicht</h1>
    {manages ? <>
      {programs.length
        ? programs.map((program) => <section className="program-group" key={program.id}>
          {/* The spaces are written out, because they belong to the accessible name of the heading just as much as
              to its typography — set by margins alone the three parts would be read as one word. */}
          <h2 className="program-group__name">
            <span className="program-group__abbreviation">{program.abbreviation}</span> {program.name}
            {namesAreas ? <span className="program-group__area"> {program.areaName}</span> : null}
          </h2>
          {program.years.map((year) => <div className="year-row" key={year.year}>
            <h3 className="year-row__year">{year.year}</h3>
            <ul className="course-tiles">{year.courses.map((course) => <li className="course-tile" key={course.id}>
              <Link href={`/intern/kurse/${course.id}`}>{course.code}</Link>
              <span className="course-tile__standing">{course.currentPhase}</span>
              {/* A course past its last phase has nothing to announce, so the line goes rather than stating that. */}
              {course.nextPhase ? <span>{course.nextPhase}</span> : null}
              {/* The publication state is named in words in every internal view, and it is the whole state a course
                  has: there is no second data stand beside the visible one (ADR 0012, ADR 0014). */}
              <span className={course.state === "UNPUBLISHED" ? "course-tile__unpublished" : undefined}>{publicationStateLabels[course.state]}</span>
            </li>)}</ul>
          </div>)}
        </section>)
        /* The only way on this page ever offers: with courses shown, the section navigation leads to the list and the
           list carries the same button, so it would stand here a third time. */
        : <><p className="empty-note">In Ihren Bereichen gibt es noch keine Kurse.</p>
          <p className="internal-overview__actions"><Link className="button" href="/intern/kurse/neu">Kurs anlegen</Link></p></>}
    </> : <p className="empty-note">Ihnen ist noch kein Bereich zugeordnet. Bis dahin können Sie keine Kurse bearbeiten; die Systemadministration ordnet Ihnen Bereiche zu.</p>}
  </div></SiteShell>;
}
