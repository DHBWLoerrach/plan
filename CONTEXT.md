# Ubiquitous Language

## Blockplan

Eine gemeinsam verwaltete und veröffentlichte Planungseinheit für die Abfolge von Theorie- und Praxisphasen sowie die zugehörigen prüfungsrelevanten Termine eines oder mehrerer Kurse desselben Jahrgangs. Ein Blockplan gehört genau einem Bereich und enthält ausschließlich Kurse aus dessen Studiengängen; gemeinsame und abweichende zeitliche Verläufe werden innerhalb desselben Plans abgebildet.

## Kurs

Eine Gruppe von Studierenden eines Studiengangs und Jahrgangs, die vom Studienbeginn bis zum Studienende zusammenbleibt. Ein Kurs gehört genau einem Blockplan; Kurse mit vollständig oder teilweise gemeinsamem zeitlichem Verlauf dürfen demselben Blockplan angehören. Die Kurskennung ist eine verpflichtende, systemweit eindeutige Kennung und verbindet Studiengang, Jahrgang und parallele Kursgruppe, zum Beispiel `TIF24A` oder `WDS24A`. Studiengang, Studienbeginn und Studienende sind zusätzlich verpflichtende eigene Angaben; die Kennung hat im MVP kein erzwungenes Format. „Kohorte“ ist kein kanonischer Begriff der Anwendung.

Kurse werden von Studiengangsleitung und Studiengangsmanagement im eigenen Bereich angelegt und gepflegt.

## Jahrgang

Das Kalenderjahr, in dem das Studium eines Kurses beginnt. Alle Kurse eines Blockplans gehören demselben Jahrgang an.

## Studienzeitraum

Der einschließlich beider Grenztage geltende Zeitraum vom verpflichtenden Studienbeginn bis zum verpflichtenden Studienende eines Kurses; dabei gilt Studienbeginn < Studienende. In einer veröffentlichten Fassung decken die Kursphasen jeden Kalendertag dieses Zeitraums genau einmal ab, auch Wochenenden, Feiertage und vorlesungsfreie Tage.

## Bereich

Die organisatorische Einheit, für die interne Mitarbeitende Kurse und deren Blockpläne verwalten dürfen. Ein Bereich enthält einen oder mehrere Studiengänge; jeder Studiengang gehört genau einem verwaltenden Bereich. Interne Konten können mehreren Bereichen zugeordnet sein. Bereiche und Studiengänge werden von der Systemadministration angelegt und gepflegt.

## Studienzentrum

Ein Bereich, der mehrere Studiengänge zusammenfasst, zum Beispiel das Studienzentrum IT-Management & Informatik (SZI) mit Informatik und Wirtschaftsinformatik. Eine spätere Funktion soll Blockpläne seiner Studiengänge in einer Darstellung und als PDF zusammenfassen.

## Studiengangsleitung und Studiengangsmanagement

Interne Rollen, die Kurse und Blockpläne ausschließlich in ihren zugeordneten Bereichen verwalten dürfen. Das Studiengangsmanagement erstellt und bearbeitet Entwürfe; die Studiengangsleitung darf Entwürfe ebenfalls bearbeiten und veröffentlicht sie.

## Systemadministration

Eine globale interne Superuser-Rolle, die Konten, Rollen und Bereichszuordnungen systemweit verwaltet und fachliche Inhalte aller Bereiche bearbeiten und veröffentlichen darf.

## Externe Nutzende

Nicht angemeldete oder nicht intern berechtigte Personen, die ausschließlich veröffentlichte Blockpläne einsehen dürfen.

## Zentrale Benutzerverwaltung

Die für das MVP vorgesehene Verwaltung interner Konten und ihrer Bereichszuordnungen. Sie ersetzt bis zur späteren Integration die Anmeldung über das DHBW-Keycloak-System.

## Internes Konto

Ein von der Systemadministration angelegtes Konto für eine interne Person. Es wird über die dienstliche E-Mail-Adresse eindeutig identifiziert und im MVP mit einem lokal verwalteten Passwort angemeldet. Selbstregistrierung ist nicht vorgesehen. Die Systemadministration erzeugt Aktivierungs- und Reset-Links im UI und übermittelt sie ohne automatischen E-Mail-Versand direkt an die berechtigte Person. Konten werden deaktiviert statt gelöscht und können später reaktiviert werden.

## Aktivierungs- oder Reset-Link

Ein zeitlich begrenzter Link, über den eine berechtigte Person für ihr internes Konto erstmals ein Passwort setzt oder es neu setzt. Er wird von der Systemadministration im UI erzeugt und manuell weitergegeben.

