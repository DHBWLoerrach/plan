# MVP-Spezifikation — Blockplanung

## Ziel

Die DHBW Lörrach erhält eine Webanwendung, in der berechtigte Mitarbeitende den Verlauf und die prüfungsrelevanten Termine der Kurse ihrer Bereiche strukturiert planen und je Kurs veröffentlichen. Blockpläne entstehen daraus als Darstellung in einem gewählten Zuschnitt innerhalb eines Jahrgangs — ein einzelner Kurs, der ganze Jahrgang oder ein Studiengang beziehungsweise ein Bereich darin. Externe Nutzende lesen ausschließlich veröffentlichte Fassungen.

Die kanonischen Begriffe stehen in [`../CONTEXT.md`](../CONTEXT.md), die verbindlichen Invarianten, Lebenszyklen und Rechte in [`FACHLICHE_REGELN.md`](FACHLICHE_REGELN.md). Dieses Dokument legt Umfang, Oberflächen und Betriebsannahmen fest.

## Rollen und Sichtbarkeit

Abgeleitete Übersicht; normativ ist der Abschnitt [Berechtigungen](FACHLICHE_REGELN.md#berechtigungen).

| Funktion | Bereichsbearbeitung | Systemadministration | Externe Nutzende |
| --- | --- | --- | --- |
| Kurse anlegen, auch als Übernahme aus einer Vorlage | eigene Bereiche | alle Bereiche | – |
| Kursangaben, Kursverlauf und Termine bearbeiten | eigene Bereiche | alle Bereiche | – |
| Kurse ohne veröffentlichte Fassung löschen | eigene Bereiche | alle Bereiche | – |
| Veröffentlichen und zurücknehmen | eigene Bereiche | alle Bereiche | – |
| Kurse und ihre Planungsstände lesen | alle Bereiche | alle Bereiche | – |
| Konten und Rechte verwalten | – | systemweit | – |
| Veröffentlichte Fassungen lesen | ja | ja | ja |

## Öffentliche Auffindbarkeit

Die öffentliche Anwendung bietet Filter nach Bereich, Studiengang, Jahrgang und Kurskennung. Alle Filterzustände und die Ergebnisseite stehen in der URL und sind teilbar sowie per Vor-/Zurück-Navigation reproduzierbar; mehrere gesetzte Filter werden mit UND verknüpft. Gesucht wird über die öffentlich sichtbaren Kurse; jeder gehört genau einem Studiengang und damit genau einem Bereich an. Der Kursfilter sucht ohne Beachtung der Groß-/Kleinschreibung am Anfang der Kurskennung, sodass etwa `tif24` sowohl `TIF24A` als auch `TIF24B` findet.

Bereichs-, Studiengangs- und Jahrgangsoptionen werden ausschließlich aus den Stammdaten-Snapshots vorhandener veröffentlichter Fassungen gebildet. Dadurch bleiben Kurse später umbenannter Bereiche und Studiengänge unter den tatsächlich veröffentlichten Bezeichnungen auffindbar, ohne leere Optionen anzubieten. Ohne Filter erscheinen alle öffentlich sichtbaren Kurse in den Gruppen aktuell laufend, zukünftig und vergangen; jeder Kurs gehört genau einer Gruppe an. Zukünftig ist ein Kurs, wenn sein veröffentlichter Studienzeitraum in der Zukunft beginnt; vergangen, wenn er geendet hat; aktuell in jedem anderen Fall. Stichtag ist überall der aktuelle Kalendertag in der Zeitzone Europe/Berlin, unabhängig von Server- oder Browserzeitzone; er wird serverseitig bestimmt. Aktuelle Kurse werden nach Jahrgang absteigend, zukünftige nach Jahrgang aufsteigend und vergangene nach Jahrgang absteigend sortiert; bei gleichem Jahrgang folgt die Kurskennung aufsteigend. Ergebnisse werden serverseitig mit 25 Kursen pro Seite paginiert. Zurückgenommene und nie veröffentlichte Kurse erscheinen nirgends öffentlich.

Jeder öffentlich sichtbare Kurs ist unter seiner Kurskennung erreichbar. Die Kennung ist über alle veröffentlichten Fassungen hinweg eindeutig und wurde einer inhaltsunabhängigen ID vorgezogen, weil eine öffentliche Adresse lesbar, sprechbar und in einem gedruckten Plan brauchbar sein muss; die Folgen einer nachträglichen Korrektur der Kennung stehen in [ADR 0010](adr/0010-kurs-als-planungs-und-veroeffentlichungseinheit.md). Neben der Kursansicht sind Zuschnitte über mehrere Kurse öffentlich erreichbar. **Jeder Zuschnitt ist an genau einen Jahrgang gebunden** und wahlweise zusätzlich auf einen Studiengang oder einen Bereich eingeschränkt: der ganze Jahrgang, ein Jahrgang eines Studiengangs oder ein Jahrgang eines Bereichs. Die Jahrgangsbindung ist keine Einschränkung der Bequemlichkeit, sondern Voraussetzung der Darstellung — die Planmatrix stellt Semester über eine gemeinsame Zeitachse gegenüber, und dasselbe Semester zweier Jahrgänge liegt Jahre auseinander. Ansichten über mehrere Jahrgänge sind deshalb ausgeschlossen. Ein Zuschnitt zeigt ausschließlich Kurse, die zu diesem Zeitpunkt veröffentlicht sind.

Ein Zuschnitt ist keine eigene Veröffentlichung und adressiert sich über Jahrgang und gegebenenfalls Studiengang oder Bereich statt über eine ID. Maßgeblich sind dabei die **Bezeichnungen aus den Snapshots** der beteiligten Fassungen, nicht die aktuellen Stammdaten — dieselbe Quelle, aus der auch die Filteroptionen gebildet werden. Ein später umbenannter Bereich bleibt dadurch unter der Bezeichnung auffindbar, unter der er veröffentlicht wurde, und erscheint bis zu einer Neuveröffentlichung der betroffenen Kurse neben seiner neuen. Damit eine solche Bezeichnung eindeutig bleibt, reserviert eine [Strukturregel](FACHLICHE_REGELN.md#textnormalisierung-und-eindeutigkeit) sie, solange eine veröffentlichte Fassung sie zeigt; sonst könnten die Kurse zweier verschiedener Bereiche desselben Jahrgangs in denselben Zuschnitt fallen.

Ohne veröffentlichte Fassung — sei der Kurs zurückgenommen, nie veröffentlicht oder die Kennung unbekannt — antwortet die URL öffentlich einheitlich mit HTTP 404 und einem Verweis auf die öffentliche Suche; diese Fälle sind öffentlich ununterscheidbar. Ein Zuschnitt ohne einen einzigen veröffentlichten Kurs antwortet ebenso. Öffentliche Seiten sind für Suchmaschinen indexierbar; interne Pfade und die Anmeldeseite werden per `robots.txt` ausgeschlossen.

Die öffentliche API liefert zu einer bekannten Kurskennung ausschließlich die Semester und Kursphasen dieses einen Kurses aus seiner veröffentlichten Fassung. Sie ist versioniert, schreibgeschützt und nicht authentifiziert; der vollständige Vertrag steht in [`OEFFENTLICHE_API.md`](OEFFENTLICHE_API.md). Sie lässt sich browserseitig auch von anderen Origins lesen. Unbekannte, nicht veröffentlichte und zurückgenommene Kurse antworten einheitlich mit HTTP 404. Eine doppelte veröffentlichte Kurskennung ist durch eine Veröffentlichungsregel und einen eindeutigen Constraint der Datenbank ausgeschlossen, sodass eine Kennung stets höchstens einen Kurs benennt. Die systemweite Eindeutigkeit aktueller Kurskennungen genügt dafür nicht: Eine Kennung darf nach der Veröffentlichung geändert werden, während die Fassung die alte behält, sodass die alte Kennung unter den aktuellen Kursen wieder frei wird.

## Lokale Konten im MVP

Das initiale Systemadministrationskonto wird beim Deployment über einen Befehl im Anwendungscontainer eingerichtet; danach legt allein die Systemadministration Konten in der Administrationsoberfläche an. Ein neues oder freigegebenes Konto wartet auf die Passwortvergabe und kann sich erst anmelden, nachdem über einen Passwortlink ein Passwort gesetzt wurde. Passwortlinks werden genau einmal vollständig angezeigt, kopiert und manuell weitergegeben — einen automatischen E-Mail-Versand gibt es nicht. Nach Verlassen der Bestätigung ist nur eine Neuausstellung möglich.

Aktive Mitarbeitende können ihr Passwort nach Eingabe des bisherigen Passworts selbst ändern. Vergisst eine Person ihr Passwort, setzt die Systemadministration den Zugang zurück und erhält einen neuen Passwortlink. Die verbindlichen Kontozustände und Folgen stehen in den [fachlichen Regeln](FACHLICHE_REGELN.md#interne-konten).

Keycloak/OIDC und Studierenden-Logins sind ein späterer Ausbau. Das MVP implementiert dafür noch keine Integration; der spätere Wechsel darf die fachlichen Konten-, Rollen- und Bereichsbeziehungen nicht verändern.

## Veröffentlichung

Ein neuer Kurs beginnt ohne veröffentlichte Fassung. Die Veröffentlichung prüft Struktur- und Veröffentlichungsregeln dieses einen Kurses und ersetzt seine bisherige öffentliche Fassung atomar durch eine Kopie seines Planungsstands; der Planungsstand bleibt unverändert bearbeitbar. Eine Zurücknahme löscht die öffentliche Fassung. Auch danach veröffentlicht derselbe Weg den aktuellen Planungsstand.

Veröffentlichen und Zurücknehmen sind stets ein Vorgang je Kurs; eine Sammelfreigabe über einen Zuschnitt gibt es nicht. Ein vollständig geplanter Kurs wird unabhängig von allen anderen freigegeben. Dass ein Jahrgang oder ein Bereich vorübergehend nur teilweise öffentlich ist, ist ein beabsichtigter Zustand: Die Zuschnitte zeigen die zu diesem Zeitpunkt veröffentlichten Kurse und wachsen mit jeder weiteren Freigabe.

## Gleichzeitige Bearbeitung

Normale granulare Speicheraktionen verwenden Last-write-wins und verändern nur die konkret bearbeitete Kursangabe, Kursphase oder den konkret bearbeiteten Termin. Es gibt keine Konfliktwarnung, automatische Zusammenführung oder Revisionshistorie. Berechtigungen, Existenz, Strukturregeln und weitere Zustandsvoraussetzungen werden stets gegen den aktuellen Stand geprüft. Zusammengesetzte Änderungen — die gemeinsame Anlage für mehrere Kurse und die Übernahme aus einer Vorlage — bleiben durch kurze Transaktionen und Datenbank-Constraints geschützt (siehe [ADR 0007](adr/0007-last-write-wins-fuer-entwurfsbearbeitung.md)).

Weil Kursphasen und Termine je Kurs getrennt sind, arbeiten mehrere Personen an verschiedenen Kursen desselben Zuschnitts überschneidungsfrei, auch wenn sie dieselbe Gegenüberstellung geöffnet haben. Die Zusammenfassung übereinstimmender Angaben in einer Zeile begründet dabei keine gemeinsame Identität: Wird eine solche Zeile bearbeitet, benennt der Vorgang, dass er die Angaben mehrerer Kurse einzeln ändert.

Veröffentlichen vergleicht die zuletzt gesehene Änderung des Kurses und seinen Veröffentlichungszustand. Bei einer Abweichung lädt die Anwendung die aktuelle Vorschau, statt ungesehene Änderungen zu veröffentlichen. Zurücknehmen adressiert immer die konkret angezeigte veröffentlichte Fassung; wurde sie inzwischen ersetzt oder entfernt, bleibt der aktuelle Zustand unverändert und wird neu geladen.

## Referenzintegrität

Wird ein Kurs gelöscht, entfallen sein Kursverlauf und seine prüfungsrelevanten Termine mit ihm. Ein Kurs mit veröffentlichter Fassung wird nicht gelöscht; er ist zuerst zurückzunehmen, damit eine Veröffentlichung nicht durch eine Stammdatenlöschung verschwindet.

Bereiche und Studiengänge werden initial per Seed bereitgestellt und im MVP nicht über die Anwendung verwaltet, stillgelegt oder entfernt. Ergänzungen und Umbenennungen erfolgen als versionierte Datenmigration. Bereich und Anzahl Semester eines Studiengangs mit bestehenden Kursen zu ändern, erfordert eine gesonderte, außerhalb der Anwendung dokumentierte Datenmigration.

## Oberflächen

Die öffentliche Ansicht eines Zuschnitts beginnt mit dessen Benennung — der Kurskennung beziehungsweise dem Jahrgang samt einschränkendem Studiengang oder Bereich — sowie dem Bereich der gezeigten Kurse. Sie zeigt ausschließlich Kurse mit veröffentlichter Fassung. Der Studienverlauf folgt als ein Abschnitt aus zwei gleichrangigen Blöcken: dem Überblick über den gesamten Verlauf und der Planmatrix, jeder mit eigener Überschrift und eigener Erläuterung. Die Planmatrix ist eine vergleichende Datentabelle über alle Semester: Jedes Semester bildet eine eigene Zeilengruppe, deren erste Spalte das Semester über die Zeilen der Gruppe hinweg benennt. Es folgen der Zeitraum und dessen Dauer, dann die Spalten der Kurse. Die zunächst gebildeten Zeilengrenzen entstehen aus der Vereinigungsmenge aller Starttage und der jeweils auf ein inklusives Enddatum folgenden Kalendertage. Jede Kurszelle nennt „Theorie“ oder „Praxis“ textlich; liegt der Zeitraum für diesen Kurs außerhalb des in der Tabelle dargestellten Semesters, nennt sie stattdessen „Nicht in diesem Semester“. Unmittelbar benachbarte Intervalle werden für die Darstellung zusammengefasst, wenn sämtliche Kurszellen denselben Inhalt behalten. Die gespeicherten Kursphasen bleiben davon unberührt. Jede sichtbare Zeile bildet damit den maximalen inklusiven Zeitraum, in dem sich für keinen Kurs die Darstellung ändert; abweichende Semestergrenzen verschiedener Kurse bleiben sichtbar.

Zeigt ein Zuschnitt mehrere Kurse, ist die Matrix eine Gegenüberstellung: Kurse, deren Kursphasen in Semester, Phasentyp und Zeitraum sämtlich übereinstimmen, teilen sich eine Spalte, deren Kopf alle beteiligten Kurskennungen nennt; jede Abweichung trennt sie wieder in eigene Spalten. Die Zusammenfassung ist eine reine Anzeigeregel und begründet keine gemeinsame Identität der Kursphasen — sie zeigt Übereinstimmung, statt sie zu verlangen. Die programmatische Zuordnung darf darunter nicht leiden: Jede Zelle einer geteilten Spalte bleibt jedem der beteiligten Kurse einzeln zugeordnet, und die Kursauswahl schaltet weiterhin einzelne Kurse.

Über der Planmatrix steht der Überblick des gesamten Verlaufs: eine Balkengrafik aller Kurse des Zuschnitts auf einer gemeinsamen Zeitachse, gegliedert durch ein Jahresband über einem Semesterband. Kurse, deren Kursphasen in Semester, Phasentyp und Zeitraum sämtlich übereinstimmen, teilen sich eine Spur und werden einmal gezeichnet; jede Abweichung trennt sie wieder — dieselbe Zusammenfassung wie in der Matrix. Jede Phase nennt ihre Dauer — im Balken, solange er breit genug ist, sonst darunter an einer Linie zu ihrem Balken, damit auch kurze Phasen benannt bleiben. Breit genug heißt gemessen breit genug: Die Beschriftung behält ihre Größe, während die Achse mit dem Fenster wächst und schrumpft und mit der eingestellten Textgröße umgekehrt, sodass ein fester Anteil der Achse nur bei einer einzigen Fensterbreite stimmen würde. Das Semesterband steht einmal über allen Spuren, solange deren Semestergrenzen übereinstimmen, und sonst je Spur, weil dieselben Semester zwischen den Kursen abweichen dürfen. Der Überblick ist eine Ergänzung der Matrix und kein Ersatz: Er nennt Längen, aber keine Datumsangaben. Er zeigt stets den vollständigen Zuschnitt und bleibt von der Kursauswahl der Matrix unberührt; ein Hinweis an der Grafik benennt das, damit ein in der Matrix ausgeblendeter Kurs im Überblick nicht unerklärt weiterläuft.

Prüfungsrelevante Termine stehen nach der Planmatrix in einer eigenen chronologischen Tabelle mit Zeitangabe, Kategorie, Titel, Vorläufigkeitsstatus, betroffenen Kursen und dem je Kurs abgeleiteten Semester. Sie werden nicht künstlich genau einem Semesterabschnitt zugeordnet. Auch hier fasst die Gegenüberstellung zusammen: Termine mehrerer Kurse bilden eine Zeile, wenn Kategorie, normalisierter Titel und Zeitangabe einschließlich des Merkmals „vorläufig“ übereinstimmen; die Zeile nennt dann alle beteiligten Kurse. Weicht eine dieser Angaben ab, stehen die Termine getrennt — auch bei gleichem Tag, denn zwei verschiedene Termine dürfen auf denselben Tag fallen. Weicht ausschließlich die Beschreibung ab, bleibt die Zeile bestehen und führt die Beschreibung je Kurs. Der Zusammenfassungsschlüssel ist eine Anzeigeregel und keine Invariante; er lässt sich ändern, ohne Daten zu berühren. Auf schmalen Ansichten bleibt die Matrix horizontal scrollbar. Die Kursauswahl steht im Kopf der Tabellenkarte, außerhalb des scrollbaren Bereichs: Ein ausgeblendeter Kurs bliebe sonst unerreichbar, sobald seine Spalte fortgescrollt ist. Die Legende der Phasentypen steht darüber im Kopf des Abschnitts, weil Überblick und Matrix denselben Phasentyp gleich zeichnen und der Überblick zuerst gelesen wird; sie bleibt auch dort stehen, wo die Grafik der schmalen Ansicht wegen entfällt. Sie leitet sich aus dem vollständigen Zuschnitt ab und nicht aus den sichtbaren Spalten, da sie beide Darstellungen benennt. Die Legende erklärt und ist nicht bedienbar, die Kursauswahl ist bedienbar und als solche erkennbar; beide sind darin unverwechselbar. Die Auswahl kann die sichtbaren Kursspalten reduzieren, ohne Inhalte oder die vollständige Auswahlmöglichkeit zu verlieren. Bleibt nur noch ein Kurs sichtbar, ist dessen Auswahl gesperrt statt abwählbar: Sie ist als solche gekennzeichnet, bleibt fokussierbar und nennt den Grund.

Die interne Bearbeitung ist ein geführter, semesterweiser Editor über einem gewählten Zuschnitt, mit Vorschau. Der Zuschnitt bestimmt allein, welche Kurse nebeneinander bearbeitet werden; er ist keine gespeicherte Einheit und lässt sich jederzeit ändern, ohne Daten zu berühren. Es gibt kein Autosave; jede Anlage, Änderung oder Löschung wird ausdrücklich als einzelne, granulare Operation gespeichert. Die Navigation zeigt alle sechs beziehungsweise sieben Semester mit ihrem Fehler- und Vollständigkeitsstatus, und zwar je Kurs, weil jeder Kurs für sich veröffentlichbar wird.

Innerhalb eines Semesters listet eine Tabelle die Kursphasen mit Kurs, Zeitraum und Phasentyp; sie fasst übereinstimmende Kursphasen nach derselben Regel zusammen wie die öffentliche Matrix. Eine neue Kursphase kann für einen oder mehrere ausgewählte Kurse des Zuschnitts angelegt werden. Bei mehreren Kursen entstehen eigenständige Kursphasen mit zunächst gleichen Angaben; spätere Änderungen wirken nur auf die jeweils bearbeitete Kursphase. Wird eine zusammengefasste Zeile bearbeitet oder gelöscht, benennt der Vorgang vorher, welche Kurse er einzeln ändert. Das Löschen einer Kursphase verändert ausschließlich den Planungsstand, nicht aber Daten der veröffentlichten Fassung.

Prüfungsrelevante Termine werden in einem eigenen Editorabschnitt verwaltet und ebenso gemeinsam angelegt und zusammengefasst dargestellt. Vorschau und Veröffentlichungsprüfung verwenden ausschließlich den zuletzt gespeicherten Planungsstand. Die Vorschau zeigt die Planmatrix eines Kurses nur, wenn dieser veröffentlichbar ist; verletzt sein Planungsstand Veröffentlichungsregeln, zeigt sie stattdessen die strukturierte Fehlerübersicht mit Verweisen auf die betroffenen Semester und Felder. Ein unvollständiger Kurs hindert die anderen Kurse des Zuschnitts weder an der Vorschau noch an der Freigabe. Die Arbeitsansicht während der Bearbeitung bleibt der semesterweise Editor. Hat sich der angezeigte Stand eines Kurses vor dem Veröffentlichen geändert, lädt der Editor den aktuellen Stand und verlangt eine neue Freigabe.

Ein Kurs, dessen Planungsstand von seiner veröffentlichten Fassung abweicht oder der noch keine besitzt, ist überall sichtbar als „in Arbeit“ gekennzeichnet — auch in Kursen fremder Bereiche, die nur lesend sichtbar sind.

Öffentliche und interne Oberfläche lesen dieselben strukturierten Daten, sind aber bewusst unterschiedlich gestaltet.

## Interne Informationsarchitektur

Nach der Anmeldung zeigt die Startseite die zugeordneten Bereiche, zuletzt bearbeitete Kurse und Hinweise auf unvollständige Planungsstände. Die Hauptnavigation der Bereichsbearbeitung umfasst **Kurse**; für die Systemadministration kommt **Konten** hinzu. Jede aktive Person erreicht außerdem ihre eigene Kontoseite zur Passwortänderung. Nicht erlaubte Einträge werden ausgeblendet, ohne die erneute Berechtigungsprüfung auf jeder Zielseite und in jeder Serveroperation zu ersetzen.

Alle internen Listen verwenden URL-basierte Filter und reproduzierbare Sortierung, aber im MVP keine Paginierung. Die Kursliste filtert nach Bereich, Studiengang, Jahrgang, Kurskennung und Veröffentlichungszustand und unterscheidet sichtbar zwischen Kursen der eigenen und fremder Bereiche, weil nur erstere bearbeitbar sind. Aus ihr heraus wird ein Zuschnitt gebildet, in dem mehrere Kurse gemeinsam bearbeitet werden; er ist wie öffentlich an genau einen Jahrgang gebunden, weil der semesterweise Editor dieselbe gemeinsame Zeitachse voraussetzt.

Ein Kurs wird leer oder als Übernahme aus einer Vorlage angelegt. Bei der Übernahme werden die Vorlage, die zu übernehmenden Teile — Kursverlauf, Termine oder beides — und die Angaben des neuen Kurses erfasst; die Oberfläche nennt die errechnete Verschiebung in Wochen sowie die Kursphasen, die dabei auf den Studienzeitraum gekürzt werden, vor dem Speichern. Anlage und Übernahme bilden dieselbe Transaktion.

Die Kontoliste unterscheidet und filtert die Zustände „Passwortvergabe ausstehend“, „Aktiv“ und „Gesperrt“. Eine Kontolöschung gibt es im MVP nicht; das Sperren ist die weitestgehende Kontoaktion.

Für alle destruktiven oder weitreichenden Aktionen gilt eine Bestätigungspflicht: Kurslöschungen, Änderungen und Löschungen über eine zusammengefasste Zeile mehrerer Kurse, Kontosperrungen, Zurücknahmen von Veröffentlichungen, Rechteänderungen und die Ausstellung neuer Passwortlinks verlangen eine Bestätigung, die konkrete Folgen und betroffene Objekte nennt.

## Dimensionierungs- und Leistungsannahmen

Als unverbindliche Planungsannahmen gelten höchstens 200 aktive interne Konten, bis zu 20 gleichzeitig aktive interne Sitzungen, höchstens fünf gleichzeitige Schreibvorgänge und ungefähr 100 gleichzeitig lesende öffentliche Nutzende. Diese Werte begründen die anfängliche Architektur, sind aber weder Abnahmegrenzen noch eine Verpflichtung zu Lasttests. Ein gesondertes Verfügbarkeits- oder Antwortzeit-SLA über den bestehenden DHBW-Betrieb hinaus besteht nicht.

Feldgrenzen sind als Strukturregeln in [`FACHLICHE_REGELN.md`](FACHLICHE_REGELN.md) festgelegt. Eine Höchstzahl gemeinsam bearbeiteter Kurse gibt es nicht mehr, da der Zuschnitt nichts speichert; die Oberfläche begrenzt allein, was noch lesbar darstellbar ist.

## Nicht Teil des MVP

- PDF-Ausgabe eines Zuschnitts; die responsive Webansicht ist maßgeblich. Der Zuschnitt macht sie später wohlfeil, ist aber kein MVP-Umfang.
- Import oder Migration aus PDFs, Bildern, Excel oder anderen Systemen; die Ersterfassung erfolgt manuell und strukturiert. Die Übernahme aus einer bestehenden Vorlage ist davon nicht berührt und Teil des MVP.
- DHBW-Keycloak/OIDC-SSO und Studierenden-Logins.
- Curriculum- bzw. Studienverlaufsverwaltung sowie Vorlesungs-, Dozierenden- und Raumplanung.
- Gemeinsames Bearbeiten oder Synchronisieren von Kursen. Die Übernahme aus einer Vorlage kopiert einmalig und stiftet keine Verbindung; eine dauerhafte Kopplung zweier Kurse gibt es nicht.
- Eine Sammelfreigabe über mehrere Kurse. Veröffentlichen und Zurücknehmen bleiben ein Vorgang je Kurs.
- Automatische Abweichungswarnungen zwischen Kursen. Die Gegenüberstellung zeigt Unterschiede, bewertet sie aber nicht.
- Studienverläufe mit einer anderen Dauer als 6 oder 7 Semestern.
- Gesamtansichten über mehrere Jahrgänge, etwa ein bereichsweiter Gantt über alle laufenden Jahrgänge. Zuschnitte innerhalb **eines** Jahrgangs — der ganze Jahrgang, ein Studiengang darin oder ein Bereich darin — sind dagegen Kernfunktion.
- Eine persönliche kursbezogene Blockband-Ansicht.
- Eine fachliche oder administrative Auditspur. Außer Zeitpunkt und internem Konto der letzten Änderung eines Kurses speichert die Anwendung keine Änderungshistorie; eine spätere Protokollierung beginnt ohne rückwirkende Rekonstruktion ab ihrem Einführungsstichtag (siehe [ADR 0005](adr/0005-keine-auditspur-im-mvp.md)).
