# DHBW Management

Webanwendung zur Verwaltung und Veröffentlichung von Blockplänen der DHBW Lörrach:
Theorie- und Praxisphasen sowie prüfungsrelevante Termine je Kurs und Jahrgang.

## Stand

Die fachliche Spezifikation ist abgeschlossen, die Implementierung hat noch nicht
begonnen — der Code ist unverändertes `create-next-app`-Gerüst
(Next.js 16, React 19, TypeScript, Tailwind CSS 4).

## Dokumentation

- [`CONTEXT.md`](CONTEXT.md) — Domänensprache und fachliche Datenregeln
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
