import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { adoptionTemplateChoices } from "@/lib/services/course-adoption";

/**
 * The way into a new course. There are exactly two, and they are chosen before anything is entered: a course is either
 * adopted from an existing one or planned from scratch. Keeping the choice on a page of its own
 * is what keeps the two apart — each way then asks only for what it needs, and neither carries a field of the other.
 *
 * Whether an adoption is possible at all is decided here rather than behind the choice: without a template this
 * account can adopt from, the way leads nowhere, and a way that leads nowhere is not offered as a way.
 */
export default async function NewCoursePage() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const templates = adoptionTemplateChoices(sqlite, account).length;

  return <SiteShell nav={<InternalNav account={account} current="kurse" />}><section className="search-panel" aria-labelledby="new-course-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="new-course-heading">Kurs anlegen</h1>
    <p>Wählen Sie, wie der Kursverlauf des neuen Kurses entsteht. Beide Wege legen denselben Kurs an; nach der Anlage sind Kursverlauf und Termine wie gewohnt einzeln bearbeitbar.</p>

    <ul className="path-choice">
      <li className="path-card" aria-disabled={templates ? undefined : true}>
        <h2>{templates
          ? <Link href="/intern/kurse/neu/vorlage">Aus Vorlage anlegen</Link>
          : "Aus Vorlage anlegen"}</h2>
        <p>Kursverlauf und Termine eines bestehenden Kurses werden einmalig kopiert und um ganze Wochen versetzt. Danach besteht zwischen Vorlage und neuem Kurs keine Verbindung.</p>
        <p className="path-card__note">{templates
          ? `Geeignet, wenn ein vergleichbarer Kurs bereits geplant ist. ${templates === 1 ? "1 Kurs steht" : `${templates} Kurse stehen`} als Vorlage zur Wahl.`
          : "Noch keine Vorlage verfügbar: Eine Übernahme setzt einen bestehenden Kurs mit ebenso vielen Semestern voraus, wie einer Ihrer Studiengänge hat."}</p>
      </li>
      <li className="path-card" data-only-way={templates ? undefined : true}>
        <h2><Link href="/intern/kurse/neu/smart">Kurs smart anlegen</Link></h2>
        <p>Der Studienzeitraum wird aus dem Jahrgang vorbelegt, und aus der gewählten Startphase entsteht ein lückenloser Kursverlauf: zwei Kursphasen je Semester, Theorie und Praxis im Wechsel.</p>
        <p className="path-card__note">{templates
          ? "Geeignet für den ersten Kurs eines Jahrgangs oder Studiengangs."
          : "Solange keine Vorlage besteht, ist dies der Weg zum ersten Kurs."}</p>
      </li>
    </ul>

    <p><Link className="text-link" href="/intern/kurse">Zurück zur Kursliste</Link></p>
  </section></SiteShell>;
}
