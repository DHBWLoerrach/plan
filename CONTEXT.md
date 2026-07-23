# Ubiquitous Language

## Regelklassen

Die fachlichen Regeln dieses Dokuments gehören genau einer von zwei Klassen an.

**Strukturregeln** gelten immer, auch im Entwurf. Sie betreffen einzelne Objekte und ihre unmittelbaren Beziehungen: Pflichtangaben, Eindeutigkeiten, Datumsordnungen und Zuordnungsbedingungen. Ein Verstoß wird gar nicht erst gespeichert.

**Veröffentlichungsregeln** gelten nur bei der Veröffentlichung. Sie betreffen den Plan als Ganzes: lückenlose Abdeckung, Semesterfolge, Vollständigkeit der Zuordnungen. Ein Entwurf darf sie vorübergehend verletzen.

Die Zuordnung ist an der Formulierung erkennbar: Regeln, die mit „In einer veröffentlichten Fassung“ oder „Ein veröffentlichter …“ eingeleitet werden, sind Veröffentlichungsregeln. Alle übrigen Regeln sind Strukturregeln.

## Bereich

Die organisatorische Einheit, für die interne Mitarbeitende Kurse und deren Blockpläne verwalten dürfen. Ein Bereich besitzt eine unveränderliche systemische Identität und eine erforderliche, systemweit eindeutige Bezeichnung. Er enthält einen oder mehrere Studiengänge; jeder Studiengang gehört genau einem verwaltenden Bereich. Interne Konten können mehreren Bereichen zugeordnet sein. Bereiche werden von der Systemadministration angelegt, gepflegt und deaktiviert.

## Studiengang

Ein Studienangebot innerhalb genau eines Bereichs, zum Beispiel Informatik oder Wirtschaftsinformatik. Ein Studiengang besitzt eine unveränderliche systemische Identität, eine erforderliche Bezeichnung und ein erforderliches, systemweit eindeutiges Kürzel wie `TIF` oder `WDS`. Das Kürzel dient der öffentlichen Filterung und ist deshalb auch über Bereichsgrenzen hinweg eindeutig.

Studiengänge werden von der Systemadministration angelegt, gepflegt und deaktiviert. Ein Studiengang darf nur dann einem anderen Bereich zugeordnet werden, wenn noch kein Kurs und kein Blockplan von ihm abhängt.

## Studienzentrum

Die an der DHBW Lörrach übliche Bezeichnung für einen Bereich mit mehreren Studiengängen, zum Beispiel das Studienzentrum IT-Management & Informatik (SZI) mit Informatik und Wirtschaftsinformatik. Das Modell kennt keine vom Bereich abweichenden Regeln für Studienzentren; kanonisch ist „Bereich“.

## Jahrgang

Das Kalenderjahr, in dem das Studium beginnt.

Beim Kurs ist der Jahrgang keine eigene Angabe, sondern das Kalenderjahr seines Studienbeginns. Beim Blockplan ist er eine eigene verpflichtende Angabe, die bei der Anlage gesetzt wird und danach unveränderlich ist. Alle Kurse eines Blockplans gehören demselben Jahrgang an.

Die Kurskennung trägt zwar üblicherweise eine Jahresangabe, ist aber ein frei vergebenes Etikett ohne erzwungenes Format; sie ist keine Quelle für den Jahrgang.

## Kurs

Eine Gruppe von Studierenden eines Studiengangs und Jahrgangs, die vom Studienbeginn bis zum Studienende zusammenbleibt. Ein Kurs ist eine eigenständige fachliche Einheit, besteht auch ohne Blockplan und ist höchstens einem Blockplan zugeordnet; Kurse mit vollständig oder teilweise gemeinsamem zeitlichem Verlauf dürfen in demselben Blockplan geplant werden.

