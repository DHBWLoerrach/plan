# Barrierefreiheit und responsive Nutzung

Die öffentliche Planmatrix und der interne Editor werden als barrierefreiheitsrelevante Oberflächen behandelt. Ziel ist mindestens WCAG 2.1 AA entsprechend EN 301 549; für neue Oberflächen ist WCAG 2.2 AA die zusätzliche Zielmarke.

Vor Go-live wird mit der zuständigen DHBW-Stelle geklärt, ob die Erklärung zur Barrierefreiheit und der Rückmeldeweg zentral oder innerhalb der Anwendung bereitgestellt werden. Geltungsbereich, Verantwortlichkeit, Rückmeldekanal und Aktualisierungsprozess sind verbindlich festzulegen.

## Öffentliche Planmatrix

- Die Matrix ist eine echte Datentabelle mit `caption`, Kopfzellen und programmatisch bestimmbaren Zeilen- und Spaltenbezügen.
- Theorie, Praxis und Veröffentlichungszustände sind immer auch textlich benannt; Farbe, Symbol oder Position sind nur Ergänzungen.
- Die Inhalte bleiben bei 320 CSS-Pixeln Breite, 200 % Textvergrößerung und 400 % Browser-Zoom vollständig verfügbar. Notwendiges horizontales Scrollen ist erkennbar, per Tastatur erreichbar und frei von Fokusfallen.
- Alle Funktionen sind per Tastatur erreichbar; Fokus ist sichtbar, sinnvoll angeordnet und alle Bedienelemente sind eindeutig benannt.
- Dynamische Status- und Filteränderungen werden verständlich angekündigt.

## Interner Editor

- Jede Eingabe besitzt ein sichtbares und programmatisch verknüpftes Label. Pflichtangaben und zulässige Formate sind vor der Eingabe erklärt.
- Validierungsfehler erscheinen am Feld und zusätzlich in einer Fehlerübersicht; bekannte Korrekturmöglichkeiten werden genannt.
- Gespeicherte Entwürfe, aktualisierte Vorschauen sowie erfolgreiche oder fehlgeschlagene Veröffentlichungen werden als zugängliche Statusmeldungen ausgegeben.
- Jede Bearbeitungsfunktion funktioniert ohne Maus. Falls Phasen visuell sortiert werden, existieren gleichwertige Verschiebe-Schaltflächen; Drag-and-drop ist nie erforderlich.
- Dialoge, Menüs und Bestätigungen besitzen korrekte Fokusführung, Escape-Verhalten und Fokus-Rückkehr. Die Vorschau erfüllt dieselben semantischen Regeln wie die öffentliche Matrix.

## Nachweis vor Abnahme

- Automatisierte Scans ergänzen manuelle Prüfungen aller wesentlichen Abläufe: Plan suchen und lesen, Kurs wechseln, Phasen und Termine bearbeiten, speichern, veröffentlichen und zurücknehmen.
- Tastaturtest mit Tab, Shift+Tab, Enter, Leertaste und Escape: sichtbarer Fokus, sinnvolle Reihenfolge, keine Fokusfalle.
- Screenreader-Test mindestens mit VoiceOver/Safari sowie einem zweiten unterstützten Browser-Screenreader-Gespann, insbesondere für Matrix, Fehler, Dialoge und Statusmeldungen.
- Visueller Test von Text- und Nichttextkontrast, 200 % Textvergrößerung, 400 % Zoom und schmaler mobiler Breite. Fehler, Veröffentlichung und Phasentypen sind nie nur farblich unterscheidbar.

## Quellen

- [§ 10 L-BGG](https://www.landesrecht-bw.de/bsbw/?docId=jlr-NNLBW00007D3ENN00000000017&query=JURISLINK%3A%22BehGleichStG+BW+%C2%A7+10%22)
- [DHBW-Impressum](https://www.dhbw.de/impressum/)
- [L-BGG-DVO, Anlage 1](https://www.landesrecht-bw.de/bsbw/?query=DOKNR%3Ajlr-BehGleichStGDVBWpAnlage1&source=PermaLink)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
