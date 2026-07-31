# Fachliche Regeln

Die kanonischen Begriffe stehen im [`CONTEXT.md`](../CONTEXT.md). Dieses Dokument definiert die verbindlichen Invarianten, Lebenszyklen und Berechtigungen des MVP.

Planungs- und Veröffentlichungseinheit ist der Kurs; „Blockplan“ bezeichnet die veröffentlichte Darstellung eines oder mehrerer Kurse in einem gewählten Zuschnitt und ist keine eigene Entitätsart (siehe [ADR 0010](adr/0010-kurs-als-planungs-und-veroeffentlichungseinheit.md)).

## Regelklassen

**Strukturregeln** gelten bei jedem Schreibvorgang. Ein Verstoß wird nicht gespeichert.

**Veröffentlichungsregeln** gelten beim Veröffentlichen und nach jeder Änderung eines veröffentlichten Kurses. Ein nicht veröffentlichter Kurs darf sie vorübergehend verletzen.

Die Regeln im Abschnitt [Veröffentlichungsprüfung](#veröffentlichungsprüfung) sind Veröffentlichungsregeln. Alle übrigen Datenregeln sind Strukturregeln, soweit sie nicht ausdrücklich einen Lebenszyklus oder eine Berechtigung beschreiben.

## Textnormalisierung und Eindeutigkeit

- Texte werden an beiden Rändern getrimmt. Pflichttexte dürfen danach nicht leer sein; leere optionale Texte werden als nicht angegeben behandelt.
- Bei menschlichen Bezeichnungen werden aufeinanderfolgende Leerzeichen für den Anzeigewert auf eines reduziert.
- Bereichsbezeichnungen, Studiengangskürzel und Kurskennungen sind ohne Beachtung der Groß-/Kleinschreibung systemweit eindeutig.
- Dienstliche E-Mail-Adressen müssen syntaktisch gültig sein, werden getrimmt und kleingeschrieben und sind systemweit eindeutig. Sie enthalten weder Leerzeichen noch ASCII-Whitespace-Steuerzeichen; die Datenbank sichert dies zusätzlich gegen direkte Schreibzugriffe ab. Das MVP beschränkt sie nicht auf eine bestimmte Domain.
- Passwörter werden weder getrimmt noch normalisiert.

Nach der Normalisierung gelten folgende Höchstlängen in Unicode-Codepoints:

| Angabe                     | Höchstlänge |
| -------------------------- | ----------: |
| Bereichsbezeichnung        |         120 |
| Studiengangsbezeichnung    |         160 |
| Studiengangskürzel         |          20 |
| Kurskennung                |          32 |
| Termintitel                |         160 |
| Terminbeschreibung         |       2.000 |
| Dienstliche E-Mail-Adresse |         254 |

Werte werden bei einer Überschreitung abgelehnt und niemals abgeschnitten.

## Bereich und Studiengang

### Bereich

- Ein Bereich besitzt eine unveränderliche systemische Identität und eine erforderliche Bezeichnung.
- Ein Bereich kann beliebig viele Studiengänge enthalten; jeder Studiengang gehört genau einem Bereich.
- Bereiche werden im MVP weder stillgelegt noch entfernt.

### Studiengang

- Ein Studiengang besitzt eine unveränderliche systemische Identität, eine erforderliche Bezeichnung, ein erforderliches Kürzel, genau einen Bereich und eine Anzahl Semester von 6 oder 7.
- Das systemweit eindeutige Kürzel adressiert öffentliche Studiengangszuschnitte und ist der URL-Wert des Studiengangsfilters. Die Bezeichnung bleibt der sprechende Anzeigename und muss deshalb nicht eindeutig sein.
- Bezeichnung und Kürzel dürfen durch eine versionierte Datenmigration geändert werden. Bereich und Anzahl Semester dürfen dabei nur geändert werden, solange noch kein Kurs vom Studiengang abhängt.
- Eine spätere Korrektur von Bereich oder Semesterzahl bei bestehenden Kursen erfordert eine gesonderte, außerhalb der Anwendung dokumentierte Datenmigration.
- Studiengänge werden im MVP weder stillgelegt noch entfernt.

## Kurs

### Angaben

- Ein Kurs besitzt eine unveränderliche systemische Identität sowie Kurskennung, Studiengang, Studienbeginn und Studienende als Pflichtangaben.
- Studienbeginn und Studienende sind gültige gregorianische Kalendertage im Format `YYYY-MM-DD`; der Studienbeginn liegt vor dem Studienende.
- Der Jahrgang ist das Kalenderjahr des Studienbeginns und wird nicht gesondert gespeichert.
- Der verwaltende Bereich ist der Bereich des Studiengangs und wird nicht gesondert am Kurs gespeichert.
- Die Anzahl Semester ist die des Studiengangs und wird nicht gesondert am Kurs gespeichert.
- Die Kurskennung hat kein erzwungenes Format und ist keine Datenquelle für den Jahrgang.

Ein Kurs besitzt genau einen aktuellen Datenstand aus Kursangaben, Kursverlauf und prüfungsrelevanten Terminen. Ein optionaler Veröffentlichungszeitpunkt entscheidet, ob externe Nutzende diesen Stand sehen. Außerdem führt der Kurs Zeitpunkt und internes Konto seiner letzten Änderung.

Als Änderung gelten Änderungen an den vier Kursangaben, am Kursverlauf und an den prüfungsrelevanten Terminen. Veröffentlichen und Zurücknehmen verändern diese Angaben nicht.

### Änderbarkeit

Ein Kurs ist jederzeit in allen vier Angaben änderbar, auch nach einer Veröffentlichung. Dabei gilt:

- Der geänderte Studienzeitraum muss weiterhin alle erfassten Kursphasen des Kurses umfassen. Eine Änderung, die eine Kursphase aus dem Studienzeitraum fallen ließe, wird abgelehnt; die betroffenen Kursphasen sind zuerst anzupassen.
- Ein geänderter Studiengang muss mindestens so viele Semester besitzen, wie die höchste erfasste Kursphase des Kurses verlangt. Andernfalls wird die Änderung abgelehnt.

Änderungen an einem veröffentlichten Kurs werden vor dem Speichern mit ihrer öffentlichen Wirkung angezeigt und müssen ausdrücklich bestätigt werden. Nach erfolgreicher Gesamtprüfung wirken sie unmittelbar öffentlich.

### Löschung

- Ein veröffentlichter Kurs wird nicht gelöscht. Die Löschung wird abgelehnt, solange sein Veröffentlichungszeitpunkt gesetzt ist; nach einer Zurücknahme ist er löschbar.
- Beim Löschen entfallen sein Kursverlauf und seine prüfungsrelevanten Termine mit ihm.
- Ohne die Sperre könnte öffentlich Sichtbares durch eine Stammdatenlöschung verschwinden. Zurücknehmen bleibt der einzige und stets ausdrückliche Weg, eine Veröffentlichung zu beenden.
- Nach der Löschung ist die Kurskennung wieder frei.

### Anlagewege

Ein Kurs entsteht auf genau einem von zwei Wegen: als Übernahme aus einer Vorlage oder mit einem erzeugten Kursverlauf. Der Weg wird vor der Erfassung gewählt; die beiden Wege werden nicht vermischt und teilen keine Angaben. Ein Kurs ohne Kursverlauf entsteht auf keinem der beiden Wege — der Kursverlauf ist danach wie jede andere Angabe einzeln bearbeitbar und löschbar.

### Anlage aus einer Vorlage

Ein Kurs kann als Übernahme aus einer Vorlage angelegt werden. Vorlage darf jeder bestehende Kurs sein, unabhängig von Bereich und Studiengang.

- Kurskennung, Studiengang und Studienbeginn werden für den neuen Kurs erfasst. Das Studienende wird aus der Dauer des Studienzeitraums der Vorlage vorgeschlagen und ist änderbar.
- Der Studiengang des neuen Kurses muss dieselbe Anzahl Semester besitzen wie der Studiengang der Vorlage.
- Übernommen werden wahlweise der Kursverlauf, die prüfungsrelevanten Termine oder beides.
- Alle übernommenen Kalendertage werden um dieselbe Verschiebung versetzt: die Differenz der beiden Studienbeginne, gerundet auf das nächste Vielfache von sieben Tagen. Innerhalb desselben Jahrgangs mit gleichem Studienbeginn ist die Verschiebung null.
- Die Rundung erhält die Wochentage. Sie ist nötig, weil der Studienzeitraum datumsverankert ist — 1. Oktober bis 30. September —, Kursphasen aber wochenverankert sind. Eine tagesgenaue Verschiebung träfe die Ränder des Studienzeitraums und verschöbe jede Phasengrenze auf einen anderen Wochentag.
- Ragt eine übernommene Kursphase über den Studienzeitraum des neuen Kurses hinaus, wird sie auf dessen Grenze gekürzt. Verbleibende Lücken an den Rändern werden nicht automatisch geschlossen; die Veröffentlichungsprüfung benennt sie.
- Übernommene Termine werden nicht gekürzt. Liegt einer außerhalb des Studienzeitraums, ist das eine Veröffentlichungsregel und im Planungsstand vorübergehend zulässig.
- Der neue Kurs ist danach vollständig eigenständig. Zwischen ihm und der Vorlage besteht keine Verbindung, kein Abgleich und keine gemeinsame Änderung.

Die Übernahme gibt es ausschließlich bei der Anlage. Übernehmen in einen bestehenden Kurs ist nicht vorgesehen.

### Anlage mit erzeugtem Kursverlauf

Ein Kurs kann stattdessen mit einem erzeugten Kursverlauf angelegt werden. Erfasst werden Kurskennung, Studiengang, Studienzeitraum und die Startphase; alles Weitere errechnet sich daraus.

**Vorbelegung des Studienzeitraums.** Beide Angaben sind Vorschläge und bleiben änderbar.

- Der Studienbeginn ist der 1. Oktober des Jahrgangs, den die Kurskennung nennt, sonst der nächste 1. Oktober ab dem heutigen Kalendertag. Eine vierstellige Jahreszahl in der Kurskennung gilt unmittelbar; eine zweistellige gilt als Jahr des laufenden Jahrhunderts, solange sie höchstens zehn Jahre vom laufenden Jahr entfernt liegt.
- Das Studienende ist sechs Monate je Semester nach dem Studienbeginn, endend am Vortag: bei 6 Semestern der 30. September drei Jahre später, bei 7 Semestern der 31. März dreieinhalb Jahre später.

**Erzeugter Kursverlauf.** Er umfasst zwei Kursphasen je Semester; Theorie und Praxis wechseln ab der gewählten Startphase mit jeder Kursphase.

- Die Kursphasen decken den Studienzeitraum lückenlos und überschneidungsfrei ab. Grundlage sind Quartale ab dem Studienbeginn; passt der Studienzeitraum nicht ins Quartalsraster, wird er gleichmäßig auf die Kursphasen aufgeteilt.
- Jede Phasengrenze innerhalb des Studienzeitraums fällt auf einen Sonntag, die folgende Kursphase beginnt am Montag. Studienbeginn und Studienende bleiben unverändert, weil der Studienzeitraum datumsverankert ist.
- Am Jahreswechsel entscheidet der Kalender statt des Quartals: eine Theoriephase endet am Sonntag vor dem 24. Dezember, eine Praxisphase endet am Sonntag am oder nach dem 6. Januar. Die Weihnachtstage liegen damit stets in einer Praxisphase.
- Ist der Studienzeitraum zu kurz für zwei Kursphasen je Semester, entsteht kein Kursverlauf und der Kurs wird nicht angelegt.

**Anpassung vor dem Speichern.** Die erzeugten Kursphasen sind einzeln in Phasentyp, Semester und Grenzen änderbar. Eine verschobene Grenze verschiebt die angrenzende Kursphase mit, damit der Kursverlauf lückenlos bleibt; eine Grenze, die eine benachbarte Kursphase vollständig verdrängen würde, wird abgelehnt. Studienbeginn und Studienende gehören zum Studienzeitraum und werden dort geändert. Jede Änderung an Studienzeitraum, Studiengang oder Startphase erzeugt den Kursverlauf neu und verwirft eigene Anpassungen.

**Prüfung beim Speichern.** Der gespeicherte Kursverlauf beginnt am Studienbeginn, endet am Studienende, schließt lückenlos und überschneidungsfrei an, hält die Semester entlang der Zeitachse monoton nicht fallend und verwendet ausschließlich Semester von 1 bis zur Anzahl Semester des Studiengangs. Anlage und Kursverlauf bilden dieselbe Transaktion.

### Veröffentlichungszustand

Der Veröffentlichungszustand eines Kurses ist genau **nicht veröffentlicht** oder **veröffentlicht**. Ob ein nicht veröffentlichter Kurs früher bereits veröffentlicht war, wird nicht gespeichert. Sein Planungsstand bleibt bei einer Zurücknahme erhalten.

## Planungsstand und Bearbeitung

- Der Planungsstand ist für die Bereichsbearbeitung aller Bereiche und die Systemadministration lesbar, aber nur für die Bereichsbearbeitung seines eigenen Bereichs und die Systemadministration bearbeitbar (siehe [ADR 0011](adr/0011-systemweite-leseeinsicht-in-kurse.md)).
- Änderungen an einem nicht veröffentlichten Kurs dürfen unvollständige Zwischenstände erzeugen. Änderungen an einem veröffentlichten Kurs müssen nach Vorschau und Bestätigung sämtliche Veröffentlichungsregeln weiterhin erfüllen und werden unmittelbar öffentlich sichtbar.

Normale, granulare Speicheraktionen verwenden Last-write-wins und besitzen keine Konfliktwarnung. Sie prüfen Berechtigung, Existenz, Strukturregeln und weitere Zustandsvoraussetzungen stets gegen den aktuellen Stand.

### Keine Gleichheitsregel zwischen Kursen

Keine Invariante verlangt, dass Kursphasen oder Termine verschiedener Kurse übereinstimmen. Abweichungen sind zulässig und häufig beabsichtigt — etwa wenn ein Studiengang eine Prüfungsform kennt, die ein anderer nicht kennt. Übereinstimmung wird deshalb angezeigt und nicht erzwungen; die Zusammenfassung übereinstimmender Angaben in einer Gegenüberstellung ist eine Anzeigeregel und steht in [`MVP-SPEZIFIKATION.md`](MVP-SPEZIFIKATION.md).

## Veröffentlichung und Zurücknahme

- Veröffentlichen und Zurücknehmen sind ein Vorgang je Kurs. Eine Sammelfreigabe über mehrere Kurse gibt es nicht.
- Veröffentlichen prüft alle Struktur- und Veröffentlichungsregeln des Kurses und setzt atomar seinen Veröffentlichungszeitpunkt.
- Öffentliche Ansichten und die öffentliche API lesen die aktuellen Kursangaben, Kursphasen und Termine veröffentlichter Kurse. Es gibt keine Kopie und keine Revisionshistorie.
- Eine Zurücknahme entfernt atomar den Veröffentlichungszeitpunkt und damit den Kurs aus allen öffentlichen Ansichten. Seine Daten bleiben bestehen.
- Eine erneute Veröffentlichung prüft denselben aktuellen Datenstand und setzt einen neuen Veröffentlichungszeitpunkt.
- Änderungen an veröffentlichten Kursangaben und Terminen zeigen vor dem Speichern eine Vorschau mit ihrer öffentlichen Wirkung und verlangen eine Bestätigung.
- Beim Verschieben einer Grenze einer veröffentlichten Kursphase wird die angrenzende Phase in derselben Transaktion angepasst. Der vollständige resultierende Kurs wird geprüft, bevor die Änderung öffentlich sichtbar werden kann.
- Einzelne Kursphasen können einem veröffentlichten Verlauf nicht hinzugefügt oder aus ihm gelöscht werden. Dafür wird der Kurs zuerst zurückgenommen.

Ein vollständig geplanter Kurs wird unabhängig von allen anderen Kursen veröffentlicht. Dass ein Jahrgang oder ein Bereich zu einem Zeitpunkt nur teilweise öffentlich ist, ist ein zulässiger und beabsichtigter Zustand.

## Kursverlauf

- Eine Kursphase gehört genau einem Kurs. Sie besitzt Startdatum, Enddatum, Semester und Phasentyp.
- Start- und Enddatum sind gültige gregorianische Kalendertage im Format `YYYY-MM-DD`; das Startdatum liegt vor oder auf dem Enddatum.
- Eine Kursphase liegt vollständig innerhalb des Studienzeitraums ihres Kurses.
- Das Semester ist eine ganze Zahl von 1 bis zur Anzahl Semester des Studiengangs ihres Kurses.
- Der Phasentyp ist genau `Theorie` oder `Praxis`.
- Gleichartige Kursphasen dürfen unmittelbar aufeinander folgen.
- Eine gemeinsame Anlage für mehrere ausgewählte Kurse erzeugt für jeden Kurs eine eigenständige Kursphase mit zunächst gleichen Angaben und setzt Schreibrechte für jeden ausgewählten Kurs voraus. Zwischen diesen Kursphasen besteht danach keine gemeinsame Identität; spätere Änderungen wirken nur auf die jeweils bearbeitete Kursphase (siehe [ADR 0006](adr/0006-kursphasen-ohne-gemeinsame-identitaet.md)).
- Die zeitlichen Grenzen desselben Semesters dürfen zwischen Kursen voneinander abweichen.

### Semester

Das Studienjahr wird aus dem Semester abgeleitet: Semester 1 und 2 bilden Studienjahr 1, Semester 3 und 4 Studienjahr 2, Semester 5 und 6 Studienjahr 3 und Semester 7 das halbe Studienjahr 4.

## Prüfungsrelevanter Termin

- Ein Termin gehört genau einem Kurs. Er besitzt Titel, optionale Beschreibung, Kategorie, Zeitangabe und ein binäres Merkmal „vorläufig“.
- Die Kategorie ist genau `Anmeldung`, `Abgabe`, `Präsentation`, `Prüfung` oder `Sonstiges`.
- Eine gemeinsame Anlage für mehrere ausgewählte Kurse erzeugt je Kurs einen eigenständigen Termin mit zunächst gleichen Angaben und setzt ebenfalls Schreibrechte für jeden ausgewählten Kurs voraus. Auch zwischen diesen Terminen besteht danach keine gemeinsame Identität.

Die Zeitangabe besteht aus einem erforderlichen Startdatum und einem optionalen Enddatum. Beide sind gültige gregorianische Kalendertage im Format `YYYY-MM-DD`; ein angegebenes Enddatum liegt auf oder nach dem Startdatum. Ohne Enddatum bezeichnet der Termin genau den Starttag, andernfalls den beidseitig inklusiven Datumsbereich. Kalendertage sind zeitzonenlos. Das Merkmal „vorläufig“ sagt aus, dass die Zeitangabe noch nicht verbindlich ist; ein vorläufiger Termin ist gültig und veröffentlichbar und wird überall textlich als vorläufig gekennzeichnet. Einen eigenen Bestätigungsablauf oder weitere Stufen gibt es nicht.

Ein Termin trägt weder ein eigenes Semester noch eine eigene Kursphase. Sein Semester wird aus der Kursphase abgeleitet, die sein Startdatum abdeckt. Fehlt eine solche Kursphase im noch unvollständigen Planungsstand, ist das Semester dort vorübergehend nicht ableitbar; die Oberfläche benennt dies ausdrücklich. Ein Termin über einen Semesterwechsel gehört zum Semester seines Beginns. Bei einem veröffentlichten Kurs ist das Semester aufgrund der Veröffentlichungsprüfung stets ableitbar.

## Veröffentlichungsprüfung

Ein Kurs ist nur veröffentlichbar, wenn zusätzlich folgende Regeln erfüllt sind:

- Sein Kursverlauf ist vollständig: Die Kursphasen decken jeden Kalendertag seines einschließlich beider Grenztage geltenden Studienzeitraums genau einmal ab.
- Die Kursphasen schließen lückenlos aneinander an und überlappen sich nicht.
- Die Semester sind entlang der Zeitachse monoton nicht fallend.
- Jedes Semester von 1 bis zur Anzahl Semester seines Studiengangs kommt mindestens einmal vor; alle Kursphasen eines Semesters bilden einen zusammenhängenden Abschnitt.
- Jeder Termin liegt vollständig innerhalb des Studienzeitraums.

## Interne Konten

### Zustände

Ein internes Konto befindet sich genau in einem Zustand:

- **Passwortvergabe ausstehend**: Konto, Berechtigungen und Bereiche bestehen, aber es besitzt kein gültiges lokales Passwort; eine Anmeldung ist nicht möglich.
- **Aktiv**: Das Konto besitzt ein gültiges lokales Passwort und kann sich anmelden.
- **Gesperrt**: Die Anmeldung ist gesperrt. Fachliche Zuordnungen bleiben erhalten.

Ein neues Konto wartet auf die Passwortvergabe. Ein Passwortlink ist zufällig, einmal verwendbar, serverseitig nur gehasht gespeichert und sieben Tage gültig. Er kann ausschließlich für ein Konto mit ausstehender Passwortvergabe erzeugt werden; eine Neuausstellung macht einen vorherigen Passwortlink dieses Kontos ungültig. Ein lokales Passwort muss 15 bis 128 Zeichen lang sein und mindestens einen Großbuchstaben, eine Ziffer sowie ein Sonderzeichen aus der folgenden Menge enthalten:

```
!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~
```

Das erfolgreiche Setzen eines Passworts versetzt das Konto in den aktiven Zustand.

Setzt die Systemadministration das Passwort eines aktiven Kontos zurück, werden das bisherige Passwort und alle Sitzungen sofort ungültig, das Konto wartet wieder auf die Passwortvergabe und ein neuer Passwortlink wird ausgegeben. Mitarbeitende können ein vergessenes Passwort nicht selbst zurücksetzen.

Eine Person mit aktivem internem Konto darf ihr Passwort nach Eingabe des bisherigen Passworts selbst ändern. Das neue Passwort gilt sofort; andere Sitzungen dieses Kontos werden beendet, die aktuelle Sitzung bleibt bestehen.

Eine Sperrung entfernt Passwort, Sitzungen und offene Passwortlinks. Die Freigabe eines gesperrten Kontos führt zur ausstehenden Passwortvergabe und gibt einen neuen Passwortlink aus. Gesperrte Konten werden im MVP weder automatisch anonymisiert noch gelöscht.

Ändert die Systemadministration die E-Mail-Adresse, bleiben Kontozustand, Passwort, Sitzungen und offene Passwortlinks unverändert. Die Änderung dient ausschließlich der Korrektur oder Aktualisierung der Anmeldeadresse derselben Person; ein internes Konto darf nicht auf eine andere Person übertragen werden.

### Rollen und gültige Kombinationen

- Ein internes Konto trägt entweder die fachliche Rolle Bereichsbearbeitung oder keine fachliche Rolle.
- Die fachliche Rolle gilt einheitlich in allen zugeordneten Bereichen und setzt mindestens einen Bereich voraus.
- Unabhängig davon kann das Konto Systemadministration besitzen.
- Ein reines Systemadministrationskonto benötigt weder fachliche Rolle noch Bereich.
- Jedes interne Konto besitzt mindestens eine fachliche Rolle oder Systemadministration.
- Rolle, Systemadministration und Bereichszuordnungen werden bei jeder Änderung gemeinsam validiert.
- Nach der ersten Passwortvergabe des initialen Systemadministrationskontos muss jede Änderung über die Anwendung mindestens ein aktives Systemadministrationskonto erhalten. Der ausschließlich im Anwendungscontainer verfügbare Notfall-Reset des letzten Systemadministrationskontos ist die einzige Ausnahme und darf dieses Konto vorübergehend auf „Passwortvergabe ausstehend“ setzen.

### Berechtigungen

Die **Bereichsbearbeitung** darf in ihren Bereichen:

- Kurse anlegen, auch als Übernahme aus einer Vorlage;
- Kursangaben, Kursverlauf und prüfungsrelevante Termine bearbeiten;
- nicht veröffentlichte Kurse löschen;
- Kurse veröffentlichen und Veröffentlichungen zurücknehmen.

Darüber hinaus darf sie **Kurse aller Bereiche einschließlich ihrer Planungsstände lesen** und als Vorlage einer Übernahme verwenden. Schreibende Vorgänge bleiben auf die zugeordneten Bereiche beschränkt; maßgeblich ist der Bereich des Studiengangs des jeweiligen Kurses (siehe [ADR 0011](adr/0011-systemweite-leseeinsicht-in-kurse.md)).

Die **Systemadministration** besitzt die Rechte der Bereichsbearbeitung in allen Bereichen und darf zusätzlich:

- interne Konten anlegen, E-Mail-Adressen, Rollen und Bereichszuordnungen ändern, Passwortlinks ausstellen sowie Konten sperren und freigeben.

Externe Nutzende dürfen ausschließlich veröffentlichte Kurse einsehen.