Ein Kurs besitzt eine unveränderliche systemische Identität sowie vier verpflichtende Angaben: die systemweit eindeutige Kurskennung, die Studiengang, Jahrgang und parallele Kursgruppe verbindet, zum Beispiel `TIF24A` oder `WDS24A`, dazu Studiengang, Studienbeginn und Studienende. „Kohorte“ ist kein kanonischer Begriff der Anwendung.

Kurse werden von Studiengangsleitung und Studiengangsmanagement im eigenen Bereich angelegt und gepflegt; der verwaltende Bereich eines Kurses ist keine eigene Angabe am Kurs, sondern ergibt sich aus dem Bereich seines Studiengangs; er gilt auch für einen Kurs ohne Blockplanzuordnung.

Solange ein Kurs kein veröffentlichter Kurs ist, sind alle vier Angaben änderbar, er darf einem Blockplan zugeordnet und wieder von ihm gelöst sowie gelöscht werden. Eine Änderung von Studiengang oder Studienbeginn ist nur zulässig, wenn eine bestehende Blockplanzuordnung danach weiterhin gültig ist; andernfalls muss der Kurs vorher gelöst werden.

Eine Zuordnung zu einem Blockplan ist nur zulässig, wenn der Studiengang des Kurses zu einem Studiengang des Bereichs gehört, dem der Blockplan zugeordnet ist, und der Jahrgang des Kurses dem Jahrgang des Blockplans entspricht.

Beim Lösen von einem Blockplan wie auch beim Löschen eines Kurses entfallen seine Kursphasen sowie seine Zuordnungen zu den prüfungsrelevanten Terminen desselben Blockplans; jeder verbleibende Termin muss weiterhin mindestens einen Kurs betreffen. Das Löschen entfernt zusätzlich den Kurs selbst.

## Veröffentlichter Kurs

Ein Kurs, der in mindestens einer veröffentlichten Fassung eines Blockplans enthalten war. Ein Kurs wird nie selbst veröffentlicht; veröffentlicht wird ausschließlich der Blockplan, und der Zustand des Kurses leitet sich daraus ab. Eine spätere Zurücknahme hebt ihn nicht auf.

Bei einem veröffentlichten Kurs sind Kurskennung, Studiengang, Studienbeginn und Studienende unveränderlich; er wird weder gelöscht noch von seinem Blockplan gelöst oder einem anderen Blockplan zugeordnet.

## Studienzeitraum

Der einschließlich beider Grenztage geltende Zeitraum vom verpflichtenden Studienbeginn bis zum verpflichtenden Studienende eines Kurses; dabei gilt Studienbeginn < Studienende.

In einer veröffentlichten Fassung decken die Kursphasen jeden Kalendertag dieses Zeitraums genau einmal ab, auch Wochenenden, Feiertage und vorlesungsfreie Tage.

## Kalendertag und Ortszeit

Start- und Enddaten sind zeitzonenlose Kalendertage im gregorianischen Kalender. Optionale Uhrzeiten prüfungsrelevanter Termine gelten in der Ortszeit `Europe/Berlin`; eine technische Umrechnung darf den zugehörigen Kalendertag nicht verändern.

## Blockplan

Eine gemeinsam verwaltete und veröffentlichte Planungseinheit für die Abfolge von Theorie- und Praxisphasen sowie die zugehörigen prüfungsrelevanten Termine eines oder mehrerer Kurse desselben Jahrgangs. Seine Blockphasen, Kursphasen und prüfungsrelevanten Termine sind bearbeitbare Anwendungsdaten; ein Blockplan ist kein Dokument, und ein PDF- oder Bild-Upload ist nicht seine Repräsentation.

Ein Blockplan besitzt eine unveränderliche systemische Identität, eine erforderliche und innerhalb seines Bereichs und Jahrgangs eindeutige Bezeichnung, genau einen Bereich und genau einen Jahrgang. Er enthält ausschließlich Kurse aus den Studiengängen seines Bereichs; innerhalb eines Bereichs und Jahrgangs darf es mehrere Blockpläne geben.

