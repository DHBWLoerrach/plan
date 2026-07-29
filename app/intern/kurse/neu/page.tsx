import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdoptCourseForm, CreateCourseForm } from "@/components/course-forms";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { adoptionTemplateChoices, readAdoptionTemplate } from "@/lib/services/course-adoption";

import { searchParam } from "../../search-params";
import { programOptions } from "../data";

export default async function NewCoursePage({ searchParams }: PageProps<"/intern/kurse/neu">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const requestedTemplate = searchParam(await searchParams, "vorlage");
  const template = requestedTemplate ? readAdoptionTemplate(sqlite, requestedTemplate) : undefined;
  // An adoption requires template and target to agree on the number of semesters, so only those are offered.
  const programs = programOptions(sqlite, account, template?.semesters);
  const templates = adoptionTemplateChoices(sqlite);

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel narrow-panel" aria-labelledby="new-course-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="new-course-heading">Kurs anlegen</h1>
    <p>Ein Kurs entsteht leer oder als Übernahme aus einer Vorlage. Eine Übernahme kopiert Kursverlauf und Termine einmalig; danach besteht zwischen Vorlage und neuem Kurs keine Verbindung.</p>

    <form method="get" className="filter-grid" aria-label="Vorlage wählen">
      <label>Vorlage<select name="vorlage" defaultValue={template?.id ?? ""}>
        <option value="">Ohne Vorlage — leerer Kurs</option>
        {templates.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></label>
      <div className="filter-actions"><button className="button" type="submit">Vorlage wählen</button></div>
    </form>

    {requestedTemplate && !template ? <p className="notice">Die gewählte Vorlage wurde nicht gefunden. Wählen Sie eine andere oder legen Sie den Kurs leer an.</p> : null}

    {programs.length
      ? template
        ? <AdoptCourseForm programs={programs} template={template} />
        : <CreateCourseForm programs={programs} />
      : <p className="empty-note">{template
        ? `Ihnen ist kein Studiengang mit ${template.semesters} Semestern zugeordnet. Eine Übernahme setzt dieselbe Anzahl Semester voraus wie die Vorlage.`
        : "Ihnen ist kein Bereich mit Studiengängen zugeordnet."}</p>}

    <p><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </section></SiteShell>;
}
