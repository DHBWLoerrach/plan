import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdoptCourseForm } from "@/components/course-forms";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { nextYearProposal } from "@/lib/domain/course-adoption";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { adoptionTemplateChoices, readAdoptionTemplate } from "@/lib/services/course-adoption";

import { searchParam } from "../../../search-params";
import { programOptions } from "../../data";

/** The first of the two ways: the new course copies the planning state of an existing one. */
export default async function NewCourseFromTemplatePage({ searchParams }: PageProps<"/intern/kurse/neu/vorlage">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const raw = await searchParams;
  const requestedTemplate = searchParam(raw, "vorlage");
  const template = requestedTemplate ? readAdoptionTemplate(sqlite, requestedTemplate) : undefined;
  // An adoption requires template and target to agree on the number of semesters, so only those are offered — on both
  // sides of the choice, which is why the template list is narrowed by the same rule.
  const programs = programOptions(sqlite, account, template?.semesters);
  const templates = adoptionTemplateChoices(sqlite, account);
  /* Reached from the planning state of a course, the form arrives filled in for the following year of that course —
     the adoption most of them are. The study program is proposed only where this account may create a course in it. */
  const proposal = template && searchParam(raw, "jahrgang") === "naechster"
    ? { ...nextYearProposal(template, berlinCalendarDay()), programId: programs.some((program) => program.id === template.programId) ? template.programId : "" }
    : undefined;

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel narrow-panel" aria-labelledby="new-course-heading">
    <p className="eyebrow">Kurs anlegen</p>
    <h1 id="new-course-heading">Aus Vorlage übernehmen</h1>
    <p>Eine Übernahme kopiert Kursverlauf und Termine der Vorlage einmalig und versetzt sie um ganze Wochen; danach besteht zwischen Vorlage und neuem Kurs keine Verbindung.</p>

    {/* Eine Auswahl, kein Filter: Sie grenzt keine Liste ein, sondern entscheidet, womit die Seite weitergeht. Als
        Filterraster gesetzt stand ihr Feld in einer von vier Spalten und schnitt die Namen ab, die es tragen soll. */}
    <form method="get" className="choice-form" aria-label="Vorlage wählen">
      <label>Vorlage<select name="vorlage" defaultValue={template?.id ?? ""}>
        <option value="" disabled>Bitte wählen</option>
        {templates.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></label>
      <button className="button" type="submit">Vorlage wählen</button>
    </form>

    {requestedTemplate && !template ? <p className="notice">Die gewählte Vorlage wurde nicht gefunden. Wählen Sie eine andere.</p> : null}

    {template
      ? programs.length
        ? <AdoptCourseForm key={template.id} programs={programs} template={template} proposal={proposal} />
        : <p className="empty-note">Ihnen ist kein Studiengang mit {template.semesters} Semestern zugeordnet. Eine Übernahme setzt dieselbe Anzahl Semester voraus wie die Vorlage.</p>
      : <p className="empty-note">{templates.length
        ? "Wählen Sie zuerst die Vorlage. Danach werden die Angaben des neuen Kurses erfasst."
        : "Es besteht kein Kurs, der Ihnen als Vorlage dienen könnte: Eine Übernahme setzt eine Vorlage mit ebenso vielen Semestern voraus, wie einer Ihrer Studiengänge hat. Legen Sie den Kurs mit einem erzeugten Kursverlauf an."}</p>}

    <p><Link className="text-link" href="/intern/kurse/neu">Zurück zur Auswahl</Link></p>
  </section></SiteShell>;
}
