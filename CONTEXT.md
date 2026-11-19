# Studienbetrieb

Dieses Glossar legt die kanonische Sprache für die Planung und Veröffentlichung der Blockpläne sowie die lesende Ansicht der Vorlesungskalender fest. Der aktuelle fachliche Ist-Stand wird durch Code, Datenbankschema und Tests bestimmt; Gründe für grundlegende Entscheidungen stehen in den [`ADR`](docs/adr/).

## Planung

**Bereich**: Die organisatorische Einheit, für die interne Mitarbeitende Kurse verwalten. Ein Studienzentrum ist eine örtliche Bezeichnung für einen Bereich, keine eigene Entitätsart.
_Avoid_: Studienzentrum als eigener Modellbegriff

**Studiengang**: Ein Studienangebot innerhalb eines Bereichs, beispielsweise Informatik oder Wirtschaftsinformatik.

**Jahrgang**: Das Kalenderjahr, in dem ein Kurs sein Studium beginnt.

**Kurs**: Eine Gruppe von Studierenden eines Studiengangs und Jahrgangs, die vom Studienbeginn bis zum Studienende zusammenbleibt. Der Kurs trägt seine Planangaben selbst und ist zugleich die Einheit, die veröffentlicht wird.
_Avoid_: Kohorte

**Studienzeitraum**: Der einschließlich beider Grenztage geltende Zeitraum vom Studienbeginn bis zum Studienende eines Kurses.

**Planungsstand**: Die aktuellen Planangaben eines Kurses, also sein Kursverlauf und seine prüfungsrelevanten Termine. Bei einem veröffentlichten Kurs sind sie zugleich der öffentlich sichtbare Stand.
_Avoid_: Entwurf, Arbeitsstand, veröffentlichte Fassung

**Öffentlich sichtbarer Kurs**: Ein Kurs mit gesetztem Veröffentlichungszeitpunkt. Externe Nutzende sehen seine aktuellen Angaben, Kursphasen und Termine.

**Nicht veröffentlichter Kurs**: Ein Kurs ohne Veröffentlichungszeitpunkt. Er darf unvollständig sein und ist in allen internen Ansichten textlich so benannt. Ein zweiter Name für denselben Zustand existiert nicht.
_Avoid_: Kurs in Arbeit, Entwurfszustand, Arbeitsstand

**Offener Punkt**: Eine Veröffentlichungsregel, die der Planungsstand eines Kurses zurzeit verletzt. Offene Punkte werden dort genannt, wo sie wirken: bei der Veröffentlichung, die sie verhindern.
_Avoid_: Fehler, Warnung, Vollständigkeitsbericht

**Übernahme**: Die Anlage eines Kurses, dessen Kursverlauf und Termine aus einer Vorlage kopiert und dabei um ganze Wochen verschoben werden.
_Avoid_: Klonen, Synchronisieren

**Vorlage**: Der bestehende Kurs, aus dem eine Übernahme kopiert. Zwischen ihm und dem neuen Kurs besteht danach keine Verbindung.

**Erzeugter Kursverlauf**: Der zweite Anlageweg neben der Übernahme: Der Kursverlauf des neuen Kurses entsteht aus Studienzeitraum und Startphase, ohne Vorlage. Er ist vor dem Speichern vollständig sichtbar und änderbar.
_Avoid_: Automatik, Generator

**Startphase**: Der Phasentyp der ersten Kursphase eines Kurses. Er entscheidet beim erzeugten Kursverlauf über den Wechsel aller folgenden Kursphasen.

## Verlauf

**Kursverlauf**: Die Gesamtheit der Kursphasen eines Kurses vom Studienbeginn bis zum Studienende.
_Avoid_: Blockplan eines Kurses

**Phasentyp**: Die Art eines Studienabschnitts: Theorie an der Hochschule oder Praxis im Dualen Partnerunternehmen.

**Kursphase**: Ein Zeitblock im Kursverlauf genau eines Kurses mit Zeitraum, Semester und Phasentyp. Inhaltlich gleiche Kursphasen verschiedener Kurse bleiben voneinander unabhängig.
_Avoid_: Blockphase, Phase, Urlaubsphase

**Semester**: Die fortlaufende Studienperiode einer Kursphase, beginnend mit Semester 1.

**Wechsel**: Der Tag, an dem ein Kurs von einer Kursphase in die unmittelbar anschließende übergeht — der erste Tag der folgenden Kursphase. Er ist eine Angabe, die zwei Kursphasen gemeinsam tragen, und wird als diese eine Angabe verschoben.
_Avoid_: Phasengrenze, Start- und Enddatum getrennt verschieben

**Prüfungsrelevanter Termin**: Eine Planangabe genau eines Kurses mit Titel, Kategorie und einem Startdatum sowie optionalem Enddatum, beispielsweise Anmeldung, Abgabe, Präsentation oder Prüfung. Er kann als vorläufig gekennzeichnet sein, solange seine Zeitangabe noch nicht verbindlich ist.

