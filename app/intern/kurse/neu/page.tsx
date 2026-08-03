import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { adoptionTemplateChoices } from "@/lib/services/course-adoption";

import { programOptions } from "../data";

/**
 * The way into a new course. There are exactly two, and they are chosen before anything is entered: a course is either
 * adopted from an existing one or planned from scratch. Keeping the choice on a page of its own
 * is what keeps the two apart — each way then asks only for what it needs, and neither carries a field of the other.
 *
 * Whether a way is possible at all is decided here rather than behind the choice: a way that leads nowhere is not
 * offered as a way. Both need a study program to write into — assignment to an area is not the same as having one —
 * and the adoption needs a template on top of that.
 */
export default async function NewCoursePage() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const programs = programOptions(sqlite, account).length;
  const templates = adoptionTemplateChoices(sqlite, account).length;

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel" aria-labelledby="new-course-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="new-course-heading">Kurs anlegen</h1>
    <p>Wählen Sie, wie der Kursverlauf des neuen Kurses entsteht. Beide Wege legen denselben Kurs an; nach der Anlage sind Kursverlauf und Termine wie gewohnt einzeln bearbeitbar.</p>

    <ul className="path-choice">
      <li className="path-card" data-unavailable={templates ? undefined : true}>
        <h2>{templates
          ? <Link href="/intern/kurse/neu/vorlage">Aus Vorlage übernehmen<span className="path-card__arrow" aria-hidden="true">→</span></Link>
          : "Aus Vorlage übernehmen"}</h2>
        <dl className="path-card__facts">
          <dt>Übernimmt</dt>
          <dd>Kursverlauf und Termine der Vorlage, um ganze Wochen versetzt</dd>
          <dt>Voraussetzung</dt>
          <dd>{!programs
            ? "Ein Studiengang in einem Ihrer Bereiche, dazu eine Vorlage mit dessen Semesterzahl"
            : templates
              ? `Vorlage mit gleicher Semesterzahl (${templates === 1 ? "1 Kurs" : `${templates} Kurse`} zur Wahl)`
              : "Noch keine Vorlage verfügbar — es besteht kein Kurs mit einer Semesterzahl, die einer Ihrer Studiengänge hat"}</dd>
          <dt>Geeignet für</dt>
          <dd>Parallelkurs oder weiteren Jahrgang</dd>
        </dl>
      </li>
      <li className="path-card" data-unavailable={programs ? undefined : true} data-only-way={programs && !templates ? true : undefined}>
        <h2>{programs
          ? <Link href="/intern/kurse/neu/erzeugt">Kursverlauf erzeugen<span className="path-card__arrow" aria-hidden="true">→</span></Link>
          : "Kursverlauf erzeugen"}</h2>
        <dl className="path-card__facts">
          <dt>Erzeugt</dt>
          <dd>Zwei Kursphasen je Semester, Theorie und Praxis im Wechsel</dd>
          <dt>Voraussetzung</dt>
          <dd>{programs
            ? "Ein Studiengang in einem Ihrer Bereiche — der Studienzeitraum wird aus dem Jahrgang vorbelegt"
            : "Ein Studiengang in einem Ihrer Bereiche"}</dd>
          <dt>Geeignet für</dt>
          <dd>{programs && !templates
            ? "Ersten Kurs eines Jahrgangs — derzeit der einzige Weg"
            : "Ersten Kurs eines Jahrgangs oder Studiengangs"}</dd>
        </dl>
      </li>
    </ul>

    {/* Without a study program neither way can be taken, and neither card can say what would help. The one thing that
        would is not a step this account can take itself, so it is named as what it is. */}
    {programs ? null : <p className="notice">Ihnen ist kein Bereich mit Studiengängen zugeordnet, daher lässt sich derzeit kein Kurs anlegen. Die Systemadministration kann Ihnen einen Bereich zuordnen.</p>}

    <p><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </section></SiteShell>;
}
