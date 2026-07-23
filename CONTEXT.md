# Ubiquitous Language

## Regelklassen

**Strukturregeln** betreffen einzelne Objekte und ihre unmittelbaren Beziehungen: Pflichtangaben, Eindeutigkeiten, Datumsordnungen, Zuordnungsbedingungen. Sie gelten immer; ein Verstoß wird gar nicht erst gespeichert.

**Veröffentlichungsregeln** betreffen den Plan als Ganzes: lückenlose Abdeckung, Semesterfolge, Vollständigkeit der Zuordnungen. Sie gelten nur beim Veröffentlichen; ein Entwurf darf sie vorübergehend verletzen.

Die Klasse ist an der Formulierung erkennbar: Regeln, die mit „In einer veröffentlichten Fassung“ oder „Ein veröffentlichter …“ beginnen, sind Veröffentlichungsregeln, alle übrigen Strukturregeln.

## Bereich

Die organisatorische Einheit, für die interne Mitarbeitende Kurse und deren Blockpläne verwalten dürfen. Ein Bereich besitzt eine unveränderliche systemische Identität und eine erforderliche, systemweit eindeutige Bezeichnung. Er enthält einen oder mehrere Studiengänge; jeder Studiengang gehört genau einem Bereich. Interne Konten können mehreren Bereichen zugeordnet sein.

## Studiengang

Ein Studienangebot innerhalb genau eines Bereichs, zum Beispiel Informatik oder Wirtschaftsinformatik. Ein Studiengang besitzt eine unveränderliche systemische Identität, eine erforderliche Bezeichnung und ein erforderliches Kürzel wie `TIF` oder `WDS`. Das Kürzel ist systemweit eindeutig, weil die öffentliche Ansicht darüber filtert.

Die **Anzahl Semester** ist eine verpflichtende Angabe des Studiengangs und gilt für alle seine Kurse und Jahrgänge. Im MVP ist sie 6 oder 7; Architektur ist der einzige siebensemestrige Studiengang.

Ein Studiengang darf nur dann einem anderen Bereich zugeordnet werden, wenn noch kein Kurs von ihm abhängt. Blockpläne hängen nicht unmittelbar an Studiengängen, sondern über ihre Kurse; ohne Kurse des Studiengangs ist also auch kein Blockplan betroffen.

## Studienzentrum

Die an der DHBW Lörrach übliche Bezeichnung für einen Bereich mit mehreren Studiengängen, etwa das Studienzentrum IT-Management & Informatik (SZI). Das Modell kennt keine abweichenden Regeln für Studienzentren; kanonisch ist „Bereich“.

## Jahrgang

Das Kalenderjahr, in dem das Studium beginnt. Beim Kurs ist der Jahrgang keine eigene Angabe, sondern das Kalenderjahr seines Studienbeginns; beim Blockplan ist er eine eigene verpflichtende Angabe, die bei der Anlage gesetzt wird und danach unveränderlich ist. Alle Kurse eines Blockplans gehören demselben Jahrgang an.

## Kurs

Eine Gruppe von Studierenden eines Studiengangs und Jahrgangs, die vom Studienbeginn bis zum Studienende zusammenbleibt. Ein Kurs besteht auch ohne Blockplan und ist höchstens einem Blockplan zugeordnet; Kurse mit ganz oder teilweise gemeinsamem zeitlichem Verlauf dürfen denselben Blockplan teilen. „Kohorte“ ist kein kanonischer Begriff.

Ein Kurs besitzt eine unveränderliche systemische Identität und vier verpflichtende Angaben: Kurskennung, Studiengang, Studienbeginn und Studienende. Die Kurskennung ist systemweit eindeutig und verbindet Studiengang, Jahrgang und parallele Kursgruppe, zum Beispiel `TIF24A` oder `WDS24A`; sie hat kein erzwungenes Format und ist keine Datenquelle für den Jahrgang. Der verwaltende Bereich ist keine eigene Angabe, sondern der Bereich des Studiengangs; er gilt auch ohne Blockplanzuordnung.

Solange ein Kurs kein veröffentlichter Kurs ist, sind alle vier Angaben änderbar und er darf zugeordnet, gelöst und gelöscht werden. Studiengang und Studienbeginn dürfen sich nur ändern, wenn eine bestehende Blockplanzuordnung danach gültig bleibt.

Eine Zuordnung setzt voraus, dass der Studiengang des Kurses zum Bereich des Blockplans gehört, die Jahrgänge übereinstimmen und seine Anzahl Semester der der bereits zugeordneten Kurse entspricht. Beim Lösen wie beim Löschen entfallen die Kursphasen des Kurses und seine Zuordnungen zu prüfungsrelevanten Terminen desselben Blockplans; jeder verbleibende Termin muss weiterhin mindestens einen Kurs betreffen.

