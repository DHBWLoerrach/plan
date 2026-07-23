# Barrierefreiheit und responsive Nutzung

Für sämtliche öffentlichen und internen Oberflächen des neu entwickelten MVP ist WCAG 2.2 AA verbindliches Abnahmekriterium. Die rechtliche Einordnung nach EN 301 549 und der darin referenzierten WCAG 2.1 bleibt davon unberührt.

Vor Go-live wird mit der zuständigen DHBW-Stelle geklärt, ob Erklärung zur Barrierefreiheit und Rückmeldeweg zentral oder in der Anwendung bereitgestellt werden; Geltungsbereich, Verantwortlichkeit, Rückmeldekanal und Aktualisierungsprozess sind dabei verbindlich festzulegen. Die rechtlichen Pflichtinformationen insgesamt behandelt [Architektur und Betrieb](ARCHITEKTUR_UND_BETRIEB.md); barrierefreiheitsseitig gilt, dass sie in allen Ansichten an einer konsistenten Stelle per Tastatur und Screenreader erreichbar sind.

## Öffentliche Planmatrix

- Die Matrix ist eine echte Datentabelle mit `caption`, Kopfzellen und programmatisch bestimmbaren Zeilen- und Spaltenbezügen.
- Jedes Semester besitzt eine eigene Tabelle. Die Zeitraumspalte und die Kurskennungen bilden eindeutige Zeilen- und Spaltenüberschriften; geteilte visuelle Zellen dürfen die programmatische Zuordnung nicht verschleiern.
- Theorie, Praxis und vorläufige Zeitangaben prüfungsrelevanter Termine sind immer auch textlich benannt; Farbe, Symbol oder Position sind nur Ergänzungen. Veröffentlichungszustände treten hier nicht auf, da die öffentliche Ansicht ausschließlich veröffentlichte Fassungen zeigt.
- Die Inhalte bleiben bei 320 CSS-Pixeln Breite, 200 % Textvergrößerung und 400 % Browser-Zoom vollständig verfügbar. Notwendiges horizontales Scrollen ist erkennbar, per Tastatur erreichbar und frei von Fokusfallen. Eine beschriftete Kursauswahl kann sichtbare Kursspalten reduzieren; alle Kurse bleiben auswählbar und die Auswahländerung wird angekündigt.
- Alle Funktionen sind per Tastatur erreichbar; Fokus ist sichtbar, sinnvoll angeordnet und alle Bedienelemente sind eindeutig benannt.
- Der Tastaturfokus wird weder durch fixierte Kopfbereiche noch durch Dialoge oder Statusflächen vollständig verdeckt. Interaktive Zielgrößen erfüllen WCAG 2.2 AA oder besitzen den dort vorgesehenen ausreichenden Abstand.
- Dynamische Status-, Filter- und Seitenänderungen werden verständlich angekündigt. Ergebnisanzahl, aktive Filter, Gruppenzugehörigkeit und Paginierung sind auch für Screenreader eindeutig; Vor-/Zurück-Navigation stellt denselben Zustand wieder her.
- Die chronologische Termintabelle nennt betroffene Kurse und das je Kurs abgeleitete Semester ausdrücklich; Bedeutung wird nicht allein durch räumliche Zuordnung zu einer Semestertabelle vermittelt.

## Interner Editor

