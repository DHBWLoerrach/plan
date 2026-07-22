# MVP-Spezifikation — Blockplanverwaltung

## Ziel

Die DHBW Lörrach erhält eine Webanwendung, in der berechtigte Mitarbeitende strukturierte Blockpläne für die Kurse ihrer Bereiche erstellen, bearbeiten und veröffentlichen. Externe Nutzende lesen ausschließlich veröffentlichte Pläne.

Die fachlichen Begriffe, Entitäten und Validierungsregeln sind verbindlich in [`../CONTEXT.md`](../CONTEXT.md) definiert.

## Rollen und Sichtbarkeit

- Studiengangsmanagement erstellt und bearbeitet Entwürfe in den eigenen Bereichen.
- Studiengangsleitung bearbeitet Entwürfe und darf sie in den eigenen Bereichen veröffentlichen oder zurücknehmen.
- Systemadministration verwaltet Bereiche, Studiengänge, Konten, Rollen und Bereichszuordnungen; sie darf fachliche Inhalte aller Bereiche bearbeiten und veröffentlichen.
- Interne Rollen sehen unveröffentlichte Entwürfe nur in ihren Bereichen; die Systemadministration sieht alle Entwürfe.
- Externe Nutzende sehen nur veröffentlichte Pläne.

## Lokale Konten im MVP

Die dienstliche E-Mail-Adresse identifiziert ein internes Konto eindeutig. Es gibt weder Selbstregistrierung noch automatischen E-Mail-Versand. Das initiale Systemadministrationskonto wird beim Deployment eingerichtet; danach legt allein die Systemadministration Konten in der Administrationsoberfläche an.

Aktivierungs- und Reset-Links werden dort erzeugt, kopiert und manuell an die berechtigte Person weitergegeben. Konten werden deaktiviert statt gelöscht und können reaktiviert werden. Keycloak/OIDC und Studierenden-Logins sind ein späterer Ausbau; sie dürfen die fachlichen Konten-, Rollen- und Bereichsbeziehungen nicht verändern.

## Veröffentlichung

Ein neuer Blockplan beginnt als Entwurf. Ein Entwurf darf fachlich unvollständig sein; die Veröffentlichung prüft alle Datenregeln. Es gibt höchstens eine öffentliche Fassung. Änderungen erfolgen in einem parallel bearbeitbaren Entwurf und ersetzen die öffentliche Fassung atomar.

Eine Zurücknahme beendet die öffentliche Sichtbarkeit, erhält die Daten aber intern für eine spätere erneute Veröffentlichung. Nie veröffentlichte Entwürfe dürfen Studiengangsleitung oder Systemadministration löschen; bereits veröffentlichte Blockpläne nicht. Frühere veröffentlichte Fassungen werden weder angezeigt noch wiederhergestellt. Die Auditspur erfasst Erstellung, letzte Änderung, Veröffentlichung und Zurücknahme mit Zeitpunkt und handelndem Konto.

Veröffentlichte Pläne bleiben für vergangene, aktuelle und zukünftige Jahrgänge öffentlich auffindbar.

## Oberflächen

Die öffentliche Ansicht ist eine vergleichende Planmatrix: Semester und Kurse sind nebeneinander lesbar, A-/B-Abweichungen sichtbar und prüfungsrelevante Termine aufgeführt.

Die interne Bearbeitung ist ein geführter, semesterweiser Editor mit Entwurfsstatus und Vorschau. Öffentliche Ansicht und Editor verwenden dieselben strukturierten Daten, aber bewusst unterschiedliche Oberflächen.

Eine persönliche kursbezogene Blockband-Ansicht ist nicht Teil des MVP. Sie bleibt eine mögliche spätere Studierendenansicht.

## Nicht Teil des MVP

- PDF-Export und studienzentrumübergreifende PDF-Zusammenfassungen; die responsive Webansicht ist maßgeblich.
- Import oder Migration aus PDFs, Bildern, Excel oder anderen Systemen; die Ersterfassung erfolgt manuell und strukturiert.
- DHBW-Keycloak/OIDC-SSO und Studierenden-Logins.
- Curriculum- bzw. Studienverlaufsverwaltung sowie Vorlesungs-, Dozierenden- und Raumplanung.
- Bereichsübergreifendes Kopieren, gemeinsames Bearbeiten oder Synchronisieren von Blockplänen. Synchronisierte Bereiche führen im MVP eigene Pläne.
