# Blockplanverwaltung

Dieses Glossar legt die kanonische Sprache für die Verwaltung und Veröffentlichung der Blockpläne fest. Verbindliche Invarianten, Lebenszyklen und Rechte stehen in [`docs/FACHLICHE_REGELN.md`](docs/FACHLICHE_REGELN.md).

## Planung

**Bereich**: Die organisatorische Einheit, für die interne Mitarbeitende Kurse und Blockpläne verwalten. Ein Studienzentrum ist eine örtliche Bezeichnung für einen Bereich, keine eigene Entitätsart.
_Avoid_: Studienzentrum als eigener Modellbegriff

**Studiengang**: Ein Studienangebot innerhalb eines Bereichs, beispielsweise Informatik oder Wirtschaftsinformatik.

**Jahrgang**: Das Kalenderjahr, in dem ein Kurs sein Studium beginnt.

**Kurs**: Eine Gruppe von Studierenden eines Studiengangs und Jahrgangs, die vom Studienbeginn bis zum Studienende zusammenbleibt.
_Avoid_: Kohorte

**Veröffentlichter Kurs**: Ein Kurs, dessen Verlauf mindestens einmal Bestandteil einer veröffentlichten Fassung war.

**Studienzeitraum**: Der einschließlich beider Grenztage geltende Zeitraum vom Studienbeginn bis zum Studienende eines Kurses.

**Blockplan**: Die gemeinsam verwaltete und veröffentlichte Planungseinheit für Theorie- und Praxisphasen sowie prüfungsrelevante Termine eines oder mehrerer Kurse desselben Jahrgangs. Ein Blockplan ist strukturierte Anwendungsinformation, kein Dokument.

**Entwurf**: Die intern bearbeitbare Fassung eines Blockplans.

**Veröffentlichte Fassung**: Die bewusst freigegebene Fassung eines Blockplans, die externe Nutzende sehen.

**Zurückgenommene Veröffentlichung**: Eine zuvor veröffentlichte Fassung, die aus der öffentlichen Ansicht entfernt wurde, intern aber bis zur nächsten Veröffentlichung erhalten bleibt.

## Verlauf

**Blockphase**: Ein einmal erfasster Zeitblock innerhalb einer Fassung mit Zeitraum, Semester und Phasentyp, den mehrere Kurse gemeinsam verwenden können.
_Avoid_: Phase, Urlaubsphase

**Phasentyp**: Die Art eines Studienabschnitts: Theorie an der Hochschule oder Praxis im Dualen Partnerunternehmen.

**Kursphase**: Die Zuordnung eines Kurses zu einer Blockphase.

**Semester**: Die fortlaufende Studienperiode einer Blockphase, beginnend mit Semester 1.

**Prüfungsrelevanter Termin**: Eine Planangabe für mindestens einen Kurs mit Kategorie und tagesgenauer, mehrtägiger oder monatsgenauer Zeitangabe, beispielsweise Anmeldung, Abgabe, Präsentation oder Prüfung.

**Kalendertag**: Ein zeitzonenloses Datum im gregorianischen Kalender.

**Ortszeit**: Die für optionale Uhrzeiten prüfungsrelevanter Termine geltende Zeit in `Europe/Berlin`.

## Regeln und Lebenszyklen

**Strukturregel**: Eine Invariante, die bei jedem Schreibvorgang gilt.

**Veröffentlichungsregel**: Eine zusätzliche Invariante für die Freigabe eines Entwurfs als veröffentlichte Fassung.

**Deaktivierung**: Das reversible Stilllegen eines Bereichs oder Studiengangs für eine geordnete Auslaufphase.

## Nutzende und Berechtigungen

**Internes Konto**: Die anbieterunabhängige fachliche Identität einer internen Person mit unveränderlicher interner ID. Es kann fachliche Rollen und/oder Systemadministration tragen; sein Bestand hängt nicht vom jeweils verwendeten Anmeldeverfahren ab.

**Passwortvergabe ausstehend**: Der Zustand eines internen Kontos, das noch kein gültiges lokales Passwort besitzt. Die Person kann über einen ausgegebenen Passwortlink ein Passwort setzen.

**Passwortlink**: Ein systemseitig erzeugter, einmal verwendbarer und zeitlich begrenzter Link, über den eine interne Person ein lokales Passwort setzt. Er dient sowohl dem erstmaligen Zugang als auch dem Zurücksetzen eines vergessenen Passworts.
_Avoid_: Aktivierungslink, Reset-Link, Anmeldelink

**Aktives internes Konto**: Ein internes Konto mit freigegebenem Zugang, das sich über das aktuell vorgesehene Anmeldeverfahren anmelden kann.

**Gesperrtes internes Konto**: Ein internes Konto, dessen Zugang die Systemadministration gesperrt hat. Seine fachlichen Zuordnungen und seine Identität in der Auditspur bleiben erhalten.
_Avoid_: Deaktiviertes Konto, anonymisiertes Konto

**Studiengangsmanagement**: Die fachliche Rolle für die laufende Kurs- und Entwurfsbearbeitung in zugeordneten Bereichen.

**Studiengangsleitung**: Die fachliche Rolle, die in zugeordneten Bereichen zusätzlich löschen, veröffentlichen und Veröffentlichungen zurücknehmen darf.

**Systemadministration**: Die globale Berechtigung für fachliche Superuser-Aufgaben, Stammdaten, Konten und die vollständige Auditspur.

**Externe Nutzende**: Nicht angemeldete oder nicht intern berechtigte Personen, die ausschließlich veröffentlichte Fassungen lesen.

**Auditspur**: Die nur ergänzbare interne Folge fachlicher und administrativer Ereignisse. Sie ist kein Revisionsarchiv der einzelnen Entwurfsänderungen.
