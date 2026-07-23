# MVP-Spezifikation — Blockplanverwaltung

## Ziel

Die DHBW Lörrach erhält eine Webanwendung, in der berechtigte Mitarbeitende strukturierte Blockpläne für die Kurse ihrer Bereiche erstellen, bearbeiten und veröffentlichen. Externe Nutzende lesen ausschließlich veröffentlichte Pläne.

Begriffe, Entitäten, Datenregeln und Rechte sind verbindlich in [`../CONTEXT.md`](../CONTEXT.md) definiert. Dieses Dokument legt Umfang, Oberflächen und Betriebsannahmen fest und wiederholt die dortigen Regeln nicht.

## Rollen und Sichtbarkeit

Abgeleitete Übersicht; normativ sind die Rollenabschnitte in `CONTEXT.md`.

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

Die öffentliche Anwendung bietet Filter nach Bereich, Studiengang, Jahrgang und Kurskennung. Jeder veröffentlichte Blockplan ist über eine stabile, von seiner veränderbaren Bezeichnung unabhängige URL erreichbar. Veröffentlichte Pläne bleiben für vergangene, aktuelle und zukünftige Jahrgänge auffindbar.

## Lokale Konten im MVP

Das initiale Systemadministrationskonto wird beim Deployment eingerichtet; danach legt allein die Systemadministration Konten in der Administrationsoberfläche an. Dort werden auch Aktivierungs- und Reset-Links erzeugt, kopiert und manuell weitergegeben — einen automatischen E-Mail-Versand gibt es nicht.

Keycloak/OIDC und Studierenden-Logins sind ein späterer Ausbau; sie dürfen die fachlichen Konten-, Rollen- und Bereichsbeziehungen nicht verändern.

## Veröffentlichung

Ein neuer Blockplan beginnt als Entwurf. Die Veröffentlichung prüft Struktur- und Veröffentlichungsregeln und ersetzt die bisherige öffentliche Fassung atomar durch eine Kopie des Entwurfs; der Entwurf bleibt unverändert bearbeitbar. Auch nach einer Zurücknahme gibt es nur diesen einen Veröffentlichungsweg — die zurückgenommene Fassung wird nicht wiederhergestellt.

## Gleichzeitige Bearbeitung

Schreibvorgänge auf einem Blockplan und auf einem Kurs verwenden optimistisches Locking: Bei einem Konflikt wird nichts überschrieben, und die bearbeitende Person muss den aktuellen Stand laden, bevor sie ihre Änderung erneut einbringt. Beim Blockplan gilt das für Bezeichnung, Entwurfsinhalt, Kurszuordnungen sowie Veröffentlichen und Zurücknehmen. Stilles Last-write-wins ist überall ausgeschlossen — insbesondere beim Zuordnen und Lösen, wo ein stiller Verlust bedeuten würde, dass ein Kurs unbemerkt im fremden Blockplan landet.

## Referenzintegrität

Wird ein noch nie veröffentlichter Blockplan gelöscht, entfallen seine Blockphasen, Kursphasen und prüfungsrelevanten Termine mit ihm.

Bereiche und Studiengänge, auf die Kurse oder Blockpläne verweisen, werden deaktiviert statt gelöscht. Bereich und Anzahl Semester eines Studiengangs mit bestehenden Kursen zu ändern, erfordert eine gesonderte, auditierte Datenmigration.

## Oberflächen

Die öffentliche Ansicht ist eine vergleichende Planmatrix: Semester und Kurse sind nebeneinander lesbar, Abweichungen zwischen parallelen Kursen sichtbar und prüfungsrelevante Termine aufgeführt.

Die interne Bearbeitung ist ein geführter, semesterweiser Editor mit Entwurfsstatus und Vorschau. Beide Oberflächen lesen dieselben strukturierten Daten, sind aber bewusst unterschiedlich gestaltet.

## Dimensionierungs- und Leistungsannahmen

Das MVP ist für höchstens 200 aktive interne Konten, bis zu 20 gleichzeitig aktive interne Sitzungen und höchstens fünf gleichzeitige Schreibvorgänge ausgelegt. Die öffentliche Ansicht wird mit 100 gleichzeitig lesenden Nutzenden getestet. Unter diesem Testprofil sollen 95 % der öffentlichen Listen- und Detailaufrufe innerhalb von zwei Sekunden und 95 % der Speicher- und Veröffentlichungsvorgänge innerhalb von drei Sekunden beantwortet werden. Ein gesondertes Verfügbarkeits-SLA über den bestehenden DHBW-Betrieb hinaus besteht nicht.

## Nicht Teil des MVP

- PDF-Export einzelner Blockpläne; die responsive Webansicht ist maßgeblich.
- Import oder Migration aus PDFs, Bildern, Excel oder anderen Systemen; die Ersterfassung erfolgt manuell und strukturiert.
- DHBW-Keycloak/OIDC-SSO und Studierenden-Logins.
- Curriculum- bzw. Studienverlaufsverwaltung sowie Vorlesungs-, Dozierenden- und Raumplanung.
- Bereichsübergreifendes Kopieren, gemeinsames Bearbeiten oder Synchronisieren von Blockplänen. Synchronisierte Bereiche führen im MVP eigene Pläne.
- Studienverläufe mit einer anderen Dauer als 6 oder 7 Semestern.
- Blockplanübergreifende Gesamtansichten, etwa ein bereichsweiter Gantt über mehrere Jahrgänge — öffentlich über die veröffentlichten Fassungen, intern zusätzlich über die Entwürfe. Ein späterer Ausbau; das Datenmodell trägt ihn bereits, und die Zeitachse einer solchen Ansicht erlaubt anders als die semesterspaltige Planmatrix auch Kurse mit unterschiedlicher Semesterzahl nebeneinander. Innerhalb eines Blockplans ist die studiengangsübergreifende Darstellung dagegen Kernfunktion und nicht ausgeschlossen.
- Eine persönliche kursbezogene Blockband-Ansicht; sie bleibt eine mögliche spätere Studierendenansicht.