Ein Blockplan hat einen Entwurf und höchstens eine veröffentlichte Fassung. Die Grenze zwischen beiden verläuft so: Identität, Bereich, Jahrgang, Bezeichnung und die Zuordnung von Kursen gehören dem Blockplan selbst und wirken sofort, auch auf die öffentliche Ansicht. Blockphasen, Kursphasen und prüfungsrelevante Termine gehören jeweils einer Fassung.

Ein Kurs kann daher einem Blockplan zugeordnet sein, ohne in dessen veröffentlichter Fassung Kursphasen zu besitzen. Die öffentliche Ansicht zeigt nur Kurse, die in der veröffentlichten Fassung Kursphasen haben.

## Entwurf

Die bearbeitbare, nicht öffentlich sichtbare Fassung eines Blockplans. Sie ist nur für die fachlichen Rollen des zugeordneten Bereichs sowie für die Systemadministration sichtbar. Ein noch nie veröffentlichter Entwurf kann von Studiengangsleitung oder Systemadministration gelöscht werden; dabei bleiben die zugeordneten Kurse als eigenständige, blockplanlose Kurse bestehen.

Der Entwurf führt als abgeleitete Angabe, wann und durch welches Konto er zuletzt geändert wurde.

## Veröffentlichte Fassung

Die bewusst freigegebene Fassung eines Blockplans, die externe Nutzende sehen. Während Änderungen an einem Entwurf erfolgen, bleibt sie sichtbar. Eine neue Veröffentlichung ersetzt sie; frühere veröffentlichte Revisionen werden im MVP weder angezeigt noch wiederhergestellt. Ein bereits veröffentlichter Blockplan wird im MVP nicht gelöscht.

Eine Veröffentlichung ist nur möglich, wenn alle Struktur- und Veröffentlichungsregeln erfüllt sind. Sie setzt insbesondere voraus, dass die Fassung mindestens einen Kurs enthält und der Studienverlauf jedes enthaltenen Kurses über alle sechs Semester vollständig geplant ist. Ein nur teilweise geplanter Verlauf bleibt Entwurf; eine schrittweise Veröffentlichung einzelner Studienjahre ist nicht vorgesehen.

## Zurückgenommene Veröffentlichung

Ein Blockplan, dessen veröffentlichte Fassung von Studiengangsleitung oder Systemadministration aus der öffentlichen Ansicht entfernt wurde. Seine Daten und sein Entwurf bleiben intern erhalten und können erneut veröffentlicht werden.

## Blockphase

Ein einmal erfasster Zeitblock innerhalb einer Fassung eines Blockplans mit Start- und Enddatum, genau einem Semester und genau einem Phasentyp. Eine Blockphase darf mehreren Kursen auch über Studiengangsgrenzen hinweg gemeinsam zugeordnet sein; unterscheiden sich Zeitraum, Semester oder Phasentyp, handelt es sich um verschiedene Blockphasen. „Phase“ und „Urlaubsphase“ sind keine kanonischen Begriffe.

Eine Blockphase ist einschließlich beider Grenztage gültig; für sie gilt Startdatum ≤ Enddatum, sodass sie auch genau einen Kalendertag umfassen kann. Gleichartige Blockphasen dürfen unmittelbar aufeinander folgen.

In einer veröffentlichten Fassung ist jede Blockphase mindestens einer Kursphase zugeordnet; ein Entwurf darf vorübergehend verwaiste Blockphasen enthalten.

## Phasentyp

Die Art des Studienabschnitts, den eine Blockphase beschreibt. Es gibt genau zwei Werte: **Theorie** für einen Abschnitt an der Hochschule und **Praxis** für einen Abschnitt im Dualen Partnerunternehmen.

Der Phasentyp kennzeichnet den gesamten organisatorischen Abschnitt, nicht die Tätigkeit an einem einzelnen Kalendertag. Wochenenden, Feiertage und vorlesungsfreie Tage bilden deshalb keine eigene Phasenart und sind nicht automatisch Praxis, sondern tragen den Typ der sie abdeckenden Blockphase.