## Veröffentlichter Kurs

Ein Kurs, für den mindestens eine Kursphase Bestandteil einer veröffentlichten Fassung war. Maßgeblich sind die Kursphasen, nicht die Zuordnung: Diese gehört dem Blockplan und nicht einer Fassung, ein bloß zugeordneter Kurs ohne veröffentlichte Kursphasen ist also kein veröffentlichter Kurs. Veröffentlicht wird stets nur der Blockplan; der Zustand des Kurses leitet sich daraus ab und wird durch eine spätere Zurücknahme nicht aufgehoben.

Bei einem veröffentlichten Kurs sind alle vier Angaben unveränderlich; er wird weder gelöscht noch von seinem Blockplan gelöst noch einem anderen zugeordnet.

## Studienzeitraum

Der einschließlich beider Grenztage geltende Zeitraum vom Studienbeginn bis zum Studienende eines Kurses; dabei gilt Studienbeginn < Studienende.

In einer veröffentlichten Fassung decken die Kursphasen jeden Kalendertag dieses Zeitraums genau einmal ab, auch Wochenenden, Feiertage und vorlesungsfreie Tage, und keine Kursphase liegt ganz oder teilweise außerhalb davon. Die erste Kursphase beginnt damit am Studienbeginn und die letzte endet am Studienende; eine geteilte erste oder letzte Blockphase setzt entsprechend übereinstimmende Grenztage der beteiligten Kurse voraus.

## Kalendertag und Ortszeit

Start- und Enddaten sind zeitzonenlose Kalendertage im gregorianischen Kalender. Optionale Uhrzeiten prüfungsrelevanter Termine gelten in der Ortszeit `Europe/Berlin`; eine technische Umrechnung darf den zugehörigen Kalendertag nicht verändern.

## Blockplan

Eine gemeinsam verwaltete und veröffentlichte Planungseinheit für die Abfolge von Theorie- und Praxisphasen sowie die prüfungsrelevanten Termine eines oder mehrerer Kurse desselben Jahrgangs. Ein Blockplan ist strukturierte, bearbeitbare Anwendungsdaten, kein Dokument.

Er besitzt eine unveränderliche systemische Identität, eine erforderliche und innerhalb seines Bereichs und Jahrgangs eindeutige Bezeichnung, genau einen Bereich und genau einen Jahrgang. Er enthält ausschließlich Kurse aus den Studiengängen seines Bereichs; innerhalb eines Bereichs und Jahrgangs darf es mehrere Blockpläne geben.

Studiengangsübergreifend wird nur bei gleicher Semesterzahl geplant: Alle Kurse eines Blockplans gehören Studiengängen mit derselben Anzahl Semester an. Damit hat jeder Blockplan eine einheitliche Verlaufslänge, und die Planmatrix stellt nie Kurse unterschiedlicher Dauer nebeneinander.

Ein Blockplan hat einen Entwurf und höchstens eine veröffentlichte Fassung. Identität, Bereich, Jahrgang, Bezeichnung und Kurszuordnungen gehören dem Blockplan selbst und wirken sofort; Blockphasen, Kursphasen und prüfungsrelevante Termine gehören je einer Fassung. Ein Kurs kann daher zugeordnet sein, ohne in der veröffentlichten Fassung Kursphasen zu besitzen — die öffentliche Ansicht zeigt nur Kurse, die dort Kursphasen haben.

## Entwurf

Die bearbeitbare Fassung eines Blockplans, sichtbar nur für die fachlichen Rollen seines Bereichs und die Systemadministration. Er führt als abgeleitete Angabe, wann und durch welches Konto er zuletzt geändert wurde.

Ein noch nie veröffentlichter Entwurf kann gelöscht werden; die zugeordneten Kurse bleiben dabei als blockplanlose Kurse bestehen.

## Veröffentlichte Fassung

Die bewusst freigegebene Fassung eines Blockplans, die externe Nutzende sehen. Sie bleibt während der Arbeit am Entwurf sichtbar; eine neue Veröffentlichung ersetzt sie. Frühere Revisionen werden im MVP weder angezeigt noch wiederhergestellt, und ein bereits veröffentlichter Blockplan wird nicht gelöscht.

Eine Veröffentlichung ist nur möglich, wenn alle Struktur- und Veröffentlichungsregeln erfüllt sind. Sie setzt insbesondere mindestens einen Kurs voraus sowie einen über alle Semester des jeweiligen Studiengangs vollständig geplanten Verlauf jedes enthaltenen Kurses; ein nur teilweise geplanter Verlauf bleibt Entwurf.

## Zurückgenommene Veröffentlichung

