# „In Arbeit“ entfällt: nicht veröffentlicht ist der ganze Zustand

Ein Kurs ist veröffentlicht oder nicht veröffentlicht. Eine zweite Kennzeichnung „in Arbeit“ gibt es nicht — weder im Glossar, noch im Datenmodell, noch in einer Ansicht. Die Warnung, die sie tragen sollte, trägt der Satz auf der Kursseite eines fremden Kurses.

Die Kennzeichnung stammt aus dem Modell vor [ADR 0012](0012-veroeffentlichung-als-sichtbarkeit-des-kurses.md). Damals besaß ein Kurs neben seiner veröffentlichten Fassung einen davon abweichenden Planungsstand ([ADR 0002](0002-veroeffentlichung-als-kopie.md), [ADR 0009](0009-fassung-als-vollstaendiger-snapshot-ohne-kurszustand.md)), und „in Arbeit“ war eine eigene Aussage: dieser Kurs ist öffentlich sichtbar, aber woran gerade gearbeitet wird, ist etwas anderes. Seit ADR 0012 gibt es diesen zweiten Datenstand nicht mehr. Damit fiel die Kennzeichnung mit „nicht veröffentlicht“ zusammen, blieb aber stehen: Jede Liste, jeder Seitenkopf und jede Spalte der Planmatrix trug seither zwei Benennungen für ein und dasselbe Bit.

Der Anlass, das aufzulösen, war die Überladung der internen Ansichten. Zwei Wörter für einen Sachverhalt kosten in einer Tabelle mit vielen Zeilen mehr als sie sagen, und ein Leser, der zwei Namen vorfindet, muss annehmen, dass sie zwei Dinge bedeuten.

## Wo die Warnung stattdessen steht

[ADR 0011](0011-systemweite-leseeinsicht-in-kurse.md) hat die Kennzeichnung eingeführt, damit unfertige Planungen fremder Bereiche nicht als gesetzt gelesen werden. Dieser Zweck bleibt, sein Träger wechselt:

- Die Kursseite eines Kurses aus einem nicht zugeordneten Bereich sagt in einem Satz, dass nur gelesen werden kann, und trägt gar keine Bedienoberfläche zum Schreiben.
- Ist ein Kurs nicht veröffentlicht, ist seine Spalte in der Planmatrix als solche markiert — dort, wo seine Kurskennung ohnehin steht. Das gilt auch für den bearbeiteten Kurs, obwohl der seinen Zustand auf derselben Seite bereits zweimal nennt: Wäre er ausgenommen, hieße eine fehlende Markierung neben ihm „veröffentlicht“ und auf ihm „hier nicht ausgewiesen“, und eine Kopfzeile, die Spalten vergleichbar machen soll, beschriftete ihre Spalten nach zwei Regeln.

Beides sagt mehr als das Wort „in Arbeit“, und beides steht an genau einer Stelle statt in jeder Zeile.

Was diese Markierung nennt, ist der Zustand und nur er. Die Zahl offener Punkte eines Vergleichskurses steht nicht daneben: Sie ist an einem Kurs, den man gerade nicht bearbeitet, nicht handlungsleitend, und die Warnung aus ADR 0011 lautet allein, dass diese Planung noch nicht steht. „Veröffentlicht“ bleibt ebenfalls unerwähnt — der Normalfall braucht keinen Vermerk, und ein Vermerk an jeder Spalte wäre wieder die Wiederholung, die dieses ADR abschafft.

## Verworfene Alternativen

**Umgekehrt entscheiden und intern nur „in Arbeit“ zeigen.** Wäre kürzer in Spalten und Zeilen und näher an dem, was der Zustand für den Lesenden bedeutet. Hätte aber die zugehörige Handlung verdeckt — sie heißt „veröffentlichen“ — und einen internen Namen eingeführt, den der Abschnitt Veröffentlichung direkt daneben nicht verwendet und die öffentliche Ansicht gar nicht kennt.

**Beides behalten.** Hätte nichts gekostet und [`BARRIEREFREIHEIT.md`](../BARRIEREFREIHEIT.md) unberührt gelassen. Hätte aber den Widerspruch festgeschrieben, den ADR 0012 im Datenmodell längst aufgelöst hat.

## Konsequenzen

`workInProgress` entfällt aus dem Anwendungscode; `courseStatus` wird zu `publicationState` und liefert nur noch den Veröffentlichungszustand. Die Planmatrix verliert die Eigenschaft `workInProgressCourseIds`.

Der letzte Absatz der Konsequenzen von ADR 0011 gilt in diesem Punkt nicht mehr. Die dort beschriebene Gefahr besteht unverändert; sie wird nur anders beantwortet.

Der Zustand einer Vergleichsspalte steht dort, wo der Kurs benannt ist, statt in einer Aufzählung der Vergleichskurse über der Matrix, die dieselben Kurse ein zweites Mal durchgegangen wäre. Ein Zeichen hinter der Kennung genügt dafür: Ausgeschrieben hätte es den Kopf der Matrix um zwei bis drei Zeilen je Spalte wachsen lassen und bei einem Vergleich über den ganzen Jahrgang denselben Satz ein Dutzend Mal wiederholt. Der Preis ist ein Nachschlagen im auflösenden Satz unter der Tabelle; assistive Technik hört den Wortlaut ohne diesen Umweg.
