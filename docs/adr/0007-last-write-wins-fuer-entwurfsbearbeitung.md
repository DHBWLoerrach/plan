---
status: amended by ADR-0010
---

# Last-write-wins für die granulare Bearbeitung des Planungsstands

Normale Speicheraktionen bearbeiten jeweils nur eine konkrete Plan- oder Kursangabe und verwenden im MVP Last-write-wins. Bei den zwei bis vier unmittelbar zusammenarbeitenden Personen pro Bereich rechtfertigen seltene Überschreibungen keinen allgemeinen Versionszähler. Veröffentlichen vergleicht weiterhin den Änderungszeitpunkt der angezeigten Vorschau; Zurücknehmen vergleicht den konkret angezeigten Veröffentlichungszeitpunkt. Änderungen an veröffentlichten Kursen besitzen wegen ihrer unmittelbaren öffentlichen Wirkung einen Vorschau- und Bestätigungspfad und werden vollständig validiert.