Ein Blockplan, dessen veröffentlichte Fassung aus der öffentlichen Ansicht entfernt wurde. Seine Daten und sein Entwurf bleiben intern erhalten und können erneut veröffentlicht werden.

## Blockphase

Ein einmal erfasster Zeitblock innerhalb einer Fassung eines Blockplans mit Start- und Enddatum, genau einem Semester und genau einem Phasentyp. Eine Blockphase darf mehreren Kursen auch über Studiengangsgrenzen hinweg gemeinsam zugeordnet sein; unterscheiden sich Zeitraum, Semester oder Phasentyp, handelt es sich um verschiedene Blockphasen. „Phase“ und „Urlaubsphase“ sind keine kanonischen Begriffe.

Sie ist einschließlich beider Grenztage gültig; für sie gilt Startdatum ≤ Enddatum, sodass sie auch einen einzelnen Kalendertag umfassen kann. Gleichartige Blockphasen dürfen unmittelbar aufeinander folgen. Ihr Semester überschreitet die Anzahl Semester der Studiengänge ihres Blockplans nicht.

In einer veröffentlichten Fassung ist jede Blockphase mindestens einer Kursphase zugeordnet; ein Entwurf darf verwaiste Blockphasen enthalten.

## Phasentyp

Die Art des Studienabschnitts, den eine Blockphase beschreibt: **Theorie** an der Hochschule oder **Praxis** im Dualen Partnerunternehmen.

Der Phasentyp kennzeichnet den gesamten organisatorischen Abschnitt, nicht die Tätigkeit an einem einzelnen Kalendertag. Wochenenden, Feiertage und vorlesungsfreie Tage bilden deshalb keine eigene Phasenart und sind nicht automatisch Praxis, sondern tragen den Typ der sie abdeckenden Blockphase.

## Kursphase

Die Zuordnung genau eines Kurses zu genau einer Blockphase, ohne eigene Kopie von Zeitraum, Semester oder Phasentyp. Vorlesungen gehören nicht zum MVP; sie dürfen später ausschließlich Kursphasen zugeordnet werden, deren Blockphase vom Typ Theorie ist.

In einer veröffentlichten Fassung schließen die Kursphasen eines Kurses lückenlos aneinander an und überlappen sich nicht; auf das Enddatum der zugeordneten Blockphase folgt als Startdatum der nächsten der nächste Kalendertag. Ihre Semesternummern sind entlang der Zeitachse monoton nicht fallend, und alle Kursphasen desselben Semesters bilden einen zusammenhängenden Abschnitt.

## Semester

Die fortlaufende Studienperiode einer Blockphase, angegeben als ganze Zahl ab 1; eine Blockphase gehört vollständig zu genau einem Semester. Das Studienjahr wird daraus abgeleitet, indem die Semesternummer halbiert und aufgerundet wird: Semester 1 und 2 bilden Studienjahr 1, Semester 3 und 4 Studienjahr 2, Semester 5 und 6 Studienjahr 3, Semester 7 das nur halbe Studienjahr 4.

Ein veröffentlichter Kursverlauf enthält die Semester 1 bis zur Anzahl Semester seines Studiengangs jeweils mindestens einmal und in dieser Reihenfolge.

## Prüfungsrelevanter Termin

Eine Planangabe innerhalb einer Fassung eines Blockplans mit Titel, optionaler Beschreibung, Pflichtkategorie und einem Geltungsbereich von mindestens einem Kurs desselben Blockplans. Ein Blockplan darf beliebig viele — auch keine — prüfungsrelevanten Termine enthalten.

Seine Zeitangabe ist entweder ein genaues Datum mit optionaler Uhrzeit, ein beidseitig inklusiver Datumsbereich oder ein vollständiger Kalendermonat. Sie kann als **vorläufig** markiert werden; eine vorläufige Zeitangabe ist gültig und veröffentlichbar und kennzeichnet gegenüber externen Nutzenden, dass sich das Datum noch ändern kann.

In einer veröffentlichten Fassung liegt ein Termin vollständig innerhalb des Studienzeitraums jedes betroffenen Kurses.

Ein Termin trägt weder ein eigenes Semester noch eine eigene Blockphase. Sein Semester wird je betroffenem Kurs aus der Kursphase abgeleitet, die den ersten Tag seiner Zeitangabe abdeckt — bei einem genauen Datum dieser Tag, bei einem Datumsbereich dessen Beginn, bei einem Kalendermonat der Monatserste. Weil die Kursphasen einer veröffentlichten Fassung den Studienzeitraum lückenlos und überlappungsfrei abdecken und der Termin vollständig darin liegt, ist das Semester dort stets eindeutig; es darf sich zwischen den betroffenen Kursen unterscheiden. Ein Termin, der einen Semesterwechsel überspannt, gehört zum Semester seines Beginns.

