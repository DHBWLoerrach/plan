# Ubiquitous Language

## Blockplan

Eine gemeinsam verwaltete und veröffentlichte Planungseinheit für die Abfolge von Theorie- und Praxisphasen sowie die zugehörigen prüfungsrelevanten Termine eines oder mehrerer Kurse desselben Jahrgangs. Ein Blockplan besitzt eine unveränderliche systemische Identität und eine erforderliche, innerhalb seines Bereichs und Jahrgangs eindeutige Bezeichnung, gehört genau einem Bereich und enthält ausschließlich Kurse aus dessen Studiengängen; innerhalb eines Bereichs und Jahrgangs darf es mehrere Blockpläne geben.

## Kurs

Eine Gruppe von Studierenden eines Studiengangs und Jahrgangs, die vom Studienbeginn bis zum Studienende zusammenbleibt. Ein Kurs ist eine eigenständige fachliche Einheit und höchstens einem Blockplan zugeordnet; Kurse mit vollständig oder teilweise gemeinsamem zeitlichem Verlauf dürfen in demselben Blockplan geplant werden. Die Kurskennung ist eine verpflichtende, systemweit eindeutige Kennung und verbindet Studiengang, Jahrgang und parallele Kursgruppe, zum Beispiel `TIF24A` oder `WDS24A`. Studiengang, Studienbeginn und Studienende sind zusätzlich verpflichtende eigene Angaben und während des gesamten Lebenszyklus eines Kurses unveränderlich; die Kennung hat im MVP kein erzwungenes Format. „Kohorte“ ist kein kanonischer Begriff der Anwendung.

Kurse werden von Studiengangsleitung und Studiengangsmanagement im eigenen Bereich angelegt und gepflegt; der verwaltende Bereich eines Kurses ist keine eigene Angabe am Kurs, sondern ergibt sich aus dem Bereich seines Studiengangs; er gilt auch für einen Kurs ohne Blockplanzuordnung.

Solange ein Kurs kein veröffentlichter Kurs ist, darf er einem Blockplan zugeordnet und wieder von ihm gelöst werden. Eine Zuordnung ist nur zulässig, wenn der Studiengang des Kurses zu einem Studiengang des Bereichs gehört, dem der Blockplan zugeordnet ist, und der Jahrgang des Kurses dem Jahrgang des Blockplans entspricht. Beim Lösen entfallen die Kursphasen dieses Kurses sowie seine Zuordnungen zu den prüfungsrelevanten Terminen desselben Blockplans; jeder verbleibende Termin muss weiterhin mindestens einen Kurs betreffen.

## Veröffentlichter Kurs

Ein Kurs, der in mindestens einer veröffentlichten Fassung eines Blockplans enthalten war. Ein Kurs wird nie selbst veröffentlicht; veröffentlicht wird ausschließlich der Blockplan, und der Zustand des Kurses leitet sich daraus ab. Eine spätere Zurücknahme hebt ihn nicht auf. Bei einem veröffentlichten Kurs ist die Kurskennung unveränderlich; er wird weder gelöscht noch von seinem Blockplan gelöst oder einem anderen Blockplan zugeordnet.

## Jahrgang

Das Kalenderjahr, in dem das Studium eines Kurses beginnt. Alle Kurse eines Blockplans gehören demselben Jahrgang an.

## Studienzeitraum

Der einschließlich beider Grenztage geltende Zeitraum vom verpflichtenden Studienbeginn bis zum verpflichtenden Studienende eines Kurses; dabei gilt Studienbeginn < Studienende. In einer veröffentlichten Fassung decken die Kursphasen jeden Kalendertag dieses Zeitraums genau einmal ab, auch Wochenenden, Feiertage und vorlesungsfreie Tage. Solche Tage bilden keine eigene Phasenart und sind nicht automatisch Praxis, sondern tragen den Typ der sie abdeckenden Blockphase.

## Kalendertag und Ortszeit

Start- und Enddaten sind zeitzonenlose Kalendertage im gregorianischen Kalender. Optionale Uhrzeiten prüfungsrelevanter Termine gelten in der Ortszeit `Europe/Berlin`; eine technische Umrechnung darf den zugehörigen Kalendertag nicht verändern.

## Bereich

Die organisatorische Einheit, für die interne Mitarbeitende Kurse und deren Blockpläne verwalten dürfen. Ein Bereich enthält einen oder mehrere Studiengänge; jeder Studiengang gehört genau einem verwaltenden Bereich. Interne Konten können mehreren Bereichen zugeordnet sein. Bereiche und Studiengänge werden von der Systemadministration angelegt und gepflegt.

## Studienzentrum

Ein Bereich, der mehrere Studiengänge zusammenfasst, zum Beispiel das Studienzentrum IT-Management & Informatik (SZI) mit Informatik und Wirtschaftsinformatik.

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