## Kursphase

Die Zuordnung genau eines Kurses zu genau einer Blockphase. Sie enthält keine eigene Kopie von Zeitraum, Semester oder Phasentyp. Vorlesungen gehören nicht zum MVP; in einer späteren Vorlesungsplanung dürfen sie ausschließlich Kursphasen zugeordnet werden, deren Blockphase vom Typ Theorie ist.

In einer veröffentlichten Fassung schließen die Kursphasen eines Kurses lückenlos aneinander an und überlappen sich nicht; auf das Enddatum der zugeordneten Blockphase folgt als Startdatum der nächsten zugeordneten Blockphase der nächste Kalendertag. Ihre Semesternummern sind entlang der Zeitachse monoton nicht fallend, und alle Kursphasen desselben Semesters bilden einen zusammenhängenden Abschnitt. Ein Entwurf darf diese Regeln vorübergehend verletzen.

## Semester

Die fortlaufende Studienperiode einer Blockphase. Eine Blockphase gehört vollständig zu genau einem Semester. Das Studienjahr wird aus dem Semester abgeleitet: Semester 1 und 2 gehören zu Studienjahr 1, Semester 3 und 4 zu Studienjahr 2 sowie Semester 5 und 6 zu Studienjahr 3.

Ein veröffentlichter Kursverlauf enthält die Semester 1 bis 6 jeweils mindestens einmal und in dieser Reihenfolge.

## Prüfungsrelevanter Termin

Eine Planangabe innerhalb einer Fassung eines Blockplans mit Titel, optionaler Beschreibung, Pflichtkategorie und einem Geltungsbereich, der mindestens einen Kurs desselben Blockplans umfasst. Ein Blockplan darf keinen, einen oder mehrere prüfungsrelevante Termine enthalten. Ein Termin ist nicht zwingend einer Blockphase oder einem Semester zugeordnet.

Seine strukturierte Zeitangabe ist entweder ein genaues Datum mit optionaler Uhrzeit, ein beidseitig inklusiver Datumsbereich oder ein vollständiger Kalendermonat vom ersten bis zum letzten Tag. Jede Zeitangabe kann als **vorläufig** markiert werden. Eine vorläufige Zeitangabe ist fachlich gültig und veröffentlichbar; sie kennzeichnet gegenüber externen Nutzenden, dass sich das Datum noch ändern kann.

In einer veröffentlichten Fassung liegt ein Termin vollständig innerhalb des Studienzeitraums jedes betroffenen Kurses.

Die Kategorien sind:

- **Anmeldung** — die Anmeldung des Themas einer Projekt- oder Bachelorarbeit durch die Studierenden.
- **Abgabe** — der Abgabetermin einer schriftlichen Leistung.
- **Präsentation** — die mündliche Präsentation einer Arbeit. Eine Arbeit mit Abgabe und Präsentation an verschiedenen Tagen ergibt zwei Termine.
- **Prüfung** — eine Klausur oder mündliche Prüfung.
- **Sonstiges** — Auffangwert für alles, was keiner der vier anderen Kategorien entspricht.

## Deaktivierung

Das Stilllegen einer Stammdatenentität anstelle ihrer Löschung. Sie folgt durchgängig einer Leitidee: keine neuen Bindungen, Bestehendes läuft unverändert weiter. Deaktivierte Entitäten können reaktiviert werden.

- Ein deaktivierter **Studiengang** nimmt keine neuen Kurse mehr auf. Bestehende Kurse, ihre Blockpläne und deren Veröffentlichung bleiben unberührt.
- Ein deaktivierter **Bereich** nimmt keine neuen Studiengänge und keine neuen Blockpläne mehr auf. Bestehende Blockpläne bleiben bearbeitbar, veröffentlichbar und öffentlich sichtbar; die Bereichszuordnungen der Konten bleiben bestehen.
- Ein deaktiviertes **internes Konto** kann sich nicht anmelden; laufende Sitzungen enden sofort. Seine Einträge in der Auditspur bleiben unverändert.

