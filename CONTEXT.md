# Blockplanverwaltung

Dieses Glossar legt die kanonische Sprache für die Verwaltung und Veröffentlichung der Blockpläne fest. Verbindliche Invarianten, Lebenszyklen und Rechte stehen in [`docs/FACHLICHE_REGELN.md`](docs/FACHLICHE_REGELN.md).

## Planung

**Bereich**: Die organisatorische Einheit, für die interne Mitarbeitende Kurse und Blockpläne verwalten. Ein Studienzentrum ist eine örtliche Bezeichnung für einen Bereich, keine eigene Entitätsart.
_Avoid_: Studienzentrum als eigener Modellbegriff

**Studiengang**: Ein Studienangebot innerhalb eines Bereichs, beispielsweise Informatik oder Wirtschaftsinformatik.

**Jahrgang**: Das Kalenderjahr, in dem ein Kurs sein Studium beginnt.

**Kurs**: Eine Gruppe von Studierenden eines Studiengangs und Jahrgangs, die vom Studienbeginn bis zum Studienende zusammenbleibt.
_Avoid_: Kohorte

**Öffentlich sichtbarer Kurs**: Ein Kurs, den die aktuell veröffentlichte Fassung seines Blockplans zeigt. Kurse tragen selbst keinen Veröffentlichungszustand.

**Studienzeitraum**: Der einschließlich beider Grenztage geltende Zeitraum vom Studienbeginn bis zum Studienende eines Kurses.

**Blockplan**: Die gemeinsam verwaltete und veröffentlichte Planungseinheit für Theorie- und Praxisphasen sowie prüfungsrelevante Termine eines oder mehrerer Kurse desselben Jahrgangs. Ein Blockplan ist strukturierte Anwendungsinformation, kein Dokument.

**Entwurf**: Die intern bearbeitbare Fassung eines Blockplans.

**Veröffentlichte Fassung**: Die bewusst freigegebene Fassung eines Blockplans, die externe Nutzende sehen.

**Zurückgenommene Veröffentlichung**: Der Zustand eines zuvor veröffentlichten Blockplans, dessen öffentliche Fassung entfernt wurde. Der Entwurf bleibt bestehen und kann erneut veröffentlicht werden.

## Verlauf

**Phasentyp**: Die Art eines Studienabschnitts: Theorie an der Hochschule oder Praxis im Dualen Partnerunternehmen.

**Kursphase**: Ein Zeitblock im Verlauf genau eines Kurses mit Zeitraum, Semester und Phasentyp. Inhaltlich gleiche Kursphasen verschiedener Kurse bleiben voneinander unabhängig.
_Avoid_: Blockphase, Phase, Urlaubsphase

**Semester**: Die fortlaufende Studienperiode einer Kursphase, beginnend mit Semester 1.

**Prüfungsrelevanter Termin**: Eine Planangabe für mindestens einen Kurs mit Titel, Kategorie und einem Startdatum sowie optionalem Enddatum, beispielsweise Anmeldung, Abgabe, Präsentation oder Prüfung. Er kann als vorläufig gekennzeichnet sein, solange seine Zeitangabe noch nicht verbindlich ist.

**Kalendertag**: Ein zeitzonenloses Datum im gregorianischen Kalender.

## Regeln und Lebenszyklen

**Strukturregel**: Eine Invariante, die bei jedem Schreibvorgang gilt.

**Veröffentlichungsregel**: Eine zusätzliche Invariante für die Freigabe eines Entwurfs als veröffentlichte Fassung.

## Nutzende und Berechtigungen

**Internes Konto**: Die anbieterunabhängige fachliche Identität einer internen Person mit unveränderlicher interner ID. Es kann Bereichsbearbeitung und/oder Systemadministration tragen; sein Bestand hängt nicht vom jeweils verwendeten Anmeldeverfahren ab.

**Passwortvergabe ausstehend**: Der Zustand eines internen Kontos, das noch kein gültiges lokales Passwort besitzt. Die Person kann über einen ausgegebenen Passwortlink ein Passwort setzen.

**Passwortlink**: Ein systemseitig erzeugter, einmal verwendbarer und zeitlich begrenzter Link, über den eine interne Person ein lokales Passwort setzt. Er dient sowohl dem erstmaligen Zugang als auch dem Zurücksetzen eines vergessenen Passworts.
_Avoid_: Aktivierungslink, Reset-Link, Anmeldelink

**Aktives internes Konto**: Ein internes Konto mit freigegebenem Zugang, das sich über das aktuell vorgesehene Anmeldeverfahren anmelden kann.

**Gesperrtes internes Konto**: Ein internes Konto, dessen Zugang die Systemadministration gesperrt hat. Seine fachlichen Zuordnungen bleiben erhalten.
_Avoid_: Deaktiviertes Konto, anonymisiertes Konto

**Bereichsbearbeitung**: Die fachliche Rolle für Kurs- und Entwurfsbearbeitung, Löschung, Veröffentlichung und Zurücknahme in zugeordneten Bereichen.

**Systemadministration**: Die globale Berechtigung für fachliche Superuser-Aufgaben und die Verwaltung interner Konten.

**Externe Nutzende**: Nicht angemeldete oder nicht intern berechtigte Personen, die ausschließlich veröffentlichte Fassungen lesen.
