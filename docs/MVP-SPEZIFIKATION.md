# MVP-Spezifikation — Blockplanverwaltung

## Ziel

Die DHBW Lörrach erhält eine Webanwendung, in der berechtigte Mitarbeitende strukturierte Blockpläne für die Kurse ihrer Bereiche erstellen, bearbeiten und veröffentlichen. Externe Nutzende lesen ausschließlich veröffentlichte Pläne.

Die fachlichen Begriffe, Entitäten und Validierungsregeln sind verbindlich in [`../CONTEXT.md`](../CONTEXT.md) definiert.

## Rollen und Sichtbarkeit

Die folgende Tabelle ist eine abgeleitete Übersicht. Normativ sind die Rollenabschnitte in [`../CONTEXT.md`](../CONTEXT.md); bei Abweichungen gilt dort Geschriebenes.

| Funktion | Studiengangsmanagement | Studiengangsleitung | Systemadministration | Externe Nutzende |
| --- | --- | --- | --- | --- |
| Kurse anlegen und bearbeiten | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Noch nicht veröffentlichte Kurse löschen | – | eigene Bereiche | alle Bereiche | – |
| Noch nicht veröffentlichte Kurse einem Blockplan zuordnen oder von ihm lösen | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Blockplanentwürfe anlegen und bearbeiten | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Noch nie veröffentlichte Blockpläne löschen | – | eigene Bereiche | alle Bereiche | – |
| Veröffentlichen und zurücknehmen | – | eigene Bereiche | alle Bereiche | – |
| Auditspur zu Blockplänen und Kursen einsehen | eigene Bereiche | eigene Bereiche | alle Bereiche | – |
| Auditspur zu internen Konten einsehen | – | – | systemweit | – |
| Bereiche, Studiengänge, Konten und Rechte verwalten | – | – | systemweit | – |
| Veröffentlichte Blockpläne lesen | ja | ja | ja | ja |

Interne Rollen sehen unveröffentlichte Entwürfe nur in ihren Bereichen; die Systemadministration sieht alle Entwürfe.

Ein internes Konto trägt höchstens eine fachliche Rolle, die in allen seinen Bereichen gleich gilt. Systemadministration ist ein davon unabhängiges Merkmal und kann zu einer fachlichen Rolle hinzukommen.

## Identität und öffentliche Auffindbarkeit

Jeder Blockplan wird über seine unveränderliche systemische ID adressiert. Mehrere Blockpläne desselben Bereichs und Jahrgangs sind zulässig, etwa wenn Kursgruppen organisatorisch getrennt geplant werden.

Die öffentliche Anwendung bietet Filter nach Bereich, Studiengang, Jahrgang und Kurskennung. Sie berücksichtigt dabei nur Kurse, die in der veröffentlichten Fassung Kursphasen besitzen; ein lediglich im Entwurf zugeordneter Kurs bleibt öffentlich unsichtbar. Jeder veröffentlichte Blockplan ist zusätzlich über eine stabile, von seiner veränderbaren Bezeichnung unabhängige URL erreichbar.

## Lokale Konten im MVP

Die dienstliche E-Mail-Adresse identifiziert ein internes Konto eindeutig. Es gibt weder Selbstregistrierung noch automatischen E-Mail-Versand. Das initiale Systemadministrationskonto wird beim Deployment eingerichtet; danach legt allein die Systemadministration Konten in der Administrationsoberfläche an.

Aktivierungs- und Reset-Links werden dort erzeugt, kopiert und manuell an die berechtigte Person weitergegeben. Konten werden deaktiviert statt gelöscht und können reaktiviert werden. Keycloak/OIDC und Studierenden-Logins sind ein späterer Ausbau; sie dürfen die fachlichen Konten-, Rollen- und Bereichsbeziehungen nicht verändern.

Kontoanlage, Aktivierung, Deaktivierung, Reaktivierung, Änderungen von Rollen oder Bereichszuordnungen und die Erzeugung von Aktivierungs- oder Reset-Links werden administrativ auditiert; geheime Linkinhalte werden nicht protokolliert.

## Veröffentlichung

Ein neuer Blockplan beginnt als Entwurf. Ein Entwurf darf die Veröffentlichungsregeln aus `CONTEXT.md` verletzen, die Strukturregeln jedoch nie; die Veröffentlichung prüft beide Klassen. Sie setzt insbesondere voraus, dass der Studienverlauf jedes enthaltenen Kurses über alle sechs Semester vollständig geplant ist — eine schrittweise Veröffentlichung einzelner Studienjahre gibt es nicht. Es gibt höchstens eine öffentliche Fassung. Änderungen erfolgen in einem parallel bearbeitbaren Entwurf und ersetzen die öffentliche Fassung atomar.

Eine Zurücknahme beendet die öffentliche Sichtbarkeit, erhält die Daten aber intern für eine spätere erneute Veröffentlichung. Nie veröffentlichte Entwürfe dürfen Studiengangsleitung oder Systemadministration löschen; bereits veröffentlichte Blockpläne nicht. Frühere veröffentlichte Fassungen werden weder angezeigt noch wiederhergestellt. Die Auditspur erfasst Erstellung, Veröffentlichung, Zurücknahme und Löschung mit Zeitpunkt und handelndem Konto; einzelne Speichervorgänge sind keine Auditereignisse, sondern erscheinen als „zuletzt geändert“ am Entwurf.

Veröffentlichte Pläne bleiben für vergangene, aktuelle und zukünftige Jahrgänge öffentlich auffindbar.

## Gleichzeitige Bearbeitung

Jeder Entwurf besitzt einen Versionsstand. Schreibvorgänge übermitteln den gelesenen Versionsstand und werden nur ausgeführt, wenn er noch aktuell ist. Bei einem Konflikt wird nichts überschrieben; die bearbeitende Person erhält eine verständliche Meldung und muss die aktuelle Fassung laden, bevor sie ihre Änderung erneut einbringt. Stilles Last-write-wins ist ausgeschlossen.

## Lebenszyklus und Referenzintegrität

Ein Kurs wird unabhängig von einem Blockplan angelegt und kann ohne Blockplan bestehen; er darf höchstens einem Blockplan zugeordnet sein. Solange ein Kurs kein veröffentlichter Kurs im Sinne von `CONTEXT.md` ist, sind seine Angaben änderbar und er kann zugeordnet, gelöst und gelöscht werden; die Kaskade auf Kursphasen und Terminzuordnungen sowie die Bedingungen für eine Zuordnung stehen dort. Sobald ein Kurs in einer veröffentlichten Fassung enthalten war, ist er unveränderlich und wird weder gelöscht noch gelöst oder umgehängt.

Wird ein noch nie veröffentlichter Blockplan gelöscht, bleiben die ihm zugeordneten Kurse als eigenständige, blockplanlose Kurse bestehen. Seine Blockphasen, die zugehörigen Kursphasen und seine prüfungsrelevanten Termine entfallen mit ihm.

Bereiche und Studiengänge, auf die Kurse oder Blockpläne verweisen, werden nicht gelöscht, sondern deaktiviert; was Deaktivierung bewirkt, steht in `CONTEXT.md`. Ein Studiengang darf nur dann einem anderen Bereich zugeordnet werden, wenn noch kein Kurs und kein Blockplan von ihm abhängt; andernfalls ist eine gesonderte, auditierte Datenmigration erforderlich.

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