## Keycloak/OIDC-Integration

Die spätere Single-Sign-On-Integration mit dem Keycloak-System der DHBW Lörrach; sie gehört nicht zum MVP.

## Strukturierter Blockplan

Ein Blockplan, dessen Blockphasen, Kursphasen und prüfungsrelevanten Termine als bearbeitbare Anwendungsdaten gespeichert werden. Ein PDF- oder Bild-Upload ist nicht seine primäre Repräsentation.

## Entwurf

Eine bearbeitbare, nicht öffentlich sichtbare Fassung eines Blockplans. Ein noch nie veröffentlichter Entwurf kann von Studiengangsleitung oder Systemadministration gelöscht werden.

## Veröffentlichte Fassung

Die bewusst freigegebene Fassung eines Blockplans, die externe Nutzende sehen. Während Änderungen an einem Entwurf erfolgen, bleibt sie sichtbar. Eine neue Veröffentlichung ersetzt sie; frühere veröffentlichte Revisionen werden im MVP weder angezeigt noch wiederhergestellt. Ein bereits veröffentlichter Blockplan wird im MVP nicht gelöscht. Eine Veröffentlichung ist nur möglich, wenn alle fachlichen Datenregeln erfüllt sind; Entwürfe dürfen dagegen unvollständig sein.

Unveröffentlichte Entwürfe sind nur für die fachlichen Rollen des zugeordneten Bereichs sowie für die Systemadministration sichtbar.

## Zurückgenommene Veröffentlichung

Ein Blockplan, dessen veröffentlichte Fassung von Studiengangsleitung oder Systemadministration aus der öffentlichen Ansicht entfernt wurde. Seine Daten und sein Entwurf bleiben intern erhalten und können erneut veröffentlicht werden.

## Auditspur

Die interne Nachvollziehbarkeit eines Blockplans. Sie hält die Erstellung, die letzte Änderung sowie jede Veröffentlichung und Zurücknahme jeweils mit Zeitpunkt und handelndem Konto fest; sie ist kein wiederherstellbares Revisionsarchiv.

## Blockphase

Ein einmal erfasster Zeitblock innerhalb eines Blockplans mit Start- und Enddatum, genau einem Semester und dem Typ Theorie oder Praxis. Eine Blockphase darf mehreren Kursen auch über Studiengangsgrenzen hinweg gemeinsam zugeordnet sein; unterscheiden sich Zeitraum, Semester oder Typ, handelt es sich um verschiedene Blockphasen. „Phase“ und „Urlaubsphase“ sind keine kanonischen Begriffe.

Eine Blockphase überschreitet keine Semestergrenze; ein fachlich längerer Zeitraum wird an der Grenze geteilt. Für jede Blockphase gilt Startdatum < Enddatum; gleichartige Blockphasen dürfen unmittelbar aufeinander folgen.

## Kursphase

Die Zuordnung genau eines Kurses zu genau einer Blockphase. Sie enthält keine eigene Kopie von Zeitraum, Semester oder Phasentyp; Vorlesungen dürfen ausschließlich für Kursphasen geplant werden, deren Blockphase vom Typ Theorie ist.

In einer veröffentlichten Fassung schließen die Kursphasen eines Kurses lückenlos aneinander an und überlappen sich nicht; auf das Enddatum der zugeordneten Blockphase folgt als Startdatum der nächsten zugeordneten Blockphase der nächste Kalendertag. Ein Entwurf darf diese Regel vorübergehend verletzen.

## Semester

Die fortlaufende Studienperiode einer Blockphase. Ein Blockplan hat ausschließlich die Semester 1 bis 6. Das Studienjahr wird aus dem Semester abgeleitet: Semester 1 und 2 gehören zu Studienjahr 1, Semester 3 und 4 zu Studienjahr 2 sowie Semester 5 und 6 zu Studienjahr 3.

## Prüfungsrelevanter Termin

Ein Termin oder Zeitraum mit Titel, optionaler Beschreibung, Pflichtkategorie und Geltungsbereich für mindestens einen Kurs, der innerhalb eines Blockplans veröffentlicht wird. Die Kategorien sind Anmeldung, Abgabe, Präsentation, Prüfung und Sonstiges. Ein Termin ist nicht zwingend einer Blockphase oder einem Semester zugeordnet, muss aber vollständig innerhalb des Studienzeitraums jedes betroffenen Kurses liegen. Seine strukturierte Zeitangabe ist entweder ein genaues Datum (optional mit Uhrzeit), ein Datumsbereich oder Monat/Jahr; jede Angabe kann als vorläufig markiert werden.