Die bewusst freigegebene Fassung eines Blockplans, die externe Nutzende sehen und mindestens einen Kurs enthält. Während Änderungen an einem Entwurf erfolgen, bleibt sie sichtbar. Eine neue Veröffentlichung ersetzt sie; frühere veröffentlichte Revisionen werden im MVP weder angezeigt noch wiederhergestellt. Ein bereits veröffentlichter Blockplan wird im MVP nicht gelöscht. Eine Veröffentlichung ist nur möglich, wenn alle fachlichen Datenregeln erfüllt sind; Entwürfe dürfen dagegen unvollständig sein.

Unveröffentlichte Entwürfe sind nur für die fachlichen Rollen des zugeordneten Bereichs sowie für die Systemadministration sichtbar.

## Zurückgenommene Veröffentlichung

Ein Blockplan, dessen veröffentlichte Fassung von Studiengangsleitung oder Systemadministration aus der öffentlichen Ansicht entfernt wurde. Seine Daten und sein Entwurf bleiben intern erhalten und können erneut veröffentlicht werden.

## Auditspur

Die interne Nachvollziehbarkeit fachlicher und administrativer Aktionen mit Zeitpunkt und handelndem Konto. Sie umfasst bei Blockplänen Erstellung, letzte Änderung, Veröffentlichung und Zurücknahme sowie bei Konten deren Anlage, Aktivierung, Deaktivierung und Reaktivierung, Änderungen von Rollen oder Bereichszuordnungen und die Erzeugung von Aktivierungs- oder Reset-Links; geheime Linkinhalte werden nicht erfasst und die Auditspur ist kein wiederherstellbares Revisionsarchiv.

## Blockphase

Ein einmal erfasster Zeitblock innerhalb eines Blockplans mit Start- und Enddatum, genau einem Semester und dem Typ Theorie oder Praxis. Eine Blockphase darf mehreren Kursen auch über Studiengangsgrenzen hinweg gemeinsam zugeordnet sein; unterscheiden sich Zeitraum, Semester oder Typ, handelt es sich um verschiedene Blockphasen. „Phase“ und „Urlaubsphase“ sind keine kanonischen Begriffe.

Eine Blockphase ist einschließlich beider Grenztage gültig; für sie gilt Startdatum ≤ Enddatum, sodass sie auch genau einen Kalendertag umfassen kann. Gleichartige Blockphasen dürfen unmittelbar aufeinander folgen. In einer veröffentlichten Fassung ist jede Blockphase mindestens einer Kursphase zugeordnet; ein Entwurf darf vorübergehend verwaiste Blockphasen enthalten.

## Kursphase

Die Zuordnung genau eines Kurses zu genau einer Blockphase. Sie enthält keine eigene Kopie von Zeitraum, Semester oder Phasentyp. Vorlesungen gehören nicht zum MVP; in einer späteren Vorlesungsplanung dürfen sie ausschließlich Kursphasen zugeordnet werden, deren Blockphase vom Typ Theorie ist.

In einer veröffentlichten Fassung schließen die Kursphasen eines Kurses lückenlos aneinander an und überlappen sich nicht; auf das Enddatum der zugeordneten Blockphase folgt als Startdatum der nächsten zugeordneten Blockphase der nächste Kalendertag. Ihre Semesternummern sind entlang der Zeitachse monoton nicht fallend, und alle Kursphasen desselben Semesters bilden einen zusammenhängenden Abschnitt. Ein Entwurf darf diese Regeln vorübergehend verletzen.

## Semester

Die fortlaufende Studienperiode einer Blockphase. Ein veröffentlichter Kursverlauf enthält die Semester 1 bis 6 jeweils mindestens einmal und in dieser Reihenfolge; eine Blockphase gehört vollständig zu genau einem Semester. Das Studienjahr wird aus dem Semester abgeleitet: Semester 1 und 2 gehören zu Studienjahr 1, Semester 3 und 4 zu Studienjahr 2 sowie Semester 5 und 6 zu Studienjahr 3.

## Prüfungsrelevanter Termin

Eine Planangabe mit Titel, optionaler Beschreibung, Pflichtkategorie und Geltungsbereich für mindestens einen Kurs desselben Blockplans. Ein Blockplan darf keinen, einen oder mehrere prüfungsrelevante Termine enthalten. Die Kategorien sind Anmeldung, Abgabe, Präsentation, Prüfung und Sonstiges. Ein Termin ist nicht zwingend einer Blockphase oder einem Semester zugeordnet, muss aber vollständig innerhalb des Studienzeitraums jedes betroffenen Kurses liegen. Seine strukturierte Zeitangabe ist entweder ein genaues Datum mit optionaler Uhrzeit, ein beidseitig inklusiver Datumsbereich oder ein vollständiger Kalendermonat vom ersten bis zum letzten Tag; jede Angabe kann als vorläufig markiert werden.
