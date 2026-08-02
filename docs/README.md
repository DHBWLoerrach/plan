# Quellen der Wahrheit

Für jede Art von Information gibt es genau eine maßgebliche Quelle. Aktuelles ausführbares Verhalten, fachliche Invarianten und technische Details stehen in Code, Datenbankschema und automatisierten Tests. Dokumentation wiederholt diesen Ist-Stand nicht.

- [`../CONTEXT.md`](../CONTEXT.md): kanonische Domänensprache ohne Verhaltensspezifikation.
- [`adr/`](adr/): Gründe, Alternativen und Konsequenzen grundlegender Entscheidungen. ADRs erklären ihre historische Entscheidung und sind keine vollständige Beschreibung des aktuellen Systems.
- [Architektur und Betriebsrahmen](ARCHITEKTUR_UND_BETRIEB.md): Systemgrenzen und externe Betriebs-, Datenschutz- und Deploymentannahmen, die nicht im Repository durchsetzbar sind.
- [Betriebshandbuch](BETRIEBSHANDBUCH.md): ausführbare Betriebswege für Sicherung, Migration, Wiederherstellung und Notfälle.
- [Öffentliche API](OEFFENTLICHE_API.md): versionierter, schreibgeschützter Vertrag für veröffentlichte Kursphasen.
- [Seed-Daten](SEED-DATEN.md): verbindliche Bereiche und Studiengänge für den initialen Seed.
- [Barrierefreiheit](BARRIEREFREIHEIT.md): verbindliche Gestaltungs- und Abnahmekriterien der Barrierefreiheit.
- [KI-Agent-Kursimport](KI_AGENT_KURSIMPORT.md): eigenständiger, außerhalb der Anwendung verwendbarer Importvertrag für einen KI-Agenten. Sein absichtlich wiederholtes Zielschema muss bei relevanten Schemaänderungen mitgeändert werden.

Eine separate Produkt- oder MVP-Spezifikation gibt es nicht mehr. Oberflächen, Routen und aktueller Funktionsumfang werden aus Anwendung und Tests abgelesen. Eine neue Dokumentdatei ist nur sinnvoll, wenn sie einen externen Vertrag, einen menschlichen Ablauf, kanonische Sprache oder die Begründung einer Entscheidung besitzt. Geplante Arbeit und noch nicht umgesetzte Anforderungen werden nicht als Beschreibung des Repositorys dokumentiert.
