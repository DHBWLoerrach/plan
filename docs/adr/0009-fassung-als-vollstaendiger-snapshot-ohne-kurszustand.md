---
status: superseded by ADR-0012
---

# Veröffentlichte Fassung als vollständiger Snapshot, Kurse ohne Veröffentlichungszustand

> [ADR 0010](0010-kurs-als-planungs-und-veroeffentlichungseinheit.md) hält den vollständigen Snapshot fest, hebt aber die Aussage „Kurse tragen keinen Veröffentlichungszustand“ auf: Der Kurs ist dort selbst die Veröffentlichungseinheit.

Die veröffentlichte Fassung übernimmt als Snapshot alles, was sie öffentlich zeigt: neben den Bezeichnungen von Bereich und Studiengang auch Kurskennung, Studienbeginn und Studienende des Kurses. Sie verweist zur Herkunft auf die unveränderliche Kurs-ID. Der Kurs bleibt dadurch jederzeit bearbeitbar und ist löschbar, sobald keine veröffentlichte Fassung ihn zeigt — die Fassung liest nichts aus ihm nach. Ob ein Kurs schon einmal veröffentlicht wurde, hält eine dauerhafte Markierung am Kurs fest; sie unterscheidet „noch nie veröffentlicht“ von „zurückgenommen“ und ersetzt die frühere Ableitung über Kursmerkmale (ADR 0008). Die Zurücknahme selbst löscht weiterhin die veröffentlichte Fassung.

## Verworfene Alternative

Zuvor wurden Kurse mit der ersten Veröffentlichung dauerhaft als veröffentlicht gekennzeichnet: unveränderliche Kursangaben, eine nur wachsende öffentliche Kursmenge und Korrekturen nur per Datenmigration. Das stellte sicher, dass sich öffentlich sichtbare Kursdaten nie ändern und jede spätere Veröffentlichung alle je veröffentlichten Kurse wieder enthält. Den ersten Zweck erfüllen vollständige Snapshots ohne jede Sonderregel. Der zweite schützt bei zwei bis vier abgestimmten Personen je Bereich, ausdrücklichem Veröffentlichungsschritt und Vorschau kein reales Risiko, stand aber einfachen Korrekturen — etwa einer falsch erfassten Kurskennung — dauerhaft im Weg.

## Konsequenzen

Interne Änderungen an einem Kurs wirken öffentlich erst mit seiner nächsten Veröffentlichung; bis dahin darf die veröffentlichte Fassung von seinem Planungsstand abweichen — derselbe Grundsatz, der bereits für Bezeichnungen galt. Ein Kurs besitzt höchstens eine veröffentlichte Fassung. Das Löschen eines Kurses wird abgelehnt, solange seine veröffentlichte Fassung besteht; nach einer Zurücknahme ist er löschbar.
