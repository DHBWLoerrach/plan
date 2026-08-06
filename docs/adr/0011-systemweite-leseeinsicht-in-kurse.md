---
status: amended by ADR-0014
---

# Kurse sind systemweit lesbar, Schreibrechte bleiben bereichsgebunden

Jedes interne Konto mit Bereichsbearbeitung darf Kurse aller Bereiche einschließlich ihrer Planungsstände lesen. Anlegen, Bearbeiten, Löschen, Veröffentlichen und Zurücknehmen bleiben unverändert auf die zugeordneten Bereiche beschränkt. Der Anlass ist die Übernahme: Ein neuer Kurs soll den fertigen Verlauf eines bestehenden Kurses übernehmen können, und der lohnendste Fall ist gerade der bereichs- oder studiengangsfremde — ein Studiengang im Studienbereich Technik übernimmt aus einem Kurs des Studienzentrums IT-Management und Informatik oder aus dem Vorjahr eines anderen Studiengangs.

## Verworfene Alternative

Die Leseeinsicht auf die zugeordneten Bereiche zu beschränken und Vorlagen nur innerhalb des eigenen Bereichs zuzulassen. Das hätte den bisherigen Zuschnitt erhalten — [`SEED-DATEN.md`](../SEED-DATEN.md) begründet eigenständige Bereiche für Studiengänge ohne gemeinsames Studienzentrum ausdrücklich damit, dass es „die Rechtevergabe präzise hält“. Es hätte die Übernahme aber genau dort verhindert, wo sie am meisten spart, und einen Freigabemechanismus für fremde Vorlagen erfordert, der bei achtzehn Studiengängen und wenigen Beteiligten je Bereich unverhältnismäßig ist.

## Konsequenzen

Noch nicht veröffentlichte Planungen anderer Bereiche werden für alle internen Konten sichtbar. Unfertige und noch nicht abgestimmte Termine könnten dadurch als gesetzt gelesen werden; jeder nicht veröffentlichte Kurs ist deshalb sichtbar als solcher gekennzeichnet. Ursprünglich trug diese Kennzeichnung den zusätzlichen Namen „in Arbeit“; seit [ADR 0014](0014-in-arbeit-entfaellt.md) genügt der Veröffentlichungszustand selbst, und die Warnung steht auf der Kursseite des fremden Kurses.

Datenschutzrechtlich ändert sich nichts: Die Anwendung verarbeitet keine Studierendendaten, und die sichtbaren Angaben sind Planungsdaten der Hochschule.

Die Rücknahme dieser Entscheidung wird mit der Zeit teurer, sobald sich Bereiche darauf eingerichtet haben, aus fremden Kursen zu übernehmen.
