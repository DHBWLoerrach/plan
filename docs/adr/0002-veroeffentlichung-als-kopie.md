# Veröffentlichung kopiert den Entwurf in eine eigenständige Fassung

Ein Blockplan hat durchgehend einen Entwurf und höchstens eine veröffentlichte Fassung, die nebeneinander existieren und sich unabhängig entwickeln. Veröffentlichen liest den Entwurf, prüft ihn und legt seinen Inhalt als **Kopie** ab: Blockphasen, Kursphasen und prüfungsrelevante Termine der veröffentlichten Fassung sind eigene Zeilen mit eigenen Identitäten. Der Entwurf bleibt dabei unverändert und weiter bearbeitbar.

## Verworfene Alternative

Blockphasen und Termine hätten eine fassungsübergreifende fachliche Identität tragen können, mit einer Gültigkeitsmarkierung je Zeile statt zweier Kopien. Das hätte jede einzelne Zeile versioniert — genau die Komplexität, die [ADR 0001](0001-versionsgrenze-blockplan.md) durch die grobe Versionsgrenze vermeiden wollte. Weil frühere Revisionen nie aufbewahrt werden, existieren bei der Kopie höchstens zwei Ausfertigungen des Inhalts; der Speicherplatz ist also kein Argument für die geteilte Identität.

Die Kopie ist nur möglich, weil nichts von außerhalb einer Fassung auf eine Blockphase zeigt: Kursphasen und Termine liegen in derselben Fassung, und die Kurszuordnung gehört laut ADR 0001 dem Blockplan. Eine kopierte Kursphase verweist auf die kopierte Blockphase und auf denselben Kurs.

## Ablauf und Lebensdauer

Veröffentlichen, Ersetzen der bisherigen Fassung und Audit-Eintrag laufen in einer Transaktion. Die abgelöste Fassung wird dabei gelöscht, nicht aufbewahrt — zu jedem Zeitpunkt existiert pro Blockplan genau null oder eine Fassung.

Es gibt genau **einen** Veröffentlichungsweg, unabhängig davon, ob der Blockplan noch nie, gerade oder zuletzt zurückgenommen veröffentlicht war: Der aktuelle Entwurf wird geprüft und abgelegt. Eine Zurücknahme entfernt nur die öffentliche Sichtbarkeit; die zurückgenommene Fassung bleibt unsichtbar liegen, bis die nächste Veröffentlichung sie ersetzt. Ein gesondertes Wiederherstellen der zurückgenommenen Fassung gibt es nicht.

## Konsequenzen

Wer versehentlich zurückgenommen hat, veröffentlicht neu statt eine Rücknahme rückgängig zu machen. Solange der Entwurf zwischenzeitlich nicht verändert wurde, ist das Ergebnis identisch; wurde er verändert, wird die geänderte Fassung veröffentlicht — was der Erwartung entspricht, dass veröffentlicht wird, was im Entwurf steht.

Eine erneute Veröffentlichung prüft stets erneut alle Regeln. Eine Fassung, die nach heute nicht mehr gültigen Annahmen freigegeben wurde, kann daher unveröffentlichbar werden, während sie sichtbar bleibt. Das ist gewollt: Es zwingt zur Korrektur, statt einen veralteten Stand stillschweigend zu reaktivieren.
