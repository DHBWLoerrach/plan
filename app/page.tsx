import { connection } from "next/server";

import { ExternalLinkText } from "@/components/external-link-text";
import { PublicOverview } from "@/components/public-overview";
import { SiteShell } from "@/components/site-shell";
import { programContactsUrl } from "@/lib/product";

import { publicOverviewData, searchParam } from "./data";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const raw = await searchParams;
  const overview = publicOverviewData();
  const query = searchParam(raw, "q") ?? "";

  return <SiteShell>
    <section className="search-hero">
      <h1>Blockpläne</h1>
      <p className="search-hero__lead">Wann sind die Studierenden im Unternehmen, wann an der DHBW? Hier finden Sie die Pläne aller laufenden Jahrgänge – immer im aktuellen, freigegebenen Stand. Sie heißen auch Studienzeitplan, Semesterplan oder Studienverlauf.</p>
    </section>

    <PublicOverview overview={overview} initialQuery={query} initialYear={searchParam(raw, "year") ?? ""} />

    <section className="landing-hints" aria-label="Hinweise">
      <div>
        <h2>So läuft das duale Studium ab</h2>
        <p>Die Studierenden wechseln etwa alle drei Monate zwischen Unternehmen und DHBW. Der Blockplan zeigt beide Phasen sowie die Termine für Projektarbeiten und Prüfungen.</p>
      </div>
      <div>
        <h2>Kurs A und Kurs B</h2>
        <p>Bei manchen Studiengängen gibt es Parallelkurse, etwa Kurs A und B. Laufen sie gleich, gibt es einen gemeinsamen Plan. Sonst hat jeder Kurs einen eigenen Plan – wählen Sie den passenden.</p>
      </div>
      <div>
        <h2>Fragen zum Blockplan?</h2>
        <p>Die Blockpläne erstellt der jeweilige Studiengang. Dort beantwortet man auch Ihre Fragen.</p>
        <p><a href={programContactsUrl}><ExternalLinkText>Kontakt zu den Studiengängen</ExternalLinkText></a></p>
      </div>
    </section>
  </SiteShell>;
}
