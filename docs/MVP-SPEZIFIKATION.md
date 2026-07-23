# MVP-Spezifikation — Blockplanverwaltung

## Ziel

Die DHBW Lörrach erhält eine Webanwendung, in der berechtigte Mitarbeitende strukturierte Blockpläne für die Kurse ihrer Bereiche erstellen, bearbeiten und veröffentlichen. Externe Nutzende lesen ausschließlich veröffentlichte Pläne.

Die kanonischen Begriffe stehen in [`../CONTEXT.md`](../CONTEXT.md), die verbindlichen Invarianten, Lebenszyklen und Rechte in [`FACHLICHE_REGELN.md`](FACHLICHE_REGELN.md). Dieses Dokument legt Umfang, Oberflächen und Betriebsannahmen fest.

## Rollen und Sichtbarkeit

Abgeleitete Übersicht; normativ ist der Abschnitt [Berechtigungen](FACHLICHE_REGELN.md#berechtigungen).

| Funktion | Studiengangsmanagement | Studiengangsleitung | Systemadministration | Externe Nutzende |
| --- | --- | --- | --- | --- |
| Kurse anlegen und bearbeiten | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Noch nicht veröffentlichte Kurse löschen | – | eigene Bereiche | alle Bereiche | – |
| Noch nicht veröffentlichte Kurse zuordnen oder lösen | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Blockplanentwürfe anlegen und bearbeiten | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Noch nie veröffentlichte Blockpläne löschen | – | eigene Bereiche | alle Bereiche | – |
| Veröffentlichen und zurücknehmen | – | eigene Bereiche | alle Bereiche | – |
| Auditspur zu Blockplänen und Kursen einsehen | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Auditspur zu internen Konten einsehen | – | – | systemweit | – |
| Bereiche, Studiengänge, Konten und Rechte verwalten | – | – | systemweit | – |
| Veröffentlichte Blockpläne lesen | ja | ja | ja | ja |

## Öffentliche Auffindbarkeit

Die öffentliche Anwendung bietet Filter nach Bereich, Studiengang, Jahrgang und Kurskennung. Alle Filterzustände und die Ergebnisseite stehen in der URL und sind teilbar sowie per Vor-/Zurück-Navigation reproduzierbar; mehrere gesetzte Filter werden mit UND verknüpft. Ein Blockplan erfüllt den Studiengangsfilter, wenn mindestens ein öffentlich sichtbarer Kurs seiner veröffentlichten Fassung diesem Studiengang angehört. Der Kursfilter sucht ohne Beachtung der Groß-/Kleinschreibung am Anfang der Kurskennung, sodass etwa `tif24` sowohl `TIF24A` als auch `TIF24B` findet.

Bereichs-, Studiengangs- und Jahrgangsoptionen werden ausschließlich aus den Stammdaten-Snapshots vorhandener veröffentlichter Fassungen gebildet. Dadurch bleiben Pläne deaktivierter oder später umbenannter Bereiche und Studiengänge unter den tatsächlich veröffentlichten Bezeichnungen auffindbar, ohne leere Optionen anzubieten. Ohne Filter erscheinen alle veröffentlichten Pläne in den Gruppen aktuell laufend, zukünftig und vergangen. Aktuell bedeutet, dass der heutige Kalendertag im Studienzeitraum mindestens eines öffentlich sichtbaren Kurses liegt. Aktuelle Pläne werden nach Jahrgang absteigend, zukünftige nach Jahrgang aufsteigend und vergangene nach Jahrgang absteigend sortiert; bei gleichem Jahrgang folgt der veröffentlichte Anzeigename aufsteigend. Ergebnisse werden serverseitig mit 25 Plänen pro Seite paginiert. Zurückgenommene Fassungen erscheinen nirgends öffentlich.

Jeder veröffentlichte Blockplan ist über eine stabile, von seinem angezeigten Namen unabhängige URL erreichbar — der Name ändert sich bei einer neuen Veröffentlichung, wenn eine Bezeichnung vergeben wurde oder sich die öffentlich sichtbare Kursmenge geändert hat. Veröffentlichte Pläne bleiben für vergangene, aktuelle und zukünftige Jahrgänge auffindbar.

## Lokale Konten im MVP

Das initiale Systemadministrationskonto wird beim Deployment über einen Befehl im Anwendungscontainer eingerichtet; danach legt allein die Systemadministration Konten in der Administrationsoberfläche an. Ein neues oder freigegebenes Konto wartet auf die Passwortvergabe und kann sich erst anmelden, nachdem über einen Passwortlink ein Passwort gesetzt wurde. Passwortlinks werden genau einmal vollständig angezeigt, kopiert und manuell weitergegeben — einen automatischen E-Mail-Versand gibt es nicht. Nach Verlassen der Bestätigung ist nur eine Neuausstellung möglich.

Vergisst eine Person ihr Passwort, setzt die Systemadministration den Zugang zurück und erhält einen neuen Passwortlink. Das bisherige Passwort und alle Sitzungen werden dabei sofort ungültig. Mitarbeitende können ihr Passwort nicht selbst ändern oder zurücksetzen.

Keycloak/OIDC und Studierenden-Logins sind ein späterer Ausbau. Das MVP implementiert dafür noch keine Integration; der spätere Wechsel darf die fachlichen Konten-, Rollen- und Bereichsbeziehungen nicht verändern.

## Veröffentlichung

Ein neuer Blockplan beginnt als Entwurf. Die Veröffentlichung prüft Struktur- und Veröffentlichungsregeln und ersetzt die bisherige öffentliche Fassung atomar durch eine Kopie des Entwurfs; der Entwurf bleibt unverändert bearbeitbar. Auch nach einer Zurücknahme gibt es nur diesen einen Veröffentlichungsweg — die zurückgenommene Fassung wird nicht wiederhergestellt.

## Gleichzeitige Bearbeitung

Das MVP verwendet für Blockpläne und Kurse keinen allgemeinen Versionszähler. Jede Speicheraktion im Blockplaneditor verändert nur die konkret bearbeitete Planangabe und übermittelt, welchen Änderungszeitpunkt des Entwurfs die Person zuletzt gesehen hat. Wurde der bearbeitbare Planungsstand inzwischen geändert, schreibt der erste Speicherversuch nichts. Stattdessen zeigt der Editor eine fokussierte Änderungswarnung mit Zeitpunkt und dienstlicher E-Mail-Adresse des zuletzt ändernden internen Kontos; das gilt auch für eigene Änderungen aus einem anderen Browserfenster oder Gerät.

Die nicht gespeicherte Eingabe bleibt erhalten. „Trotzdem speichern“ bestätigt ausschließlich die einzelne beabsichtigte Operation für genau den in der Warnung genannten Stand. Hat sich der Entwurf nochmals geändert, erscheint eine neue Warnung. Die Bestätigung überstimmt niemals Berechtigungen, Existenzprüfungen, Strukturregeln oder andere Zustandsvoraussetzungen; ein zwischenzeitlich gelöschtes Objekt wird insbesondere nicht wiederhergestellt. Es gibt keine Hintergrundprüfung, automatische Zusammenführung, Gegenüberstellung vollständiger Stände oder Revisionshistorie (siehe [ADR 0004](adr/0004-aenderungswarnung-statt-versionszaehler.md)).

Seltene gleichzeitige Änderungen derselben Kursangabe verwenden bewusst Last-write-wins. Beim Zuordnen und Lösen eines Kurses prüfen kurze Transaktionen dagegen stets den aktuellen Datenbankstand und alle Zuordnungsregeln; Datenbank-Constraints schließen widersprüchliche Zuordnungen zusätzlich aus. Interne Konten, Bereiche und Studiengänge prüfen ihre Strukturregeln, Zustandsvoraussetzungen und Eindeutigkeiten ebenfalls innerhalb jeder Transaktion gegen den aktuellen Datenbankstand; Kontoänderungen werden zusätzlich vollständig auditiert.

Veröffentlichen vergleicht sowohl den zuletzt gesehenen Änderungszeitpunkt des Entwurfs als auch die zuletzt gesehene veröffentlichte oder zurückgenommene Fassung. Hat sich einer dieser Stände geändert, lässt sich die Prüfung nicht überstimmen: Die Anwendung lädt die aktuelle Vorschau und den aktuellen Veröffentlichungszustand, von denen aus die Person erneut veröffentlichen kann. Zurücknehmen adressiert immer die konkret angezeigte veröffentlichte Fassung; wurde sie inzwischen ersetzt oder bereits zurückgenommen, bleibt der aktuelle Zustand unverändert und wird neu geladen.

## Referenzintegrität

Wird ein noch nie veröffentlichter Blockplan gelöscht, entfallen seine Blockphasen, Kursphasen und prüfungsrelevanten Termine mit ihm.

Bereiche und Studiengänge, auf die Kurse oder Blockpläne verweisen, werden deaktiviert statt gelöscht. Bereich und Anzahl Semester eines Studiengangs mit bestehenden Kursen zu ändern, erfordert eine gesonderte, auditierte Datenmigration.

## Oberflächen

Die öffentliche Detailansicht beginnt mit veröffentlichtem Anzeigenamen, Bereich, Jahrgang und den sichtbaren Kurskennungen. Für jedes Semester zeigt sie eine eigene vergleichende Datentabelle: Die erste Spalte enthält den Zeitraum, jede weitere Spalte genau einen veröffentlichten Kurs. Die Zeilengrenzen entstehen aus der Vereinigungsmenge aller Starttage und der jeweils auf ein inklusives Enddatum folgenden Kalendertage. Jede Zeile bildet damit den maximalen inklusiven Zeitraum, in dem sich für keinen Kurs der Phasentyp ändert; jede Kurszelle nennt „Theorie“ oder „Praxis“ textlich. Eine fachlich gemeinsame Blockphase bleibt ein Objekt, wird für die verständliche Gegenüberstellung aber in jeder betroffenen Kurszelle ausgegeben.

Prüfungsrelevante Termine stehen nach den Semestertabellen in einer eigenen chronologischen Tabelle mit Zeitangabe, Kategorie, Titel, Vorläufigkeitsstatus, betroffenen Kursen und dem je Kurs abgeleiteten Semester. Sie werden nicht künstlich genau einem Semesterabschnitt zugeordnet. Auf schmalen Ansichten bleibt die Matrix horizontal scrollbar; eine Kursauswahl kann die sichtbaren Kursspalten reduzieren, ohne Inhalte oder die vollständige Auswahlmöglichkeit zu verlieren.

Die interne Bearbeitung ist ein geführter, semesterweiser Editor mit Entwurfsstatus und Vorschau. Es gibt kein Autosave; jede Anlage, Änderung oder Löschung wird ausdrücklich als einzelne, granulare Operation gespeichert. Die Navigation zeigt alle sechs beziehungsweise sieben Semester mit ihrem Fehler- und Vollständigkeitsstatus.

Innerhalb eines Semesters listet eine Tabelle die Blockphasen mit Zeitraum, Phasentyp und zugeordneten Kursen. Eine neue Blockphase wird einmal angelegt und dabei mindestens einem Kurs zugeordnet. Die Bearbeitung einer gemeinsamen Blockphase ändert sie nach einem deutlichen Hinweis für alle zugeordneten Kurse. Die gesonderte Aktion „Für ausgewählte Kurse trennen“ kopiert die Blockphase und verschiebt die gewählten Kursphasen auf die Kopie; dadurch können deren Zeitraum, Semester oder Phasentyp anschließend unabhängig geändert werden. Das Löschen einer Blockphase entfernt im Entwurf ihre Kursphasen, nicht aber Daten der veröffentlichten Fassung.

Prüfungsrelevante Termine werden in einem eigenen Editorabschnitt verwaltet. Vorschau und Veröffentlichungsprüfung verwenden ausschließlich den zuletzt gespeicherten Entwurf. Eine Änderungswarnung erscheint als fokussierter Hinweis im Editor und bietet die eindeutig beschrifteten Aktionen „Abbrechen“ und „Trotzdem speichern“; die zweite Aktion fehlt bei Veröffentlichen und bei nicht mehr zulässigen Operationen.

Öffentliche und interne Oberfläche lesen dieselben strukturierten Daten, sind aber bewusst unterschiedlich gestaltet.

## Interne Informationsarchitektur

Nach der Anmeldung zeigt die Startseite die zugeordneten Bereiche, zuletzt bearbeitete Blockpläne und Hinweise auf unvollständige Entwürfe. Die Hauptnavigation fachlicher Rollen umfasst **Blockpläne**, **Kurse** und **Auditspur**; für die Systemadministration kommen **Bereiche**, **Studiengänge** und **Konten** hinzu. Nicht erlaubte Einträge werden ausgeblendet, ohne die erneute Berechtigungsprüfung auf jeder Zielseite und in jeder Serveroperation zu ersetzen.

Alle internen Listen verwenden URL-basierte Filter, reproduzierbare Sortierung und serverseitig 25 Einträge pro Seite. Die Blockplanliste filtert nach Bereich, Jahrgang, Kurskennung und Veröffentlichungszustand; die Kursliste nach Bereich, Studiengang, Jahrgang und Zuordnungszustand. Ein Blockplan kann aus der Blockplanliste oder unmittelbar aus einem geeigneten blockplanlosen Kurs angelegt werden, wobei Blockplananlage und erste Kurszuordnung dieselbe Transaktion bilden.

Die Auditliste filtert nach Zeitraum, Bereich, Entität und Ereignisart innerhalb des erlaubten Sichtbarkeitsumfangs. Die Kontoliste unterscheidet und filtert die Zustände „Passwortvergabe ausstehend“, „Aktiv“ und „Gesperrt“. Löschungen, Deaktivierungen, Kontosperrungen, Zurücknahmen, Rechteänderungen und die Ausstellung neuer Passwortlinks verlangen eine Bestätigung, die konkrete Folgen und betroffene Objekte nennt.

## Dimensionierungs- und Leistungsannahmen

Das MVP ist für höchstens 200 aktive interne Konten, bis zu 20 gleichzeitig aktive interne Sitzungen und höchstens fünf gleichzeitige Schreibvorgänge ausgelegt. Die öffentliche Ansicht wird mit 100 gleichzeitig lesenden Nutzenden getestet. Unter diesem Testprofil sollen 95 % der öffentlichen Listen- und Detailaufrufe innerhalb von zwei Sekunden und 95 % der Speicher- und Veröffentlichungsvorgänge innerhalb von drei Sekunden beantwortet werden. Ein gesondertes Verfügbarkeits-SLA über den bestehenden DHBW-Betrieb hinaus besteht nicht.

Feld- und Mengengrenzen sind als Strukturregeln in [`FACHLICHE_REGELN.md`](FACHLICHE_REGELN.md) festgelegt und bilden die Obergrenzen der Lasttestdaten.

## Nicht Teil des MVP

- PDF-Export einzelner Blockpläne; die responsive Webansicht ist maßgeblich.
- Import oder Migration aus PDFs, Bildern, Excel oder anderen Systemen; die Ersterfassung erfolgt manuell und strukturiert.
- DHBW-Keycloak/OIDC-SSO und Studierenden-Logins.
- Curriculum- bzw. Studienverlaufsverwaltung sowie Vorlesungs-, Dozierenden- und Raumplanung.
- Bereichsübergreifendes Kopieren, gemeinsames Bearbeiten oder Synchronisieren von Blockplänen. Synchronisierte Bereiche führen im MVP eigene Pläne.
- Studienverläufe mit einer anderen Dauer als 6 oder 7 Semestern.
- Blockplanübergreifende Gesamtansichten, etwa ein bereichsweiter Gantt über mehrere Jahrgänge — öffentlich über die veröffentlichten Fassungen, intern zusätzlich über die Entwürfe. Ein späterer Ausbau; das Datenmodell trägt ihn bereits, und die Zeitachse einer solchen Ansicht erlaubt anders als die semesterspaltige Planmatrix auch Kurse mit unterschiedlicher Semesterzahl nebeneinander. Innerhalb eines Blockplans ist die studiengangsübergreifende Darstellung dagegen Kernfunktion und nicht ausgeschlossen.
- Eine persönliche kursbezogene Blockband-Ansicht; sie bleibt eine mögliche spätere Studierendenansicht.
