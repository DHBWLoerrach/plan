# MVP-Spezifikation — Blockplanverwaltung

## Ziel

Die DHBW Lörrach erhält eine Webanwendung, in der berechtigte Mitarbeitende strukturierte Blockpläne für die Kurse ihrer Bereiche erstellen, bearbeiten und veröffentlichen. Externe Nutzende lesen ausschließlich veröffentlichte Pläne.

Die fachlichen Begriffe, Entitäten und Validierungsregeln sind verbindlich in [`../CONTEXT.md`](../CONTEXT.md) definiert.

## Rollen und Sichtbarkeit

| Funktion | Studiengangsmanagement | Studiengangsleitung | Systemadministration | Externe Nutzende |
| --- | --- | --- | --- | --- |
| Kurse anlegen und bearbeiten | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Noch nie veröffentlichte Kurse entfernen | – | eigene Bereiche | alle Bereiche | – |
| Blockplanentwürfe anlegen und bearbeiten | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Noch nie veröffentlichte Blockpläne löschen | – | eigene Bereiche | alle Bereiche | – |
| Veröffentlichen und zurücknehmen | – | eigene Bereiche | alle Bereiche | – |
| Bereiche, Studiengänge, Konten und Rechte verwalten | – | – | systemweit | – |
| Veröffentlichte Blockpläne lesen | ja | ja | ja | ja |

Interne Rollen sehen unveröffentlichte Entwürfe nur in ihren Bereichen; die Systemadministration sieht alle Entwürfe.

## Identität und öffentliche Auffindbarkeit

Jeder Blockplan wird über seine unveränderliche systemische ID adressiert. Mehrere Blockpläne desselben Bereichs und Jahrgangs sind zulässig, etwa wenn Kursgruppen organisatorisch getrennt geplant werden.

Die öffentliche Anwendung bietet Filter nach Bereich, Studiengang, Jahrgang und Kurskennung. Jeder veröffentlichte Blockplan ist zusätzlich über eine stabile, von seiner veränderbaren Bezeichnung unabhängige URL erreichbar.

## Lokale Konten im MVP

Die dienstliche E-Mail-Adresse identifiziert ein internes Konto eindeutig. Es gibt weder Selbstregistrierung noch automatischen E-Mail-Versand. Das initiale Systemadministrationskonto wird beim Deployment eingerichtet; danach legt allein die Systemadministration Konten in der Administrationsoberfläche an.

Aktivierungs- und Reset-Links werden dort erzeugt, kopiert und manuell an die berechtigte Person weitergegeben. Konten werden deaktiviert statt gelöscht und können reaktiviert werden. Keycloak/OIDC und Studierenden-Logins sind ein späterer Ausbau; sie dürfen die fachlichen Konten-, Rollen- und Bereichsbeziehungen nicht verändern.

Kontoanlage, Aktivierung, Deaktivierung, Reaktivierung, Änderungen von Rollen oder Bereichszuordnungen und die Erzeugung von Aktivierungs- oder Reset-Links werden administrativ auditiert; geheime Linkinhalte werden nicht protokolliert.

## Veröffentlichung

Ein neuer Blockplan beginnt als Entwurf. Ein Entwurf darf fachlich unvollständig sein; die Veröffentlichung prüft alle Datenregeln. Es gibt höchstens eine öffentliche Fassung. Änderungen erfolgen in einem parallel bearbeitbaren Entwurf und ersetzen die öffentliche Fassung atomar.

Eine Zurücknahme beendet die öffentliche Sichtbarkeit, erhält die Daten aber intern für eine spätere erneute Veröffentlichung. Nie veröffentlichte Entwürfe dürfen Studiengangsleitung oder Systemadministration löschen; bereits veröffentlichte Blockpläne nicht. Frühere veröffentlichte Fassungen werden weder angezeigt noch wiederhergestellt. Die Auditspur erfasst Erstellung, letzte Änderung, Veröffentlichung und Zurücknahme mit Zeitpunkt und handelndem Konto.

