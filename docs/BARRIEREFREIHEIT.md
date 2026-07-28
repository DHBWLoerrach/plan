# Barrierefreiheit und responsive Nutzung

Für sämtliche öffentlichen und internen Oberflächen des neu entwickelten MVP ist WCAG 2.2 AA verbindliches Abnahmekriterium. Die rechtliche Einordnung nach EN 301 549 und der darin referenzierten WCAG 2.1 bleibt davon unberührt.

Vor Go-live wird mit der zuständigen DHBW-Stelle geklärt, ob Erklärung zur Barrierefreiheit und Rückmeldeweg zentral oder in der Anwendung bereitgestellt werden; Geltungsbereich, Verantwortlichkeit, Rückmeldekanal und Aktualisierungsprozess sind dabei verbindlich festzulegen. Die rechtlichen Pflichtinformationen insgesamt behandelt [Architektur und Betrieb](ARCHITEKTUR_UND_BETRIEB.md); barrierefreiheitsseitig gilt, dass sie in allen Ansichten an einer konsistenten Stelle per Tastatur und Screenreader erreichbar sind.

## Öffentliche Planmatrix

- Die Matrix ist eine echte Datentabelle mit `caption`, Kopfzellen und programmatisch bestimmbaren Zeilen- und Spaltenbezügen.
- Jedes Semester besitzt eine eigene Zeilengruppe innerhalb der Tabelle; ihre Semesterzelle ist die Überschrift der Gruppe. Die Zeitraumspalte und die Kurskennungen bilden eindeutige Zeilen- und Spaltenüberschriften; geteilte visuelle Zellen dürfen die programmatische Zuordnung nicht verschleiern. Erstreckt sich eine Kursphase über mehrere Zeiträume der Tabelle, ist sie eine über diese Zeilen verbundene Zelle und bleibt jeder von ihnen zugeordnet.
- Theorie, Praxis, „Nicht in diesem Semester“ und vorläufige Zeitangaben prüfungsrelevanter Termine sind immer auch textlich benannt; Farbe, Schraffur, Abkürzung, Symbol, leere Fläche oder Position sind nur Ergänzungen. Zeigt eine Matrixzelle sichtbar nur die Abkürzung „T“ oder „P“, bleibt die volle Benennung in der Zelle für assistive Technik erhalten und eine Legende unter dem Tabellentitel löst die Abkürzungen sichtbar auf. Die Legende benennt nur, was die Tabelle zeigt, und bleibt assistiver Technik verborgen, weil diese in jeder Zelle die volle Benennung erhält. Die Phasenflächen bleiben auch im Ausdruck erhalten. Veröffentlichungszustände treten hier nicht auf, da die öffentliche Ansicht ausschließlich veröffentlichte Fassungen zeigt.
- Der Überblick über den gesamten Verlauf ist eine Balkengrafik und trägt seine Aussage über Fläche, Länge und Position. Er bleibt deshalb assistiver Technik verborgen: Die Matrix darunter führt denselben Plan vollständig, textlich benannt und mit den Datumsangaben, die die Grafik nur als Längen zeigt. Innerhalb der Grafik bleibt jede Phase benannt — eine für ihre Beschriftung zu kurze Phase nennt ihre Dauer unterhalb der Balken an einer Linie zu ihrem Balken, statt unbeschriftet zu bleiben. Phasentypen unterscheiden sich in Fläche und Kontur; die Konturen halten den Nichttextkontrast von 3:1. Auf schmalen Anzeigen und bei starker Textvergrößerung entfällt die Grafik ersatzlos, ohne dass Inhalt verloren geht.
- Die Inhalte bleiben bei 320 CSS-Pixeln Breite, 200 % Textvergrößerung und 400 % Browser-Zoom vollständig verfügbar. Notwendiges horizontales Scrollen ist erkennbar, per Tastatur erreichbar und frei von Fokusfallen. Eine beschriftete Kursauswahl kann sichtbare Kursspalten reduzieren; alle Kurse bleiben auswählbar und die Auswahländerung wird angekündigt.
- Alle Funktionen sind per Tastatur erreichbar; Fokus ist sichtbar, sinnvoll angeordnet und alle Bedienelemente sind eindeutig benannt.
- Der Tastaturfokus wird weder durch fixierte Kopfbereiche noch durch Dialoge oder Statusflächen vollständig verdeckt. Interaktive Zielgrößen erfüllen WCAG 2.2 AA oder besitzen den dort vorgesehenen ausreichenden Abstand.
- Dynamische Status-, Filter- und Seitenänderungen werden verständlich angekündigt. Ergebnisanzahl, aktive Filter, Gruppenzugehörigkeit und Paginierung sind auch für Screenreader eindeutig; Vor-/Zurück-Navigation stellt denselben Zustand wieder her.
- Die chronologische Termintabelle nennt betroffene Kurse und das je Kurs abgeleitete Semester ausdrücklich; Bedeutung wird nicht allein durch räumliche Zuordnung zu einer Semestertabelle vermittelt.

