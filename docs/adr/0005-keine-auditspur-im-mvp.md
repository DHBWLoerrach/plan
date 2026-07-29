# Keine Auditspur im MVP

Für das MVP ist keine konkrete organisatorische, rechtliche oder prüfungsbezogene Anforderung benannt, historische Änderungen oder administrative Aktionen nachzuweisen. Das MVP speichert deshalb keine Auditereignisse, alten und neuen Werte oder gesonderten Sicherheitsereignisse und bietet keine Auditoberfläche. Technische Logs bleiben auf Betrieb und Fehlerdiagnose beschränkt; sie sind keine fachliche Auditspur.

## Verworfene Alternative

Eine allgemeine Auditspur hätte spätere Fragen nach Auslöser und Inhalt einer Änderung beantworten können. Dafür wären jedoch ein zusätzliches Ereignismodell, Schreiblogik in nahezu jeder Fachoperation, unveränderliche Sichtbarkeitszuordnungen, eine eigene Rechte- und Filteroberfläche sowie zusätzliche Datenschutz- und Testanforderungen nötig gewesen. Eine lediglich unsichtbar mitgeschriebene Audit-Tabelle hätte fast denselben Aufwand verursacht, ohne dem MVP einen aktuellen Nutzen zu geben.

## Konsequenzen

Am Kurs bleiben ausschließlich `draft_updated_at` und `draft_updated_by_account_id` für die Änderungsanzeige sowie die Aktualitätsprüfung vor dem Veröffentlichen erhalten. Veröffentlichungen, Rücknahmen und administrative Kontoaktionen erhalten keine personenbezogene Änderungshistorie. Außergewöhnliche Datenkorrekturen erfolgen als gesonderte, außerhalb der Anwendung manuell dokumentierte Datenmigration.

Entsteht später ein konkreter Nachweiszweck, beginnt eine neue Protokollierung ab einem dokumentierten Einführungsstichtag. Auslöser und frühere Werte von Änderungen vor diesem Stichtag lassen sich nicht rückwirkend rekonstruieren.