**Kalendertag**: Ein zeitzonenloses Datum im gregorianischen Kalender.

## Vorlesungskalender

**Vorlesungskalender**: Die aktuelle, ausschließlich gelesene Darstellung der von der DHBW für genau einen Kurs bereitgestellten Lehrveranstaltungen. Er gehört weder zum Planungsstand noch zum Veröffentlichungszustand des Kurses.
_Avoid_: Stundenplan, veröffentlichter Kalender

**Kalendertermin**: Eine aus dem Vorlesungskalender gelesene Lehrveranstaltung mit Zeitraum und optionalem Ort und Beschreibung. Er ist keine gespeicherte Planangabe und insbesondere kein prüfungsrelevanter Termin.
_Avoid_: Termin ohne nähere Bestimmung, prüfungsrelevanter Termin

## Darstellung

**Blockplan**: Die veröffentlichte Darstellung von Kursverlauf und Terminen der Kurse eines Zuschnitts. Ein Blockplan ist ein Erzeugnis, keine eigene Entitätsart; seine Daten trägt immer der Kurs.
_Avoid_: Blockplan als eigenständiges Planungs- oder Veröffentlichungsobjekt

**Zuschnitt**: Die Auswahl von Kursen genau eines Jahrgangs, über die eine öffentliche Ansicht — ein Blockplan — gebildet und adressiert wird: ein einzelner Kurs, der ganze Jahrgang oder ein Studiengang beziehungsweise ein Bereich darin.
_Avoid_: Zuschnitt über mehrere Jahrgänge, Zuschnitt als interner Bearbeitungsgegenstand

**Vergleich**: Die interne Ansicht eines Kurses, die ihn nur lesend neben die Kurse desselben Jahrgangs stellt. Ihr Umfang — Studiengang, Bereich oder ganzer Jahrgang — wird bei jedem Aufruf gewählt und nicht gespeichert; bearbeitet wird ausschließlich im Planungsstand des jeweiligen Kurses, der von seinen Parallelkursen nur die Abweichungen nennt.
_Avoid_: gemeinsame Bearbeitung mehrerer Kurse, interner Zuschnitt

**Übertragung**: Das gleichzeitige Anlegen derselben Kursphase oder desselben Termins beim bearbeiteten Kurs und bei ausgewählten Kursen seines Vergleichs. Es entstehen eigenständige Angaben je Kurs; spätere Änderungen wirken nur auf den jeweiligen Kurs.
_Avoid_: geteilte Kursphase, gemeinsamer Termin, Synchronisation

**Gegenüberstellung**: Eine Darstellung mehrerer Kurse nebeneinander, in der übereinstimmende Kursphasen und Termine zu einer Zeile zusammengefasst werden und jede Abweichung sie auftrennt.
_Avoid_: Abgleich, Konfliktprüfung, Synchronisationswarnung

## Regeln und Lebenszyklen

**Strukturregel**: Eine Invariante, die bei jedem Schreibvorgang gilt.

**Veröffentlichungsregel**: Eine zusätzliche Invariante, die beim Veröffentlichen und nach jeder Änderung eines veröffentlichten Kurses gelten muss.

## Nutzende und Berechtigungen

**Internes Konto**: Die anbieterunabhängige fachliche Identität einer internen Person mit unveränderlicher interner ID. Es kann Bereichsbearbeitung und/oder Systemadministration tragen; sein Bestand hängt nicht vom jeweils verwendeten Anmeldeverfahren ab.

**Passwortvergabe ausstehend**: Der Zustand eines internen Kontos, das noch kein gültiges lokales Passwort besitzt. Die Person kann über einen ausgegebenen Passwortlink ein Passwort setzen.

**Passwortlink**: Ein systemseitig erzeugter, einmal verwendbarer und zeitlich begrenzter Link, über den eine interne Person ein lokales Passwort setzt. Er dient sowohl dem erstmaligen Zugang als auch dem Zurücksetzen eines vergessenen Passworts.
_Avoid_: Aktivierungslink, Reset-Link, Anmeldelink

**Aktives internes Konto**: Ein internes Konto mit freigegebenem Zugang, das sich über das aktuell vorgesehene Anmeldeverfahren anmelden kann.

**Gesperrtes internes Konto**: Ein internes Konto, dessen Zugang die Systemadministration gesperrt hat. Seine fachlichen Zuordnungen bleiben erhalten.
_Avoid_: Deaktiviertes Konto, anonymisiertes Konto

**Bereichsbearbeitung**: Die fachliche Rolle für Anlage, Planung, Löschung, Veröffentlichung und Zurücknahme von Kursen in zugeordneten Bereichen. Kurse aller Bereiche sind für sie lesbar.

**Systemadministration**: Die globale Berechtigung für fachliche Superuser-Aufgaben und die Verwaltung interner Konten.

**Externe Nutzende**: Nicht angemeldete oder nicht intern berechtigte Personen, die ausschließlich veröffentlichte Kurse lesen.
