import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdoptCourseForm } from "@/components/course-forms";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { adoptionTemplateChoices, readAdoptionTemplate } from "@/lib/services/course-adoption";

import { searchParam } from "../../../search-params";
import { programOptions } from "../../data";

/** The first of the two ways: the new course copies the planning state of an existing one (FACHLICHE_REGELN.md). */
export default async function NewCourseFromTemplatePage({ searchParams }: PageProps<"/intern/kurse/neu/vorlage">) {
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
    <p className="eyebrow">Kurs anlegen</p>
    <h1 id="new-course-heading">Aus Vorlage anlegen</h1>
    <p>Eine Übernahme kopiert Kursverlauf und Termine der Vorlage einmalig und versetzt sie um ganze Wochen; danach besteht zwischen Vorlage und neuem Kurs keine Verbindung.</p>

    <form method="get" className="filter-grid" aria-label="Vorlage wählen">
      <label>Vorlage<select name="vorlage" defaultValue={template?.id ?? ""}>
        <option value="" disabled>Bitte wählen</option>
        {templates.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></label>
      <div className="filter-actions"><button className="button" type="submit">Vorlage wählen</button></div>
    </form>

    {requestedTemplate && !template ? <p className="notice">Die gewählte Vorlage wurde nicht gefunden. Wählen Sie eine andere.</p> : null}

    {template
      ? programs.length
        ? <AdoptCourseForm programs={programs} template={template} />
        : <p className="empty-note">Ihnen ist kein Studiengang mit {template.semesters} Semestern zugeordnet. Eine Übernahme setzt dieselbe Anzahl Semester voraus wie die Vorlage.</p>
      : <p className="empty-note">{templates.length
        ? "Wählen Sie zuerst die Vorlage. Danach werden die Angaben des neuen Kurses erfasst."
        : "Es besteht noch kein Kurs, der als Vorlage dienen könnte. Legen Sie den ersten Kurs eines Jahrgangs smart an."}</p>}

    <p><Link className="text-link" href="/intern/kurse/neu">Zurück zur Auswahl</Link></p>
  </section></SiteShell>;
}
