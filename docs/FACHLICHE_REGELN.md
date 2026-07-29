# Fachliche Regeln

Die kanonischen Begriffe stehen im [`CONTEXT.md`](../CONTEXT.md). Dieses Dokument definiert die verbindlichen Invarianten, Lebenszyklen und Berechtigungen des MVP.

Planungs- und Veröffentlichungseinheit ist der Kurs; „Blockplan“ bezeichnet die veröffentlichte Darstellung eines oder mehrerer Kurse in einem gewählten Zuschnitt und ist keine eigene Entitätsart (siehe [ADR 0010](adr/0010-kurs-als-planungs-und-veroeffentlichungseinheit.md)).

## Regelklassen

**Strukturregeln** gelten bei jedem Schreibvorgang. Ein Verstoß wird nicht gespeichert.

**Veröffentlichungsregeln** gelten zusätzlich beim Veröffentlichen eines Kurses. Ein Planungsstand darf sie vorübergehend verletzen.

Die Regeln im Abschnitt [Veröffentlichungsprüfung](#veröffentlichungsprüfung) sind Veröffentlichungsregeln. Alle übrigen Datenregeln sind Strukturregeln, soweit sie nicht ausdrücklich einen Lebenszyklus oder eine Berechtigung beschreiben.

## Textnormalisierung und Eindeutigkeit

- Texte werden an beiden Rändern getrimmt. Pflichttexte dürfen danach nicht leer sein; leere optionale Texte werden als nicht angegeben behandelt.
- Bei menschlichen Bezeichnungen werden aufeinanderfolgende Leerzeichen für den Anzeigewert auf eines reduziert.
- Bereichsbezeichnungen, Studiengangskürzel und Kurskennungen sind ohne Beachtung der Groß-/Kleinschreibung systemweit eindeutig.
- **Bereichsbezeichnungen, Studiengangsbezeichnungen und Studiengangskürzel sind zusätzlich gegen jeden Wert eindeutig, der in einer veröffentlichten Fassung vorkommt.** Eine Bezeichnung, die durch eine Umbenennung frei geworden ist, darf keiner anderen Entität derselben Art gegeben werden, solange noch eine veröffentlichte Fassung sie zeigt. Andernfalls fielen die Kurse zweier verschiedener Bereiche oder Studiengänge desselben Jahrgangs in denselben Zuschnitt, weil Zuschnitte und öffentliche Filter über die Bezeichnungen der Snapshots gebildet werden. Dieselbe Erwägung trägt die entsprechende Veröffentlichungsregel für Kurskennungen.
- Dienstliche E-Mail-Adressen müssen syntaktisch gültig sein, werden getrimmt und kleingeschrieben und sind systemweit eindeutig. Das MVP beschränkt sie nicht auf eine bestimmte Domain.
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
- Bezeichnung und Kürzel dürfen durch eine versionierte Datenmigration geändert werden. Bereich und Anzahl Semester dürfen dabei nur geändert werden, solange noch kein Kurs vom Studiengang abhängt.
- Eine Migration, die eine Bezeichnung oder ein Kürzel ändert, prüft die Reservierung historischer Bezeichner: Der neue Wert darf in keiner veröffentlichten Fassung vorkommen, und der freigewordene alte Wert bleibt gesperrt, solange eine veröffentlichte Fassung ihn zeigt. Weil das MVP für Bereiche und Studiengänge keinen Schreibweg über die Anwendung besitzt, liegt diese Prüfung bei der Migration und nicht in der Fachlogik.
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

Ein Kurs besitzt seinen Planungsstand aus Kursverlauf und prüfungsrelevanten Terminen sowie höchstens eine veröffentlichte Fassung. Er führt außerdem eine dauerhafte Markierung, ob er schon einmal veröffentlicht wurde, sowie Zeitpunkt und internes Konto seiner letzten Änderung.

Als Änderung gelten Änderungen an den vier Kursangaben, am Kursverlauf und an den prüfungsrelevanten Terminen. Veröffentlichen und Zurücknehmen verändern diese Angaben nicht.

### Änderbarkeit

Ein Kurs ist jederzeit in allen vier Angaben änderbar, auch nach einer Veröffentlichung. Dabei gilt:

- Der geänderte Studienzeitraum muss weiterhin alle erfassten Kursphasen des Kurses umfassen. Eine Änderung, die eine Kursphase aus dem Studienzeitraum fallen ließe, wird abgelehnt; die betroffenen Kursphasen sind zuerst anzupassen.
- Ein geänderter Studiengang muss mindestens so viele Semester besitzen, wie die höchste erfasste Kursphase des Kurses verlangt. Andernfalls wird die Änderung abgelehnt.

Änderungen an Kursangaben wirken öffentlich erst mit der nächsten Veröffentlichung; veröffentlichte Fassungen zeigen ausschließlich ihre eigenen Snapshots.

### Löschung

- Ein Kurs mit veröffentlichter Fassung wird nicht gelöscht. Die Löschung wird abgelehnt, solange seine Fassung besteht; nach einer Zurücknahme ist er löschbar.
- Beim Löschen entfallen sein Kursverlauf und seine prüfungsrelevanten Termine mit ihm.
- Ohne die Sperre könnte öffentlich Sichtbares durch eine Stammdatenlöschung verschwinden. Zurücknehmen bleibt der einzige und stets ausdrückliche Weg, eine Veröffentlichung zu beenden.
- Nach der Löschung ist die Kurskennung wieder frei.

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

### Veröffentlichungszustand

Der Veröffentlichungszustand eines Kurses ist:

- **noch nie veröffentlicht**, wenn keine veröffentlichte Fassung existiert und die Markierung nicht gesetzt ist;
- **veröffentlicht**, wenn eine veröffentlichte Fassung existiert;
- **zurückgenommen**, wenn keine veröffentlichte Fassung existiert und die Markierung gesetzt ist.

Der Planungsstand ist kein Zustand dieser Reihe, sondern existiert in allen dreien.

## Planungsstand und Bearbeitung

- Der Planungsstand ist für die Bereichsbearbeitung aller Bereiche und die Systemadministration lesbar, aber nur für die Bereichsbearbeitung seines eigenen Bereichs und die Systemadministration bearbeitbar (siehe [ADR 0011](adr/0011-systemweite-leseeinsicht-in-kurse.md)).
- Änderungen am Planungsstand verändern ausschließlich diesen, bis erneut veröffentlicht wird.

Normale, granulare Speicheraktionen verwenden Last-write-wins und besitzen keine Konfliktwarnung. Sie prüfen Berechtigung, Existenz, Strukturregeln und weitere Zustandsvoraussetzungen stets gegen den aktuellen Stand.

### Keine Gleichheitsregel zwischen Kursen

Keine Invariante verlangt, dass Kursphasen oder Termine verschiedener Kurse übereinstimmen. Abweichungen sind zulässig und häufig beabsichtigt — etwa wenn ein Studiengang eine Prüfungsform kennt, die ein anderer nicht kennt. Übereinstimmung wird deshalb angezeigt und nicht erzwungen; die Zusammenfassung übereinstimmender Angaben in einer Gegenüberstellung ist eine Anzeigeregel und steht in [`MVP-SPEZIFIKATION.md`](MVP-SPEZIFIKATION.md).

## Veröffentlichung und Zurücknahme

- Veröffentlichen und Zurücknehmen sind ein Vorgang je Kurs. Eine Sammelfreigabe über mehrere Kurse gibt es nicht.
- Veröffentlichen prüft alle Struktur- und Veröffentlichungsregeln des Kurses und ersetzt seine bisherige veröffentlichte Fassung atomar durch eine Kopie seines aktuellen Planungsstands.
- Der Planungsstand bleibt dabei unverändert bestehen und anschließend weiter bearbeitbar.
- Die Fassung übernimmt als Snapshots die zu diesem Zeitpunkt geltenden Bezeichnungen von Bereich und Studiengang, die Anzahl Semester sowie Kurskennung, Studienbeginn und Studienende. Sie verweist zur Herkunft auf die unveränderliche Kurs-ID.
- Kursphasen und Termine einer veröffentlichten Fassung gehören ausschließlich dieser Fassung. Die veröffentlichte Fassung ist dadurch vollständig eigenständig: Alle öffentlich angezeigten Angaben ergeben sich ausschließlich aus ihr.
- Die erste Veröffentlichung setzt dauerhaft die Markierung des Kurses, schon einmal veröffentlicht worden zu sein.
- Öffentlich sichtbarer Inhalt ändert sich nur durch Veröffentlichen oder Zurücknehmen. Interne Änderungen an Stammdaten, Kursverlauf und Terminen bleiben bis zur nächsten Veröffentlichung unsichtbar.
- Frühere Revisionen werden weder angezeigt noch wiederhergestellt.
- Eine Zurücknahme löscht die veröffentlichte Fassung atomar und entfernt den Kurs damit aus allen öffentlichen Ansichten.
- Eine erneute Veröffentlichung veröffentlicht stets den aktuellen Planungsstand.

Ein vollständig geplanter Kurs wird unabhängig von allen anderen Kursen veröffentlicht. Dass ein Jahrgang oder ein Bereich zu einem Zeitpunkt nur teilweise öffentlich ist, ist ein zulässiger und beabsichtigter Zustand.

## Kursverlauf

- Eine Kursphase gehört genau einem Kurs und genau einer Ebene, also entweder seinem Planungsstand oder einer veröffentlichten Fassung. Sie besitzt Startdatum, Enddatum, Semester und Phasentyp.
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

- Ein Termin gehört genau einem Kurs und genau einer Ebene, also entweder dessen Planungsstand oder einer veröffentlichten Fassung. Er besitzt Titel, optionale Beschreibung, Kategorie, Zeitangabe und ein binäres Merkmal „vorläufig“.
- Die Kategorie ist genau `Anmeldung`, `Abgabe`, `Präsentation`, `Prüfung` oder `Sonstiges`.
- Eine gemeinsame Anlage für mehrere ausgewählte Kurse erzeugt je Kurs einen eigenständigen Termin mit zunächst gleichen Angaben und setzt ebenfalls Schreibrechte für jeden ausgewählten Kurs voraus. Auch zwischen diesen Terminen besteht danach keine gemeinsame Identität.

Die Zeitangabe besteht aus einem erforderlichen Startdatum und einem optionalen Enddatum. Beide sind gültige gregorianische Kalendertage im Format `YYYY-MM-DD`; ein angegebenes Enddatum liegt auf oder nach dem Startdatum. Ohne Enddatum bezeichnet der Termin genau den Starttag, andernfalls den beidseitig inklusiven Datumsbereich. Kalendertage sind zeitzonenlos. Das Merkmal „vorläufig“ sagt aus, dass die Zeitangabe noch nicht verbindlich ist; ein vorläufiger Termin ist gültig und veröffentlichbar und wird überall textlich als vorläufig gekennzeichnet. Einen eigenen Bestätigungsablauf oder weitere Stufen gibt es nicht.

Ein Termin trägt weder ein eigenes Semester noch eine eigene Kursphase. Sein Semester wird aus der Kursphase abgeleitet, die sein Startdatum abdeckt. Fehlt eine solche Kursphase im noch unvollständigen Planungsstand, ist das Semester dort vorübergehend nicht ableitbar; die Oberfläche benennt dies ausdrücklich. Ein Termin über einen Semesterwechsel gehört zum Semester seines Beginns. In einer veröffentlichten Fassung ist das Semester aufgrund der Veröffentlichungsprüfung stets ableitbar.

## Veröffentlichungsprüfung

Ein Kurs ist nur veröffentlichbar, wenn zusätzlich folgende Regeln erfüllt sind:

- Sein Kursverlauf ist vollständig: Die Kursphasen decken jeden Kalendertag seines einschließlich beider Grenztage geltenden Studienzeitraums genau einmal ab.
- Die Kursphasen schließen lückenlos aneinander an und überlappen sich nicht.
- Die Semester sind entlang der Zeitachse monoton nicht fallend.
- Jedes Semester von 1 bis zur Anzahl Semester seines Studiengangs kommt mindestens einmal vor; alle Kursphasen eines Semesters bilden einen zusammenhängenden Abschnitt.
- Jeder Termin liegt vollständig innerhalb des Studienzeitraums.
- Keine veröffentlichte Fassung eines anderen Kurses zeigt eine Kurskennung, die ohne Beachtung der Groß-/Kleinschreibung der zu veröffentlichenden entspricht.

Die letzte Regel ist trotz der systemweiten Eindeutigkeit aktueller Kurskennungen nötig, weil eine Kennung nach der Veröffentlichung geändert werden darf und die Fassung die zum Zeitpunkt ihrer Freigabe geltende Kennung behält. Wird ein veröffentlichter Kurs umbenannt, ist seine alte Kennung unter den aktuellen Kursen wieder frei und kann einem anderen Kurs gegeben werden; erst dessen Veröffentlichung ließe zwei Fassungen dieselbe Kennung zeigen. Sie vergleicht deshalb Snapshots und nicht aktuelle Kursangaben. Da die veröffentlichte Kurskennung zugleich die öffentliche Adresse ist, wäre die Adressierung sonst mehrdeutig.

Eine Kollisionsprüfung auf die Kursidentität ist dagegen nicht erforderlich: Ein Kurs besitzt höchstens eine eigene veröffentlichte Fassung und kann in keiner anderen vorkommen.

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
- Kurse ohne veröffentlichte Fassung löschen;
- Kurse veröffentlichen und Veröffentlichungen zurücknehmen.

Darüber hinaus darf sie **Kurse aller Bereiche einschließlich ihrer Planungsstände lesen** und als Vorlage einer Übernahme verwenden. Schreibende Vorgänge bleiben auf die zugeordneten Bereiche beschränkt; maßgeblich ist der Bereich des Studiengangs des jeweiligen Kurses (siehe [ADR 0011](adr/0011-systemweite-leseeinsicht-in-kurse.md)).

Die **Systemadministration** besitzt die Rechte der Bereichsbearbeitung in allen Bereichen und darf zusätzlich:

- interne Konten anlegen, E-Mail-Adressen, Rollen und Bereichszuordnungen ändern, Passwortlinks ausstellen sowie Konten sperren und freigeben.

Externe Nutzende dürfen ausschließlich veröffentlichte Fassungen einsehen.
