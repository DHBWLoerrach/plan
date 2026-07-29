---
status: amended by ADR-0010
---

# Veröffentlichung kopiert den Planungsstand in eine eigenständige Fassung

Ein Kurs hat durchgehend einen Planungsstand und höchstens eine veröffentlichte Fassung, die nebeneinander existieren und sich unabhängig entwickeln. Veröffentlichen liest den Planungsstand, prüft ihn und legt seinen Inhalt als **Kopie** ab: Kursphasen und prüfungsrelevante Termine der veröffentlichten Fassung sind eigene Zeilen mit eigenen Identitäten. Zusätzlich werden die zu diesem Zeitpunkt geltenden öffentlichen Anzeigenamen von Bereich und Studiengang sowie die Kursangaben als Snapshots übernommen. Der Planungsstand bleibt dabei unverändert und weiter bearbeitbar.

## Verworfene Alternative

Kursphasen und Termine hätten eine fassungsübergreifende fachliche Identität tragen können, mit einer Gültigkeitsmarkierung je Zeile statt zweier Kopien. Das hätte jede einzelne Zeile versioniert — genau die Komplexität, die [ADR 0001](0001-versionsgrenze-blockplan.md) durch die grobe Versionsgrenze vermeiden wollte. Weil frühere Revisionen nie aufbewahrt werden, existieren bei der Kopie höchstens zwei Ausfertigungen des Inhalts; der Speicherplatz ist also kein Argument für die geteilte Identität.

Die Kopie ist nur möglich, weil nichts von außerhalb einer Fassung auf eine Kursphase zeigt: Kursphasen und Termine liegen in derselben Fassung. Eine kopierte Kursphase verweist auf die veröffentlichte Fassung; deren Herkunfts-ID bezeichnet denselben Kurs wie das Gegenstück im Planungsstand.

## Ablauf und Lebensdauer

Veröffentlichen und Ersetzen der bisherigen Fassung laufen in einer Transaktion. Die abgelöste Fassung wird dabei gelöscht, nicht aufbewahrt — zusätzlich zum Planungsstand existiert je Kurs zu jedem Zeitpunkt genau null oder eine veröffentlichte Fassung.

Es gibt genau **einen** Veröffentlichungsweg, unabhängig davon, ob der Kurs noch nie, gerade oder zuletzt zurückgenommen veröffentlicht war: Der aktuelle Planungsstand wird geprüft und abgelegt. Eine Zurücknahme löscht die veröffentlichte Fassung; ein gesondertes Wiederherstellen gibt es nicht (siehe [ADR 0009](0009-fassung-als-vollstaendiger-snapshot-ohne-kurszustand.md)).

## Konsequenzen

Wer versehentlich zurückgenommen hat, veröffentlicht neu statt eine Rücknahme rückgängig zu machen. Solange der Planungsstand zwischenzeitlich nicht verändert wurde, ist das Ergebnis identisch; wurde er verändert, wird der geänderte Stand veröffentlicht — was der Erwartung entspricht, dass veröffentlicht wird, was im Planungsstand steht.

Eine erneute Veröffentlichung prüft stets erneut alle Regeln. Eine Fassung, die nach heute nicht mehr gültigen Annahmen freigegeben wurde, kann daher unveröffentlichbar werden, während sie sichtbar bleibt. Das ist gewollt: Es zwingt zur Korrektur, statt einen veralteten Stand stillschweigend zu reaktivieren.
