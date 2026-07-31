import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { SmartCourseForm } from "@/components/smart-course-form";
import { sqlite } from "@/lib/db";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { programOptions } from "../../data";

/**
 * The second of the two ways: the new course gets a course progression generated from its study period alone
 * (FACHLICHE_REGELN.md). „Today“ is determined on the server, so the proposed study start does not depend on the
 * time zone of the browser.
 */
export default async function NewSmartCoursePage() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const programs = programOptions(sqlite, account);

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel" aria-labelledby="new-course-heading">
    <p className="eyebrow">Kurs anlegen</p>
    <h1 id="new-course-heading">Kurs smart anlegen</h1>
    <p>Aus Studiengang und Kurskennung entsteht ein Vorschlag für den Studienzeitraum. Die gewählte Startphase bestimmt den Kursverlauf: zwei Kursphasen je Semester, Theorie und Praxis im Wechsel, lückenlos über den ganzen Studienzeitraum. Jede Angabe bleibt änderbar.</p>

    {programs.length
      ? <SmartCourseForm programs={programs} today={berlinCalendarDay()} />
      : <p className="empty-note">Ihnen ist kein Bereich mit Studiengängen zugeordnet.</p>}

    <p><Link className="text-link" href="/intern/kurse/neu">Zurück zur Auswahl</Link></p>
  </section></SiteShell>;
}
