# DHBW Lörrach Plan

Webanwendung zur Planung und Veröffentlichung der Blockpläne der DHBW Lörrach:
Theorie- und Praxisphasen sowie prüfungsrelevante Termine je Kurs. Geplant und
veröffentlicht wird der einzelne Kurs; Blockpläne entstehen daraus als Darstellung
in einem gewählten Zuschnitt innerhalb eines Jahrgangs — ein einzelner Kurs, der
ganze Jahrgang oder ein Studiengang beziehungsweise ein Bereich darin.
Intern zeigt dieselbe Kursseite außerdem den aktuellen Vorlesungskalender aus dem
DHBW-Kalendersystem ausschließlich lesend an. Seine Kalendertermine werden nicht
in den Planungsstand übernommen und nicht mit ihm veröffentlicht. Woche, Monat und
chronologische Liste sind direkt adressierbare Ansichten desselben externen Feeds.
Die Blockplanung ist der erste Baustein einer breiter angelegten
Anwendung für den Studienbetrieb.

Die Anwendung trägt den Produktnamen **DHBW Lörrach Plan** und ist für den Betrieb
unter `https://plan.apps.szi.dhbw-loerrach.de` vorgesehen. Das Repository und
seine technischen Artefakte behalten den Namen `dhbw-mgmt`.

## Stand

Planungs- und Veröffentlichungseinheit ist der Kurs, der Blockplan ist die
veröffentlichte Darstellung eines Zuschnitts (siehe
[ADR 0010](docs/adr/0010-kurs-als-planungs-und-veroeffentlichungseinheit.md) und
[ADR 0011](docs/adr/0011-systemweite-leseeinsicht-in-kurse.md)). Intern ist der
Kurs zugleich der Bearbeitungsgegenstand und hat genau eine Adresse, die alles
trägt, was ihn betrifft; die Kurse desselben Jahrgangs stehen dort nur zum
Vergleich daneben
([ADR 0013](docs/adr/0013-kurs-als-bearbeitungsgegenstand-vergleich-als-vorschau.md)).
Sein Zustand ist allein die Veröffentlichung — eine zweite Kennzeichnung „in Arbeit“
gibt es nicht mehr
([ADR 0014](docs/adr/0014-in-arbeit-entfaellt.md)).

Der aktuelle Funktions- und Regelumfang wird nicht zusätzlich in einem
Spezifikationsdokument nacherzählt. Maßgeblich sind Anwendungscode,
Datenbankschema und automatisierte Tests. [`CONTEXT.md`](CONTEXT.md) legt die
Domänensprache fest, die [`ADR`](docs/adr/) erklären grundlegende Entscheidungen.

Offen ist die Datenschutzerklärung: Der Footer verweist auf die allgemeinen
DHBW-Hinweise, während [`docs/ARCHITEKTUR_UND_BETRIEB.md`](docs/ARCHITEKTUR_UND_BETRIEB.md)
eine Beschreibung der konkreten Verarbeitungen dieser Anwendung verlangt. Ein
produktives Deployment hat noch nicht stattgefunden.

## Ausblick

Nach der Blockplanung soll die Anwendung um weitere Themen des Studienbetriebs wachsen — etwa um
Studienverlauf und Curricula, Vorlesungsplanung und Dozierendenmanagement. Diese
Bereiche sind bewusst noch nicht spezifiziert; die kanonische Domänensprache in
[`CONTEXT.md`](CONTEXT.md) umfasst ausschließlich die Blockplanung. Dass
der Kurs seine Planangaben selbst trägt, ist die Voraussetzung dafür, dass diese
Themen später ohne Bruch an ihm andocken können.

## Dokumentation

- [`CONTEXT.md`](CONTEXT.md) — kanonische Domänensprache
- [`docs/ARCHITEKTUR_UND_BETRIEB.md`](docs/ARCHITEKTUR_UND_BETRIEB.md) — Systemgrenzen und externer Betriebsrahmen
- [`docs/BETRIEBSHANDBUCH.md`](docs/BETRIEBSHANDBUCH.md) — Sicherung, Migration, Wiederherstellung und Notfallbefehle
- [`docs/OEFFENTLICHE_API.md`](docs/OEFFENTLICHE_API.md) — externer Vertrag der öffentlichen API
- [`docs/BARRIEREFREIHEIT.md`](docs/BARRIEREFREIHEIT.md) — verbindliche Gestaltungs- und Abnahmekriterien
- [`docs/SEED-DATEN.md`](docs/SEED-DATEN.md) — verbindlicher initialer Stammdatensatz
- [`docs/adr/`](docs/adr/) — Architekturentscheidungen mit Begründung

## Entwicklung

```bash
npm install
cp env.example .env.local
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

Der erste Start legt `data/dhbw-mgmt.sqlite` an, spielt die Migrationen ein und
schreibt die Bereiche und Studiengänge aus [`docs/SEED-DATEN.md`](docs/SEED-DATEN.md).
Der Seed läuft bei jedem Start idempotent mit; einen gesonderten Befehl gibt es nicht.

Für die Kommandozeilenbefehle wird eine `.env.local` benötigt; im Betrieb kommen
dieselben Variablen aus der Container-Umgebung:

```
DATABASE_URL=./data/dhbw-mgmt.sqlite
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=development-only-secret-change-before-production
DHBW_CALENDAR_URL_TEMPLATE=https://webmail.dhbw-loerrach.de/owa/calendar/kal-{course}@dhbw-loerrach.de/Kalender/calendar.ics
```

`DHBW_CALENDAR_URL_TEMPLATE` ist optional und muss genau den Platzhalter `{course}`
enthalten. Ohne Angabe verwendet die Anwendung die oben gezeigte Adresse. Eine Angabe
ohne diesen Platzhalter wird beim Start abgewiesen und nicht als vorübergehend nicht
erreichbarer Kalender ausgegeben. Der
Vorlesungskalender ist nur für interne Konten mit systemweiter Kurseinsicht erreichbar;
erfolgreiche Feeds werden pro Anwendungsprozess zehn Minuten zwischengespeichert.

Das erste Systemadministrationskonto anlegen — der Befehl gibt den einmalig
verwendbaren Passwortlink auf der Standardausgabe aus:

```bash
npm run bootstrap:admin -- --email <dienstliche-e-mail>
```

Zum Zurücksetzen der lokalen Datenbank `rm -f data/dhbw-mgmt.sqlite*` ausführen
(die WAL-Dateien müssen mit weg) und danach Seed und Bootstrap wiederholen.

Die Betriebsbefehle laufen auch lokal; ihr Zusammenspiel steht im
[Betriebshandbuch](docs/BETRIEBSHANDBUCH.md):

```bash
npm run migrate:db                         # ausstehende Migrationen anwenden
npm run backup:db -- --to <zieldatei>      # geprüfte Sicherung erstellen
npm run restore:db -- --from <snapshot>    # Sicherung bei gestoppter Anwendung einspielen
```
