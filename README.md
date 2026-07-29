# DHBW Lörrach Plan

Webanwendung zur Planung und Veröffentlichung der Blockpläne der DHBW Lörrach:
Theorie- und Praxisphasen sowie prüfungsrelevante Termine je Kurs. Geplant und
veröffentlicht wird der einzelne Kurs; Blockpläne entstehen daraus als Darstellung
in einem gewählten Zuschnitt innerhalb eines Jahrgangs — ein einzelner Kurs, der
ganze Jahrgang oder ein Studiengang beziehungsweise ein Bereich darin.
Die Blockplanung ist der erste Baustein einer breiter angelegten
Anwendung für den Studienbetrieb.

Die Anwendung trägt den Produktnamen **DHBW Lörrach Plan** und ist für den Betrieb
unter `https://plan.apps.szi.dhbw-loerrach.de` vorgesehen. Das Repository und
seine technischen Artefakte behalten den Namen `dhbw-mgmt`.

## Stand

Implementierung und Dokumentation folgen demselben fachlichen Schnitt: Planungs-
und Veröffentlichungseinheit ist der Kurs, der Blockplan ist die veröffentlichte
Darstellung eines Zuschnitts (siehe
[ADR 0010](docs/adr/0010-kurs-als-planungs-und-veroeffentlichungseinheit.md) und
[ADR 0011](docs/adr/0011-systemweite-leseeinsicht-in-kurse.md)).

Umgesetzt sind (Next.js 16, React 19, TypeScript, Tailwind CSS 4, SQLite über
Drizzle, Better Auth) die öffentliche Suche mit URL-basierten Filtern und die
öffentlichen Zuschnittansichten, der Zuschnitt-Editor mit Gegenüberstellung,
Vorschau, Veröffentlichung und Zurücknahme je Kurs, die Kursverwaltung
einschließlich der Anlage als Übernahme aus einer Vorlage, die systemweite
Leseeinsicht auf Kurse aller Bereiche bei bereichsgebundenem Schreibrecht, die
Kontenverwaltung mit Passwortlinks sowie die Kommandozeilenbefehle für das
initiale Systemadministrationskonto und den Notfall-Passwort-Reset.
Nonce-basierte CSP, Security-Header, Origin-Prüfung und der Betriebsweg aus
Sicherung, Migration und Wiederherstellung sind umgesetzt und getestet.

Offen ist die Datenschutzerklärung: Der Footer verweist auf die allgemeinen
DHBW-Hinweise, während [`docs/ARCHITEKTUR_UND_BETRIEB.md`](docs/ARCHITEKTUR_UND_BETRIEB.md)
eine Beschreibung der konkreten Verarbeitungen dieser Anwendung verlangt. Ein
produktives Deployment hat noch nicht stattgefunden.

## Ausblick

Nach dem MVP soll die Anwendung über die Blockplanung hinaus wachsen — etwa um
Studienverlauf und Curricula, Vorlesungsplanung und Dozierendenmanagement. Diese
Bereiche sind bewusst noch nicht spezifiziert; die kanonische Domänensprache in
[`CONTEXT.md`](CONTEXT.md) umfasst ausschließlich die Blockplanung. Dass
der Kurs seine Planangaben selbst trägt, ist die Voraussetzung dafür, dass diese
Themen später ohne Bruch an ihm andocken können.

## Dokumentation

- [`CONTEXT.md`](CONTEXT.md) — kanonische Domänensprache
- [`docs/FACHLICHE_REGELN.md`](docs/FACHLICHE_REGELN.md) — Invarianten, Lebenszyklen und Berechtigungen
- [`docs/MVP-SPEZIFIKATION.md`](docs/MVP-SPEZIFIKATION.md) — Zielumfang, Rollen, Ansichten
- [`docs/ARCHITEKTUR_UND_BETRIEB.md`](docs/ARCHITEKTUR_UND_BETRIEB.md) — Anwendungsschnitt, Auth, Datenhaltung, Betrieb
- [`docs/BETRIEBSHANDBUCH.md`](docs/BETRIEBSHANDBUCH.md) — Sicherung, Migration, Wiederherstellung und Notfallbefehle
- [`docs/BARRIEREFREIHEIT.md`](docs/BARRIEREFREIHEIT.md) — verbindliche Gestaltungs- und Abnahmekriterien
- [`docs/adr/`](docs/adr/) — Architekturentscheidungen mit Begründung

## Entwicklung

```bash
npm install
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
```

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