Die Kategorien sind:

- **Anmeldung** — Anmeldung des Themas einer Projekt- oder Bachelorarbeit durch die Studierenden.
- **Abgabe** — Abgabetermin einer schriftlichen Leistung.
- **Präsentation** — mündliche Präsentation einer Arbeit. Abgabe und Präsentation an verschiedenen Tagen ergeben zwei Termine.
- **Prüfung** — Klausur oder mündliche Prüfung.
- **Sonstiges** — Auffangwert.

## Deaktivierung

Das Stilllegen einer Stammdatenentität anstelle ihrer Löschung, nach der Leitidee: keine neuen Bindungen, Bestehendes läuft unverändert weiter. Deaktivierte Entitäten können reaktiviert werden.

- Ein deaktivierter **Studiengang** nimmt keine neuen Kurse mehr auf.
- Ein deaktivierter **Bereich** nimmt keine neuen Studiengänge und Blockpläne mehr auf. Bestehende Blockpläne bleiben bearbeitbar, veröffentlichbar und öffentlich sichtbar; die Bereichszuordnungen der Konten bleiben bestehen.
- Ein deaktiviertes **internes Konto** kann sich nicht anmelden; laufende Sitzungen enden sofort.

## Internes Konto

Ein von der Systemadministration angelegtes Konto für eine interne Person, eindeutig identifiziert über ihre dienstliche E-Mail-Adresse. Selbstregistrierung ist nicht vorgesehen; Konten werden deaktiviert statt gelöscht.

Ein Konto trägt höchstens eine fachliche Rolle — Studiengangsleitung oder Studiengangsmanagement — die in allen seinen zugeordneten Bereichen gleich gilt. Unabhängig davon kann es das Merkmal Systemadministration tragen. Jedes Konto besitzt mindestens eine der beiden Berechtigungen.

## Studiengangsmanagement

Eine interne Rolle, die ausschließlich in ihren zugeordneten Bereichen wirkt. Sie darf dort:

- Kurse anlegen und bearbeiten,
- noch nicht veröffentlichte Kurse einem Blockplan zuordnen und von ihm lösen,
- Blockplanentwürfe anlegen und bearbeiten,
- die Auditspur der Blockpläne und Kurse ihrer Bereiche einsehen.

Sie darf weder Kurse noch Blockpläne löschen und weder veröffentlichen noch zurücknehmen.

## Studiengangsleitung

Eine interne Rolle, die ausschließlich in ihren zugeordneten Bereichen wirkt. Sie darf dort alles, was das Studiengangsmanagement darf, und zusätzlich:

- noch nicht veröffentlichte Kurse löschen,
- noch nie veröffentlichte Blockpläne löschen,
- Blockpläne veröffentlichen und Veröffentlichungen zurücknehmen.

## Systemadministration

Eine globale interne Superuser-Berechtigung. Sie darf alles, was die Studiengangsleitung darf, jedoch in allen Bereichen, und zusätzlich systemweit:

- Bereiche und Studiengänge anlegen, pflegen, deaktivieren und reaktivieren,
- interne Konten anlegen, Rollen und Bereichszuordnungen ändern sowie Konten deaktivieren und reaktivieren,
- die vollständige Auditspur einschließlich der Kontoereignisse einsehen.

## Externe Nutzende

Nicht angemeldete oder nicht intern berechtigte Personen. Sie dürfen ausschließlich veröffentlichte Fassungen einsehen.

## Auditspur

Die interne Nachvollziehbarkeit fachlicher und administrativer Ereignisse mit Zeitpunkt, handelndem Konto und betroffener Entität. Einträge werden nur angefügt und weder verändert noch gelöscht; Geheimnisse wie Tokenwerte oder Passwörter werden nie erfasst. Die Auditspur ist kein Revisionsarchiv: Einzelne Speichervorgänge sind keine Auditereignisse, sondern erscheinen als „zuletzt geändert“ am Entwurf.

Erfasst werden:

- bei Blockplänen Erstellung, Veröffentlichung, Zurücknahme und das Löschen eines nie veröffentlichten Blockplans,
- bei Kursen Erstellung, Zuordnen, Lösen und Löschen,
- bei Bereichen und Studiengängen Deaktivierung und Reaktivierung,
- bei internen Konten Anlage, Aktivierung, Deaktivierung, Reaktivierung, Änderungen von Rolle oder Bereichszuordnungen sowie die Erzeugung von Aktivierungs- oder Reset-Links.

Die Systemadministration sieht die vollständige Auditspur; die fachlichen Rollen sehen die Blockplan- und Kursereignisse ihrer Bereiche, nicht die Kontoereignisse.
