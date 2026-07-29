import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CourseCutEditor } from "@/components/course-cut-editor";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { courseCutData } from "../data";

function values(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

type CutPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CourseCutPage({ searchParams }: CutPageProps) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const raw = await searchParams;
  const year = typeof raw.year === "string" ? raw.year : "";
  const cut = courseCutData(sqlite, account, { year, courseIds: values(raw.courseId) });
  if (!cut) redirect("/intern/kurse?zuschnitt=ungueltig");

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><article className="plan-detail">
    <p className="eyebrow">Interne Bearbeitung</p>
    <h1>Zuschnitt Jahrgang {cut.year}</h1>
    <p>Der Zuschnitt wird nicht gespeichert. Er zeigt und bearbeitet nur die hier ausgewählten Kurse nebeneinander.</p>
    <CourseCutEditor courses={cut.courses} phases={cut.phases} events={cut.events} />
    <section className="workspace-panel" aria-labelledby="preview-heading">
      <h2 id="preview-heading">Vorschau und Veröffentlichung</h2>
      <p>Vorschau, Veröffentlichen und Zurücknehmen laufen vorübergehend je technischer Planungsgruppe. Die Auswahl bleibt dabei auf diesen Zuschnitt bezogen.</p>
      <ul className="entry-list">{cut.previewLinks.map((entry) => <li key={entry.blockPlanId}>
        <Link className="text-link" href={`/intern/blockplaene/${entry.blockPlanId}/vorschau`}>Vorschau und Veröffentlichung für {entry.codes.join(", ")}</Link>
      </li>)}</ul>
    </section>
    <p><Link className="text-link" href={`/intern/kurse?year=${encodeURIComponent(cut.year)}`}>Zurück zur Kursliste</Link></p>
  </article></SiteShell>;
}
