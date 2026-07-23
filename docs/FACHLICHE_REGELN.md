# Fachliche Regeln

Die kanonischen Begriffe stehen im [`CONTEXT.md`](../CONTEXT.md). Dieses Dokument definiert die verbindlichen Invarianten, Lebenszyklen und Berechtigungen des MVP.

## Regelklassen

**Strukturregeln** gelten bei jedem Schreibvorgang. Ein Verstoß wird nicht gespeichert.

**Veröffentlichungsregeln** gelten zusätzlich beim Veröffentlichen eines Blockplans. Ein Entwurf darf sie vorübergehend verletzen.

Die Regeln im Abschnitt [Veröffentlichungsprüfung](#veröffentlichungsprüfung) sind Veröffentlichungsregeln. Alle übrigen Datenregeln sind Strukturregeln, soweit sie nicht ausdrücklich einen Lebenszyklus oder eine Berechtigung beschreiben.

## Textnormalisierung und Eindeutigkeit

- Texte werden an beiden Rändern getrimmt. Pflichttexte dürfen danach nicht leer sein; leere optionale Texte werden als nicht angegeben behandelt.
- Bei menschlichen Bezeichnungen werden aufeinanderfolgende Leerzeichen für den Anzeigewert auf eines reduziert.
- Bereichsbezeichnungen, Studiengangskürzel, Kurskennungen und vergebene Blockplanbezeichnungen sind ohne Beachtung der Groß-/Kleinschreibung eindeutig. Bereichsbezeichnungen, Studiengangskürzel und Kurskennungen sind systemweit eindeutig; Blockplanbezeichnungen innerhalb ihres Bereichs.
- Dienstliche E-Mail-Adressen müssen syntaktisch gültig sein, werden getrimmt und kleingeschrieben und sind systemweit eindeutig. Das MVP beschränkt sie nicht auf eine bestimmte Domain.
- Passwörter werden weder getrimmt noch normalisiert.

Nach der Normalisierung gelten folgende Höchstlängen in Unicode-Codepoints:

| Angabe | Höchstlänge |
| --- | ---: |
| Bereichsbezeichnung | 120 |
| Studiengangsbezeichnung | 160 |
| Studiengangskürzel | 20 |
| Kurskennung | 32 |
| Blockplanbezeichnung | 160 |
| Termintitel | 160 |
| Terminbeschreibung | 2.000 |
| Dienstliche E-Mail-Adresse | 254 |

Werte werden bei einer Überschreitung abgelehnt und niemals abgeschnitten.

## Bereich und Studiengang

### Bereich

- Ein Bereich besitzt eine unveränderliche systemische Identität und eine erforderliche Bezeichnung.
- Ein Bereich kann beliebig viele Studiengänge enthalten; jeder Studiengang gehört genau einem Bereich.
- Bereiche werden im MVP weder stillgelegt noch entfernt.

### Studiengang

- Ein Studiengang besitzt eine unveränderliche systemische Identität, eine erforderliche Bezeichnung, ein erforderliches Kürzel, genau einen Bereich und eine Anzahl Semester von 6 oder 7.
- Bezeichnung und Kürzel dürfen durch eine versionierte Datenmigration geändert werden. Bereich und Anzahl Semester dürfen dabei nur geändert werden, solange noch kein Kurs vom Studiengang abhängt.
- Eine spätere Korrektur von Bereich oder Semesterzahl bei bestehenden Kursen erfordert eine gesonderte, außerhalb der Anwendung dokumentierte Datenmigration.
- Studiengänge werden im MVP weder stillgelegt noch entfernt.

## Kurs

- Ein Kurs besitzt eine unveränderliche systemische Identität sowie Kurskennung, Studiengang, Studienbeginn und Studienende als Pflichtangaben.
- Studienbeginn und Studienende sind gültige gregorianische Kalendertage im Format `YYYY-MM-DD`; der Studienbeginn liegt vor dem Studienende.
- Der Jahrgang ist das Kalenderjahr des Studienbeginns und wird nicht gesondert gespeichert.
- Der verwaltende Bereich ist der Bereich des Studiengangs und wird nicht gesondert am Kurs gespeichert.
- Die Kurskennung hat kein erzwungenes Format und ist keine Datenquelle für den Jahrgang.
- Ein Kurs besteht unabhängig von einem Blockplan und ist höchstens einem Blockplan zugeordnet.

Solange ein Kurs noch kein veröffentlichter Kurs ist:

- dürfen alle vier Angaben geändert werden;
- darf er einem Blockplan zugeordnet, von ihm gelöst oder gelöscht werden;
- müssen Studiengang und Studienbeginn nach einer Änderung weiterhin zu einer bestehenden Blockplanzuordnung passen.

Eine Kurszuordnung setzt voraus:

- Der Studiengang gehört zum Bereich des Blockplans.
- Jahrgang und Anzahl Semester stimmen mit allen bereits zugeordneten Kursen überein.
- Der Blockplan enthält danach höchstens 20 Kurse.

Beim Lösen oder Löschen eines zugeordneten Kurses entfallen seine Kursphasen und seine Zuordnungen zu prüfungsrelevanten Terminen im Entwurf dieses Blockplans. Ein verbleibender Termin muss weiterhin mindestens einen Kurs betreffen; andernfalls wird die Operation unter Nennung der betroffenen Termine abgelehnt. Termine werden nie automatisch gelöscht.

Ein veröffentlichter Kurs bleibt dauerhaft seinem Blockplan zugeordnet, besitzt unveränderliche Kursangaben und muss in jeder späteren Veröffentlichung wieder einen vollständigen Verlauf haben. Die Kursmenge eines einmal veröffentlichten Blockplans kann deshalb nur wachsen. Eine Korrektur dieser Bindung ist im MVP nur durch eine gesonderte, außerhalb der Anwendung manuell dokumentierte Datenmigration möglich.

## Blockplan und Fassungen

### Blockplan

- Ein Blockplan besitzt eine unveränderliche systemische Identität, genau einen unveränderlichen Bereich, eine optionale Bezeichnung und jederzeit mindestens einen Kurs.
- Anlage des Blockplans und Zuordnung seines ersten Kurses sind eine gemeinsame Operation.
- Jahrgang und Anzahl Semester werden aus den zugeordneten Kursen abgeleitet und nicht am Blockplan gespeichert.
- Innerhalb eines Bereichs und Jahrgangs darf es mehrere Blockpläne geben.
- Der letzte Kurs kann nicht gelöst werden. Stattdessen kann nur ein noch nie veröffentlichter Blockplan als Ganzes gelöscht werden; seine Kurse bleiben blockplanlos bestehen.
- Ein bereits veröffentlichter Blockplan wird nicht gelöscht.

Ohne vergebene Bezeichnung wird der interne Name aus Bereich, Jahrgang und aktuellen Kurskennungen abgeleitet, beispielsweise „SZI 2026 · TIF26A, WIN26A“. Eine vergebene Bezeichnung ersetzt diesen Namen. Angezeigte Namen müssen insgesamt nicht eindeutig sein; stabile IDs und die immer sichtbaren Kurskennungen unterscheiden Blockpläne.

Ein Blockplan besitzt durchgehend einen Entwurf und höchstens eine veröffentlichte oder zurückgenommene Fassung. Aktuelle Bezeichnung und Kurszuordnungen gehören zum Blockplan und wirken intern sofort. Kursphasen und prüfungsrelevante Termine gehören genau einer Fassung.

### Entwurf

- Der Entwurf ist nur für die Bereichsbearbeitung seines Bereichs und die Systemadministration sichtbar.
- Er führt, wann und durch welches interne Konto er zuletzt geändert wurde.
- Änderungen an Kursphasen und Terminen verändern ausschließlich den Entwurf, bis erneut veröffentlicht wird.

Als Änderung des bearbeitbaren Planungsstands gelten außerdem Änderungen an der aktuellen Blockplanbezeichnung, an seinen Kurszuordnungen und an den vier Angaben eines zugeordneten Kurses. Sie aktualisieren ebenfalls, wann und durch welches interne Konto der Entwurf zuletzt geändert wurde. Veröffentlichen und Zurücknehmen verändern diese Angaben nicht.

### Veröffentlichung und Zurücknahme

- Veröffentlichen prüft alle Struktur- und Veröffentlichungsregeln und ersetzt die bisherige veröffentlichte oder zurückgenommene Fassung atomar durch eine Kopie des aktuellen Entwurfs.
- Der Entwurf bleibt dabei unverändert bestehen und anschließend weiter bearbeitbar.
- Die Fassung übernimmt als Snapshots die zu diesem Zeitpunkt öffentlich sichtbaren Bezeichnungen von Blockplan, Bereich und Studiengängen.
- Die öffentlich sichtbare Kursmenge ergibt sich ausschließlich aus den Kursphasen der Fassung.
- Öffentlich sichtbarer Inhalt ändert sich nur durch Veröffentlichen oder Zurücknehmen. Interne Änderungen an Bezeichnungen, Stammdaten oder Kurszuordnungen bleiben bis zur nächsten Veröffentlichung unsichtbar.
- Frühere Revisionen werden weder angezeigt noch wiederhergestellt.
- Eine Zurücknahme entfernt die Fassung aus allen öffentlichen Ansichten, behält sie aber intern, bis die nächste Veröffentlichung sie ersetzt.
- Eine erneute Veröffentlichung veröffentlicht stets den aktuellen Entwurf; die zurückgenommene Fassung wird nicht gesondert wiederhergestellt.

## Kursphase

- Eine Kursphase gehört genau einer Fassung und genau einem Kurs dieses Blockplans. Sie besitzt Startdatum, Enddatum, Semester und Phasentyp.
- Start- und Enddatum sind gültige gregorianische Kalendertage im Format `YYYY-MM-DD`; das Startdatum liegt vor oder auf dem Enddatum.
- Das Semester ist eine ganze Zahl von 1 bis zur Anzahl Semester des Blockplans.
- Der Phasentyp ist genau `Theorie` oder `Praxis`.
- Gleichartige Kursphasen dürfen unmittelbar aufeinander folgen.
- Entwurf und veröffentlichte Fassung enthalten jeweils höchstens 500 Kursphasen.
- Eine gemeinsame Anlage für mehrere Kurse erzeugt für jeden ausgewählten Kurs eine eigenständige Kursphase mit zunächst gleichen Angaben. Zwischen diesen Kursphasen besteht danach keine gemeinsame Identität; spätere Änderungen wirken nur auf die jeweils bearbeitete Kursphase.
- Spätere Vorlesungen dürfen ausschließlich Kursphasen vom Typ Theorie zugeordnet werden; Vorlesungen gehören nicht zum MVP.

### Semester

Das Studienjahr wird aus dem Semester abgeleitet: Semester 1 und 2 bilden Studienjahr 1, Semester 3 und 4 Studienjahr 2, Semester 5 und 6 Studienjahr 3 und Semester 7 das halbe Studienjahr 4.

## Prüfungsrelevanter Termin

- Ein Termin gehört genau einer Fassung und besitzt Titel, optionale Beschreibung, Kategorie, Zeitangabe, Vorläufigkeitsstatus und mindestens einen betroffenen Kurs desselben Blockplans.
- Derselbe Kurs darf im Geltungsbereich eines Termins höchstens einmal vorkommen.
- Entwurf und veröffentlichte Fassung enthalten jeweils höchstens 200 Termine.
- Die Kategorie ist genau `Anmeldung`, `Abgabe`, `Präsentation`, `Prüfung` oder `Sonstiges`.

Die Zeitangabe besteht aus einem erforderlichen Startdatum und einem optionalen Enddatum. Beide sind gültige gregorianische Kalendertage im Format `YYYY-MM-DD`; ein angegebenes Enddatum liegt auf oder nach dem Startdatum. Ohne Enddatum bezeichnet der Termin genau den Starttag, andernfalls den beidseitig inklusiven Datumsbereich. Kalendertage sind zeitzonenlos. Eine vorläufige Zeitangabe ist gültig und veröffentlichbar.

Ein Termin trägt weder ein eigenes Semester noch eine eigene Kursphase. Sein Semester wird je betroffenem Kurs aus der Kursphase abgeleitet, die sein Startdatum abdeckt. Ein Termin über einen Semesterwechsel gehört zum Semester seines Beginns; bei mehreren Kursen darf das abgeleitete Semester unterschiedlich sein.

## Veröffentlichungsprüfung

Eine Veröffentlichung ist nur möglich, wenn zusätzlich folgende Regeln erfüllt sind:

- Jeder zugeordnete Kurs besitzt einen vollständigen Verlauf.
- Die Kursphasen jedes Kurses decken jeden Kalendertag seines einschließlich beider Grenztage geltenden Studienzeitraums genau einmal ab.
- Keine Kursphase liegt ganz oder teilweise außerhalb des Studienzeitraums.
- Die Kursphasen schließen lückenlos aneinander an und überlappen sich nicht.
- Die Semester sind entlang der Zeitachse monoton nicht fallend.
- Jedes Semester von 1 bis zur Anzahl Semester des Studiengangs kommt mindestens einmal vor; alle Kursphasen eines Semesters bilden einen zusammenhängenden Abschnitt.
- Jeder Termin liegt vollständig innerhalb des Studienzeitraums jedes betroffenen Kurses.

## Interne Konten

### Zustände

Ein internes Konto befindet sich genau in einem Zustand:

- **Passwortvergabe ausstehend**: Konto, Berechtigungen und Bereiche bestehen, aber es besitzt kein gültiges lokales Passwort; eine Anmeldung ist nicht möglich.
- **Aktiv**: Das Konto besitzt ein gültiges lokales Passwort und kann sich anmelden.
- **Gesperrt**: Die Anmeldung ist gesperrt. Fachliche Zuordnungen bleiben erhalten.

Ein neues Konto wartet auf die Passwortvergabe. Ein Passwortlink ist zufällig, einmal verwendbar, serverseitig nur gehasht gespeichert und sieben Tage gültig. Er kann ausschließlich für ein Konto mit ausstehender Passwortvergabe erzeugt werden; eine Neuausstellung macht einen vorherigen Passwortlink dieses Kontos ungültig. Das erfolgreiche Setzen eines Passworts versetzt das Konto in den aktiven Zustand.

Setzt die Systemadministration das Passwort eines aktiven Kontos zurück, werden das bisherige Passwort und alle Sitzungen sofort ungültig, das Konto wartet wieder auf die Passwortvergabe und ein neuer Passwortlink wird ausgegeben. Mitarbeitende können ihr Passwort nicht selbst ändern oder zurücksetzen.

Eine Sperrung entfernt Passwort, Sitzungen und offene Passwortlinks. Die Freigabe eines gesperrten Kontos führt zur ausstehenden Passwortvergabe und gibt einen neuen Passwortlink aus. Gesperrte Konten werden im MVP weder automatisch anonymisiert noch gelöscht.

Ändert die Systemadministration die E-Mail-Adresse:

- bleibt ein Konto mit ausstehender Passwortvergabe in diesem Zustand, verliert offene Passwortlinks und erhält einen neuen;
- fällt ein aktives Konto auf „Passwortvergabe ausstehend“ zurück, verliert Passwort und Sitzungen und erhält einen neuen Passwortlink;
- bleibt ein gesperrtes Konto gesperrt.

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

- Kurse anlegen und bearbeiten;
- noch nicht veröffentlichte Kurse Blockplänen zuordnen und von ihnen lösen;
- noch nicht veröffentlichte Kurse löschen;
- Blockplanentwürfe anlegen und bearbeiten;
- noch nie veröffentlichte Blockpläne löschen;
- Blockpläne veröffentlichen und Veröffentlichungen zurücknehmen.

Die **Systemadministration** besitzt die Rechte der Bereichsbearbeitung in allen Bereichen und darf zusätzlich:

- interne Konten anlegen, E-Mail-Adressen, Rollen und Bereichszuordnungen ändern, Passwortlinks ausstellen sowie Konten sperren und freigeben.

Externe Nutzende dürfen ausschließlich veröffentlichte Fassungen einsehen.