## Internes Konto

Ein von der Systemadministration angelegtes Konto für eine interne Person, eindeutig identifiziert über ihre dienstliche E-Mail-Adresse. Selbstregistrierung ist nicht vorgesehen. Konten werden deaktiviert statt gelöscht.

Ein internes Konto trägt höchstens eine fachliche Rolle — Studiengangsleitung oder Studiengangsmanagement — und eine Menge zugeordneter Bereiche; die fachliche Rolle gilt in allen zugeordneten Bereichen gleich. Unabhängig davon kann ein Konto das Merkmal Systemadministration tragen, zusätzlich zu einer fachlichen Rolle oder ohne. Jedes Konto besitzt mindestens eine der beiden Berechtigungen.

## Studiengangsmanagement

Eine interne Rolle, die ausschließlich in ihren zugeordneten Bereichen wirkt. Sie darf dort:

- Kurse anlegen und bearbeiten,
- noch nicht veröffentlichte Kurse einem Blockplan zuordnen und von ihm lösen,
- Blockplanentwürfe anlegen und bearbeiten,
- die Auditspur der Blockpläne und Kurse ihrer Bereiche einsehen.

Sie darf keine Kurse löschen, keine Blockpläne löschen und weder veröffentlichen noch zurücknehmen.

## Studiengangsleitung

Eine interne Rolle, die ausschließlich in ihren zugeordneten Bereichen wirkt. Sie darf dort alles, was das Studiengangsmanagement darf, und zusätzlich:

- noch nicht veröffentlichte Kurse löschen,
- noch nie veröffentlichte Blockpläne löschen,
- Blockpläne veröffentlichen und Veröffentlichungen zurücknehmen.

## Systemadministration

Eine globale interne Superuser-Berechtigung. Sie darf alles, was Studiengangsleitung und Studiengangsmanagement dürfen, jedoch in allen Bereichen, und zusätzlich systemweit:

- Bereiche und Studiengänge anlegen, pflegen, deaktivieren und reaktivieren,
- interne Konten anlegen, Rollen und Bereichszuordnungen ändern sowie Konten deaktivieren und reaktivieren,
- die vollständige Auditspur einschließlich der Kontoereignisse einsehen.

## Externe Nutzende

Nicht angemeldete oder nicht intern berechtigte Personen. Sie dürfen ausschließlich die veröffentlichten Fassungen von Blockplänen einsehen.

## Auditspur

Die interne Nachvollziehbarkeit fachlicher und administrativer Ereignisse mit Zeitpunkt, handelndem Konto und betroffener Entität. Einträge werden nur angefügt und weder verändert noch gelöscht. Die Auditspur ist kein wiederherstellbares Revisionsarchiv; einzelne Speichervorgänge an einem Entwurf sind keine Auditereignisse, sondern werden als abgeleitete Angabe „zuletzt geändert“ am Entwurf geführt.

Erfasst werden:

- bei Blockplänen die Erstellung, Veröffentlichung, Zurücknahme und das Löschen eines nie veröffentlichten Blockplans,
- bei Kursen die Erstellung, das Zuordnen zu einem Blockplan, das Lösen von einem Blockplan und das Löschen,
- bei Bereichen und Studiengängen die Deaktivierung und Reaktivierung,
- bei internen Konten die Anlage, Aktivierung, Deaktivierung und Reaktivierung, Änderungen von Rolle oder Bereichszuordnungen sowie die Erzeugung von Aktivierungs- oder Reset-Links.

Geheimnisse wie Tokenwerte oder Passwörter werden nie erfasst.

Die Systemadministration sieht die vollständige Auditspur. Studiengangsleitung und Studiengangsmanagement sehen die Blockplan- und Kursereignisse ihrer zugeordneten Bereiche, nicht jedoch Kontoereignisse.
