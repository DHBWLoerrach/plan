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
- Ein neuer Studiengang, Kurs oder Blockplan setzt einen aktiven Bereich voraus.
- Ein deaktivierter Bereich nimmt keine neuen Studiengänge, Kurse oder Blockpläne auf. Bestehende Kurse und Blockpläne bleiben vollständig bearbeitbar; Blockpläne bleiben veröffentlichbar, zurücknehmbar und öffentlich sichtbar.
- Bereichszuordnungen interner Konten dürfen für die Restverwaltung auch bei einem deaktivierten Bereich geändert werden.

### Studiengang

- Ein Studiengang besitzt eine unveränderliche systemische Identität, eine erforderliche Bezeichnung, ein erforderliches Kürzel, genau einen Bereich und eine Anzahl Semester von 6 oder 7.
- Bezeichnung und Kürzel dürfen geändert werden. Bereich und Anzahl Semester dürfen nur geändert werden, solange noch kein Kurs vom Studiengang abhängt.
- Eine spätere Korrektur von Bereich oder Semesterzahl bei bestehenden Kursen erfordert eine gesonderte, auditierte Datenmigration.
- Ein neuer Kurs setzt einen aktiven Studiengang voraus.
- Ein deaktivierter Studiengang nimmt keine neuen Kurse auf. Bestehende Kurse bleiben bearbeitbar und dürfen weiterhin bestehenden Blockplänen zugeordnet oder von ihnen gelöst werden.

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

Ein veröffentlichter Kurs bleibt dauerhaft seinem Blockplan zugeordnet, besitzt unveränderliche Kursangaben und muss in jeder späteren Veröffentlichung wieder einen vollständigen Verlauf haben. Die Kursmenge eines einmal veröffentlichten Blockplans kann deshalb nur wachsen. Eine Korrektur dieser Bindung ist im MVP nur durch eine gesonderte, auditierte Datenmigration möglich.

## Blockplan und Fassungen

### Blockplan

- Ein Blockplan besitzt eine unveränderliche systemische Identität, genau einen unveränderlichen Bereich, eine optionale Bezeichnung und jederzeit mindestens einen Kurs.
- Anlage des Blockplans und Zuordnung seines ersten Kurses sind eine gemeinsame Operation.
- Jahrgang und Anzahl Semester werden aus den zugeordneten Kursen abgeleitet und nicht am Blockplan gespeichert.
- Innerhalb eines Bereichs und Jahrgangs darf es mehrere Blockpläne geben.
- Der letzte Kurs kann nicht gelöst werden. Stattdessen kann nur ein noch nie veröffentlichter Blockplan als Ganzes gelöscht werden; seine Kurse bleiben blockplanlos bestehen.
- Ein bereits veröffentlichter Blockplan wird nicht gelöscht.

Ohne vergebene Bezeichnung wird der interne Name aus Bereich, Jahrgang und aktuellen Kurskennungen abgeleitet, beispielsweise „SZI 2026 · TIF26A, WIN26A“. Eine vergebene Bezeichnung ersetzt diesen Namen. Angezeigte Namen müssen insgesamt nicht eindeutig sein; stabile IDs und die immer sichtbaren Kurskennungen unterscheiden Blockpläne.

Ein Blockplan besitzt durchgehend einen Entwurf und höchstens eine veröffentlichte oder zurückgenommene Fassung. Aktuelle Bezeichnung und Kurszuordnungen gehören zum Blockplan und wirken intern sofort. Blockphasen, Kursphasen und prüfungsrelevante Termine gehören genau einer Fassung.

### Entwurf

- Der Entwurf ist nur für berechtigte fachliche Rollen seines Bereichs und die Systemadministration sichtbar.
- Er führt, wann und durch welches interne Konto er zuletzt geändert wurde.
- Änderungen an Blockphasen, Kursphasen und Terminen verändern ausschließlich den Entwurf, bis erneut veröffentlicht wird.

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

## Blockphase und Kursphase

### Blockphase

- Eine Blockphase gehört genau einer Fassung und besitzt Startdatum, Enddatum, Semester und Phasentyp.
- Start- und Enddatum sind gültige gregorianische Kalendertage im Format `YYYY-MM-DD`; das Startdatum liegt vor oder auf dem Enddatum.
- Das Semester ist eine ganze Zahl von 1 bis zur Anzahl Semester des Blockplans.
- Der Phasentyp ist genau `Theorie` oder `Praxis`.
- Gleichartige Blockphasen dürfen unmittelbar aufeinander folgen.
- Eine Blockphase darf über Studiengangsgrenzen hinweg mehreren Kursen gemeinsam zugeordnet sein.
- Entwurf und veröffentlichte Fassung enthalten jeweils höchstens 500 Blockphasen.

Ein Entwurf darf verwaiste Blockphasen enthalten. Eine neu angelegte Blockphase wird jedoch mindestens einem Kurs zugeordnet. Das Trennen einer gemeinsamen Blockphase kopiert sie und verschiebt die ausgewählten Kursphasen atomar auf die Kopie.