## Interner Editor

- Der Sprunglink „Zum Inhalt springen“ führt hinter sämtliche wiederkehrenden Navigationsblöcke. Die Bereichsnavigation des internen Bereichs steht deshalb vor dem Inhaltsbereich und nicht als dessen erstes Element (WCAG 2.4.1 „Blöcke umgehen“).
- Anmeldung, Passwortvergabe und Passwortänderung erlauben Passwortmanager, Autofill und Einfügen und verlangen keine kognitive Aufgabe wie das Abschreiben oder Erinnern zusätzlicher Inhalte.
- Jede Eingabe besitzt ein sichtbares und programmatisch verknüpftes Label. Pflichtangaben und zulässige Formate sind vor der Eingabe erklärt.
- Validierungsfehler erscheinen am Feld und zusätzlich in einer Fehlerübersicht; bekannte Korrekturmöglichkeiten werden genannt.
- Gespeicherte Entwürfe, aktualisierte Vorschauen sowie erfolgreiche oder fehlgeschlagene Veröffentlichungen werden als zugängliche Statusmeldungen ausgegeben.
- Semester-Navigation sowie Fehler- und Vollständigkeitsstatus sind programmatisch bestimmt und per Tastatur erreichbar. Ein Status wird nie nur durch Farbe oder Symbol vermittelt.
- Die gemeinsame Anlage einer Kursphase für mehrere ausgewählte Kurse erklärt vor dem Speichern, dass eigenständige Kursphasen entstehen und spätere Änderungen nur auf die jeweils bearbeitete Kursphase wirken.
- Jede Bearbeitungsfunktion funktioniert ohne Maus. Falls Phasen visuell sortiert werden, existieren gleichwertige Verschiebe-Schaltflächen; Drag-and-drop ist nie erforderlich.
- Der Veröffentlichungszustand eines Blockplans — noch nie veröffentlicht, veröffentlicht, zurückgenommen — ist immer auch textlich benannt, in Listen ebenso wie in der Detailansicht; Farbe, Symbol oder Position sind nur Ergänzungen. Der Entwurf ist kein Zustand dieser Reihe, sondern existiert in allen dreien.
- Dialoge, Menüs und Bestätigungen besitzen korrekte Fokusführung, Escape-Verhalten und Fokus-Rückkehr. Die Vorschau erfüllt dieselben semantischen Regeln wie die öffentliche Matrix.
- Bestätigungen für Löschung, Kontosperrung, Zurücknahme, Rechteänderung und die Ausstellung eines neuen Passwortlinks benennen Aktion, Ziel und Folgen im zugänglichen Namen beziehungsweise in der zugeordneten Beschreibung; eine generische Schaltfläche „OK“ genügt nicht.
- Hat sich die angezeigte Vorschau vor dem Veröffentlichen geändert, wird der neu geladene Stand verständlich angekündigt und der Hinweis erklärt die erforderliche erneute Freigabe.

## Nachweis vor Abnahme

- Automatisierte Scans ergänzen manuelle Prüfungen aller wesentlichen Abläufe: Plan suchen und lesen, Kurs wechseln, Phasen und Termine bearbeiten, speichern, veröffentlichen und zurücknehmen.
- Tastaturtest mit Tab, Shift+Tab, Enter, Leertaste und Escape: sichtbarer Fokus, sinnvolle Reihenfolge, keine Fokusfalle.
- Screenreader-Test mit VoiceOver/Safari, insbesondere für Matrix, Fehler, Dialoge und Statusmeldungen. Ein weiteres Browser-Screenreader-Gespann wird erst bei konkreten Interoperabilitätsproblemen oder vor einem breiteren Regelbetrieb in die verbindliche Abnahme aufgenommen.
- Visueller Test von Text- und Nichttextkontrast, 200 % Textvergrößerung, 400 % Zoom und schmaler mobiler Breite. Fehler, Phasentypen und vorläufige Zeitangaben sind nie nur farblich unterscheidbar; im internen Editor gilt dasselbe für den Veröffentlichungszustand.

## Quellen

- [§ 10 L-BGG](https://www.landesrecht-bw.de/bsbw/?docId=jlr-NNLBW00007D3ENN00000000017&query=JURISLINK%3A%22BehGleichStG+BW+%C2%A7+10%22)
- [DHBW-Impressum](https://www.dhbw.de/impressum/)
- [L-BGG-DVO, Anlage 1](https://www.landesrecht-bw.de/bsbw/?query=DOKNR%3Ajlr-BehGleichStGDVBWpAnlage1&source=PermaLink)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
