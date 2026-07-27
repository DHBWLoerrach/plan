import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CreateCourseForm } from "@/components/course-forms";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { programOptions } from "../data";

export default async function NewCoursePage() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const programs = programOptions(sqlite, account);

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel narrow-panel" aria-labelledby="new-course-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="new-course-heading">Kurs anlegen</h1>
    {programs.length ? <CreateCourseForm programs={programs} /> : <p className="empty-note">Ihnen ist kein Bereich mit Studiengängen zugeordnet.</p>}
    <p><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </section></SiteShell>;
}
