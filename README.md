# DHBW Management

Webanwendung zur Verwaltung und Veröffentlichung von Blockplänen der DHBW Lörrach:
Theorie- und Praxisphasen sowie prüfungsrelevante Termine je Kurs und Jahrgang.
Die Blockplanverwaltung ist der erste Baustein einer breiter angelegten Anwendung
für den Studienbetrieb.

## Stand

Die fachliche Spezifikation ist abgeschlossen, die Implementierung hat noch nicht
begonnen — der Code ist unverändertes `create-next-app`-Gerüst
(Next.js 16, React 19, TypeScript, Tailwind CSS 4).

## Ausblick

Nach dem MVP soll die Anwendung über die Blockplanung hinaus wachsen — etwa um
Studienverlauf und Curricula, Vorlesungsplanung und Dozierendenmanagement. Diese
Bereiche sind bewusst noch nicht spezifiziert; die kanonische Domänensprache in
[`CONTEXT.md`](CONTEXT.md) umfasst ausschließlich die Blockplanverwaltung.

## Dokumentation

- [`CONTEXT.md`](CONTEXT.md) — kanonische Domänensprache
- [`docs/FACHLICHE_REGELN.md`](docs/FACHLICHE_REGELN.md) — Invarianten, Lebenszyklen und Berechtigungen
- [`docs/MVP-SPEZIFIKATION.md`](docs/MVP-SPEZIFIKATION.md) — Zielumfang, Rollen, Ansichten
- [`docs/ARCHITEKTUR_UND_BETRIEB.md`](docs/ARCHITEKTUR_UND_BETRIEB.md) — Anwendungsschnitt, Auth, Datenhaltung, Betrieb
- [`docs/BARRIEREFREIHEIT.md`](docs/BARRIEREFREIHEIT.md) — verbindliche Gestaltungs- und Abnahmekriterien
- [`docs/adr/`](docs/adr/) — Architekturentscheidungen mit Begründung

## Entwicklung

```bash
npm install
npm run dev    # http://localhost:3000
npm run build
npm run lint
```