- Anmeldung, Aktivierung und Passwort-Reset erlauben Passwortmanager, Autofill und Einfügen und verlangen keine kognitive Aufgabe wie das Abschreiben oder Erinnern zusätzlicher Inhalte.
- Jede Eingabe besitzt ein sichtbares und programmatisch verknüpftes Label. Pflichtangaben und zulässige Formate sind vor der Eingabe erklärt.
- Validierungsfehler erscheinen am Feld und zusätzlich in einer Fehlerübersicht; bekannte Korrekturmöglichkeiten werden genannt.
- Gespeicherte Entwürfe, aktualisierte Vorschauen, erfolgreiche oder fehlgeschlagene Veröffentlichungen und Konflikte wegen eines zwischenzeitlich geänderten Blockplans oder Kurses werden als zugängliche Statusmeldungen ausgegeben. Ein Bearbeitungskonflikt erscheint zusätzlich in der Fehlerübersicht, erhält sinnvoll den Fokus und erklärt, dass vor einem erneuten Speichern der aktuelle Stand geladen werden muss.
- Semester-Navigation sowie Fehler- und Vollständigkeitsstatus sind programmatisch bestimmt und per Tastatur erreichbar. Ein Status wird nie nur durch Farbe oder Symbol vermittelt.
- Vor der Änderung einer gemeinsamen Blockphase wird textlich benannt, welche Kurse betroffen sind. Die Aktion „Für ausgewählte Kurse trennen“ ist ohne Drag-and-drop bedienbar und erklärt das Ergebnis vor dem Speichern.
- Jede Bearbeitungsfunktion funktioniert ohne Maus. Falls Phasen visuell sortiert werden, existieren gleichwertige Verschiebe-Schaltflächen; Drag-and-drop ist nie erforderlich.
- Der Veröffentlichungszustand eines Blockplans — noch nie veröffentlicht, veröffentlicht, zurückgenommen — ist immer auch textlich benannt, in Listen ebenso wie in der Detailansicht; Farbe, Symbol oder Position sind nur Ergänzungen. Der Entwurf ist kein Zustand dieser Reihe, sondern existiert in allen dreien.
- Dialoge, Menüs und Bestätigungen besitzen korrekte Fokusführung, Escape-Verhalten und Fokus-Rückkehr. Die Vorschau erfüllt dieselben semantischen Regeln wie die öffentliche Matrix.
- Bestätigungen für Löschung, Deaktivierung, Zurücknahme, Rechteänderung und Link-Neuausstellung benennen Aktion, Ziel und Folgen im zugänglichen Namen beziehungsweise in der zugeordneten Beschreibung; eine generische Schaltfläche „OK“ genügt nicht.
- Die Gegenüberstellung bei einem Bearbeitungskonflikt besitzt aussagekräftige Überschriften für gespeicherten Stand und abgelehnten Änderungsversuch; Unterschiede bleiben auch linearisiert verständlich.

## Nachweis vor Abnahme

- Automatisierte Scans ergänzen manuelle Prüfungen aller wesentlichen Abläufe: Plan suchen und lesen, Kurs wechseln, Phasen und Termine bearbeiten, speichern, einen Bearbeitungskonflikt behandeln, veröffentlichen und zurücknehmen.
- Tastaturtest mit Tab, Shift+Tab, Enter, Leertaste und Escape: sichtbarer Fokus, sinnvolle Reihenfolge, keine Fokusfalle.
- Screenreader-Test mindestens mit VoiceOver/Safari sowie einem zweiten unterstützten Browser-Screenreader-Gespann, insbesondere für Matrix, Fehler, Dialoge und Statusmeldungen.
- Visueller Test von Text- und Nichttextkontrast, 200 % Textvergrößerung, 400 % Zoom und schmaler mobiler Breite. Fehler, Phasentypen und vorläufige Zeitangaben sind nie nur farblich unterscheidbar; im internen Editor gilt dasselbe für den Veröffentlichungszustand.

## Quellen

- [§ 10 L-BGG](https://www.landesrecht-bw.de/bsbw/?docId=jlr-NNLBW00007D3ENN00000000017&query=JURISLINK%3A%22BehGleichStG+BW+%C2%A7+10%22)
- [DHBW-Impressum](https://www.dhbw.de/impressum/)
- [L-BGG-DVO, Anlage 1](https://www.landesrecht-bw.de/bsbw/?query=DOKNR%3Ajlr-BehGleichStGDVBWpAnlage1&source=PermaLink)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