### Kursphase

- Eine Kursphase ordnet genau einen Kurs genau einer Blockphase derselben Fassung zu und besitzt keine eigenen Kopien von Zeitraum, Semester oder Phasentyp.
- Derselbe Kurs darf derselben Blockphase höchstens einmal zugeordnet sein.
- Spätere Vorlesungen dürfen ausschließlich Kursphasen zugeordnet werden, deren Blockphase vom Typ Theorie ist; Vorlesungen gehören nicht zum MVP.

### Semester

Das Studienjahr wird aus dem Semester abgeleitet: Semester 1 und 2 bilden Studienjahr 1, Semester 3 und 4 Studienjahr 2, Semester 5 und 6 Studienjahr 3 und Semester 7 das halbe Studienjahr 4.

## Prüfungsrelevanter Termin

- Ein Termin gehört genau einer Fassung und besitzt Titel, optionale Beschreibung, Kategorie, Zeitangabe, Vorläufigkeitsstatus und mindestens einen betroffenen Kurs desselben Blockplans.
- Derselbe Kurs darf im Geltungsbereich eines Termins höchstens einmal vorkommen.
- Entwurf und veröffentlichte Fassung enthalten jeweils höchstens 200 Termine.
- Die Kategorie ist genau `Anmeldung`, `Abgabe`, `Präsentation`, `Prüfung` oder `Sonstiges`.

Die Zeitangabe ist genau eine der folgenden Varianten:

- ein Datum mit optionaler Uhrzeit in Minutenauflösung `HH:mm`,
- ein beidseitig inklusiver Datumsbereich mit Startdatum vor oder auf Enddatum,
- ein vollständiger Kalendermonat.

Kalendertage sind zeitzonenlos. Optionale Uhrzeiten gelten in `Europe/Berlin`; eine technische Umrechnung darf den zugehörigen Kalendertag nicht verändern. Eine vorläufige Zeitangabe ist gültig und veröffentlichbar.

Ein Termin trägt weder ein eigenes Semester noch eine eigene Blockphase. Sein Semester wird je betroffenem Kurs aus der Kursphase abgeleitet, die den ersten Tag seiner Zeitangabe abdeckt. Ein Termin über einen Semesterwechsel gehört zum Semester seines Beginns; bei mehreren Kursen darf das abgeleitete Semester unterschiedlich sein.

## Veröffentlichungsprüfung

Eine Veröffentlichung ist nur möglich, wenn zusätzlich folgende Regeln erfüllt sind:

- Jeder zugeordnete Kurs besitzt einen vollständigen Verlauf.
- Die Kursphasen jedes Kurses decken jeden Kalendertag seines einschließlich beider Grenztage geltenden Studienzeitraums genau einmal ab.
- Keine Kursphase liegt ganz oder teilweise außerhalb des Studienzeitraums.
- Die Kursphasen schließen lückenlos aneinander an und überlappen sich nicht.
- Die Semester sind entlang der Zeitachse monoton nicht fallend.
- Jedes Semester von 1 bis zur Anzahl Semester des Studiengangs kommt mindestens einmal vor; alle Kursphasen eines Semesters bilden einen zusammenhängenden Abschnitt.
- Jede Blockphase ist mindestens einer Kursphase zugeordnet.
- Jeder Termin liegt vollständig innerhalb des Studienzeitraums jedes betroffenen Kurses.

## Interne Konten

### Zustände

Ein internes Konto befindet sich genau in einem Zustand:

- **Passwortvergabe ausstehend**: Konto, Berechtigungen und Bereiche bestehen, aber es besitzt kein gültiges lokales Passwort; eine Anmeldung ist nicht möglich.
- **Aktiv**: Das Konto besitzt ein gültiges lokales Passwort und kann sich anmelden.
- **Gesperrt**: Die Anmeldung ist gesperrt. Fachliche Zuordnungen und Referenzen der Auditspur bleiben erhalten.

Ein neues Konto wartet auf die Passwortvergabe. Ein Passwortlink ist zufällig, einmal verwendbar, serverseitig nur gehasht gespeichert und sieben Tage gültig. Er kann ausschließlich für ein Konto mit ausstehender Passwortvergabe erzeugt werden; eine Neuausstellung macht einen vorherigen Passwortlink dieses Kontos ungültig. Das erfolgreiche Setzen eines Passworts versetzt das Konto in den aktiven Zustand.

Setzt die Systemadministration das Passwort eines aktiven Kontos zurück, werden das bisherige Passwort und alle Sitzungen sofort ungültig, das Konto wartet wieder auf die Passwortvergabe und ein neuer Passwortlink wird ausgegeben. Mitarbeitende können ihr Passwort nicht selbst ändern oder zurücksetzen.