Veröffentlichte Pläne bleiben für vergangene, aktuelle und zukünftige Jahrgänge öffentlich auffindbar.

## Gleichzeitige Bearbeitung

Jeder Entwurf besitzt einen Versionsstand. Schreibvorgänge übermitteln den gelesenen Versionsstand und werden nur ausgeführt, wenn er noch aktuell ist. Bei einem Konflikt wird nichts überschrieben; die bearbeitende Person erhält eine verständliche Meldung und muss die aktuelle Fassung laden, bevor sie ihre Änderung erneut einbringt. Stilles Last-write-wins ist ausgeschlossen.

## Lebenszyklus und Referenzintegrität

Ein Kurs wird ausschließlich innerhalb eines Blockplans angelegt und hat deshalb zu keinem Zeitpunkt einen Zustand ohne Blockplan. Ein noch nie veröffentlichter Kurs kann entfernt werden, wenn in derselben Operation seine Kursphasen und Terminzuordnungen entfernt oder neu zugeordnet werden; jeder verbleibende prüfungsrelevante Termin muss weiterhin mindestens einen Kurs betreffen. Für erstmals veröffentlichte Kurse gelten dauerhaft die Lösch-, Zuordnungs- und Kennungsregeln aus `CONTEXT.md`.

Bereiche und Studiengänge, auf die Kurse oder Blockpläne verweisen, werden nicht gelöscht, sondern deaktiviert. Ein Studiengang darf nur dann einem anderen Bereich zugeordnet werden, wenn noch kein Kurs und kein Blockplan von ihm abhängt; andernfalls ist eine gesonderte, auditierte Datenmigration erforderlich.

## Oberflächen

Die öffentliche Ansicht ist eine vergleichende Planmatrix: Semester und Kurse sind nebeneinander lesbar, Abweichungen zwischen parallelen Kursen sichtbar und prüfungsrelevante Termine aufgeführt.

Die interne Bearbeitung ist ein geführter, semesterweiser Editor mit Entwurfsstatus und Vorschau. Öffentliche Ansicht und Editor verwenden dieselben strukturierten Daten, aber bewusst unterschiedliche Oberflächen.

Eine persönliche kursbezogene Blockband-Ansicht ist nicht Teil des MVP. Sie bleibt eine mögliche spätere Studierendenansicht.

## Dimensionierungs- und Leistungsannahmen

Das MVP ist für höchstens 200 aktive interne Konten, bis zu 20 gleichzeitig aktive interne Sitzungen und höchstens fünf gleichzeitige Schreibvorgänge ausgelegt. Die öffentliche Ansicht wird mit 100 gleichzeitig lesenden Nutzenden getestet. Unter diesem Testprofil sollen 95 % der öffentlichen Listen- und Detailaufrufe innerhalb von zwei Sekunden und 95 % der Speicher- und Veröffentlichungsvorgänge innerhalb von drei Sekunden beantwortet werden. Für das MVP besteht kein gesondertes Verfügbarkeits-SLA über den bestehenden DHBW-Betrieb hinaus.

## Nicht Teil des MVP

- PDF-Export einzelner Blockpläne; die responsive Webansicht ist maßgeblich.
- Import oder Migration aus PDFs, Bildern, Excel oder anderen Systemen; die Ersterfassung erfolgt manuell und strukturiert.
- DHBW-Keycloak/OIDC-SSO und Studierenden-Logins.
- Curriculum- bzw. Studienverlaufsverwaltung sowie Vorlesungs-, Dozierenden- und Raumplanung.
- Bereichsübergreifendes Kopieren, gemeinsames Bearbeiten oder Synchronisieren von Blockplänen. Synchronisierte Bereiche führen im MVP eigene Pläne.
- Studienverläufe mit anderer Dauer als drei Studienjahren beziehungsweise den Semestern 1 bis 6.
- Studiengangsübergreifende PDF- oder Gesamtansichten innerhalb eines Studienzentrums; sie bleiben ein späterer Ausbau.