Eine Sperrung entfernt Passwort, Sitzungen und offene Passwortlinks. Die Freigabe eines gesperrten Kontos führt zur ausstehenden Passwortvergabe und gibt einen neuen Passwortlink aus. Gesperrte Konten werden im MVP weder automatisch anonymisiert noch gelöscht.

Ändert die Systemadministration die E-Mail-Adresse:

- bleibt ein Konto mit ausstehender Passwortvergabe in diesem Zustand, verliert offene Passwortlinks und erhält einen neuen;
- fällt ein aktives Konto auf „Passwortvergabe ausstehend“ zurück, verliert Passwort und Sitzungen und erhält einen neuen Passwortlink;
- bleibt ein gesperrtes Konto gesperrt.

### Rollen und gültige Kombinationen

- Ein internes Konto trägt höchstens eine fachliche Rolle: Studiengangsmanagement oder Studiengangsleitung.
- Die fachliche Rolle gilt einheitlich in allen zugeordneten Bereichen und setzt mindestens einen Bereich voraus.
- Unabhängig davon kann das Konto Systemadministration besitzen.
- Ein reines Systemadministrationskonto benötigt weder fachliche Rolle noch Bereich.
- Jedes interne Konto besitzt mindestens eine fachliche Rolle oder Systemadministration.
- Rolle, Systemadministration und Bereichszuordnungen werden bei jeder Änderung gemeinsam validiert.
- Nach der ersten Passwortvergabe des initialen Systemadministrationskontos muss jede Änderung über die Anwendung mindestens ein aktives Systemadministrationskonto erhalten. Der ausschließlich im Anwendungscontainer verfügbare Notfall-Reset des letzten Systemadministrationskontos ist die einzige Ausnahme und darf dieses Konto vorübergehend auf „Passwortvergabe ausstehend“ setzen.

### Berechtigungen

Das **Studiengangsmanagement** darf in seinen Bereichen:

- Kurse anlegen und bearbeiten;
- noch nicht veröffentlichte Kurse Blockplänen zuordnen und von ihnen lösen;
- Blockplanentwürfe anlegen und bearbeiten;
- Blockplan- und Kursereignisse der Auditspur einsehen.

Die **Studiengangsleitung** darf dort zusätzlich:

- noch nicht veröffentlichte Kurse löschen;
- noch nie veröffentlichte Blockpläne löschen;
- Blockpläne veröffentlichen und Veröffentlichungen zurücknehmen.

Die **Systemadministration** besitzt die Rechte der Studiengangsleitung in allen Bereichen und darf zusätzlich:

- Bereiche und Studiengänge anlegen, pflegen, deaktivieren und reaktivieren;
- interne Konten anlegen, E-Mail-Adressen, Rollen und Bereichszuordnungen ändern, Passwortlinks ausstellen sowie Konten sperren und freigeben;
- die vollständige Auditspur einschließlich Konto-, Bereichs- und Studiengangsereignissen einsehen.

Externe Nutzende dürfen ausschließlich veröffentlichte Fassungen einsehen.

## Auditspur

Auditeinträge werden nur angefügt und weder verändert noch gelöscht. Sie enthalten Zeitpunkt, auslösendes internes Konto beziehungsweise das System, Ereignisart und betroffene Entität. Geheimnisse wie Tokenwerte oder Passwörter werden nie erfasst.

Bei nicht personenbezogenen Stammdatenänderungen enthält das Ereignis betroffene Felder sowie alte und neue Werte. Kontoereignisse enthalten keine früheren E-Mail-Adressen oder anderen personenbezogenen Werte.

Erfasst werden:

- bei Blockplänen Erstellung, Änderung der Bezeichnung, Veröffentlichung, Zurücknahme und Löschung eines nie veröffentlichten Blockplans;
- bei Kursen Erstellung, Änderung der vier Kursangaben, Zuordnung, Lösung und Löschung;
- bei Bereichen und Studiengängen Erstellung, Stammdatenänderung, Deaktivierung und Reaktivierung;
- bei Konten Anlage, Passwortvergabe, Passwort-Reset, Sperrung, Freigabe, Änderungen von E-Mail-Adresse, Rolle oder Bereichen sowie Ausstellung eines Passwortlinks.

Änderungen an Blockphasen, Kursphasen und Terminen sind keine eigenen Auditereignisse. Sie erscheinen als „zuletzt geändert“ am Entwurf und werden erst durch die Veröffentlichung zu einem Auditereignis.

Jedes Blockplan- und Kursereignis speichert seinen fachlichen Bereich zum Ereigniszeitpunkt als Sichtbarkeitsbereich. Bei einem Bereichswechsel eines Kurses trägt das Änderungsereignis Ausgangs- und Zielbereich und ist in beiden Auditansichten sichtbar; frühere Ereignisse verbleiben in ihrem damaligen Bereich. Konto-, Bereichs- und Studiengangsereignisse sieht nur die Systemadministration.
