# Blockplan-Editor: Erfassung und Seitenaufbau

Entwurfsstand vom 25.07.2026

## Ziel

Die interne Blockplanseite `/intern/blockplaene/[blockPlanId]` so umbauen, dass sie ohne Einarbeitung bedienbar ist und
das Erfassen eines vollständigen Studienverlaufs nicht durch die Oberfläche ausgebremst wird.

Zielgruppe sind Bereichsbearbeitende, die die Anwendung selten benutzen und nicht IT-affin sein müssen. Die Seite muss
sich selbst erklären; kein Ablauf darf voraussetzen, dass jemand die Domänenbegriffe schon kennt.

## Nutzungsmuster

Ein Blockplan entsteht am Stück: Der gesamte Verlauf wird in einer Sitzung erfasst, meist aus einer bestehenden
Tabelle abgetippt. Bei sechs Semestern, zwei bis drei Phasen je Semester und bis zu drei Kursen sind das
größenordnungsmäßig zwanzig Anlagevorgänge hintereinander.

Danach wird derselbe Plan über Tage bis Wochen punktuell angepasst, nach Absprache mit Kolleginnen und Kollegen.

Beide Muster teilen sich dieselbe Oberfläche. Ein getrennter Erfassungsassistent entfällt deshalb: Er bräuchte für
die spätere Korrektur eine zweite Oberfläche für dieselben Daten.

## Nicht im Umfang

- **Entwurfsvorschau.** Die von `BARRIEREFREIHEIT.md` vorausgesetzte Vorschau fehlt bislang. Sie wird separat behandelt.
- **Veröffentlichung.** Freigabe-Checkliste und Bestätigung vor dem Veröffentlichen werden separat behandelt. Die
  Sektion „Veröffentlichung" bleibt unverändert.

## Seitenaufbau

Die heutigen sieben gleichgewichtigen Sektionen werden nach Nutzungshäufigkeit geordnet:

```
Kopf      Bezeichnung, Bereich, Jahrgang, Kurskennungen,
          Studienzeitraum, Veröffentlichungszustand,
          letzte Entwurfsänderung
1.        Kursphasen
2.        Prüfungsrelevante Termine
3.        Veröffentlichung          (unverändert)
4.  ▸     Planeinstellungen         (zugeklappt)
              Bezeichnung ändern
              Kurse zuordnen und lösen
              Blockplan löschen
```

**Der Arbeitsbereich beginnt sofort.** Die Sektionen „Bezeichnung" (`page.tsx:103-106`) und „Kurse"
(`page.tsx:108-126`) verlassen die erste Bildschirmhälfte. Beides geschieht einmal beim Anlegen.

**Bezeichnung, Kurszuordnung und Löschen wandern gemeinsam ans Seitenende**, zugeklappt unter „Planeinstellungen".
Damit verliert auch die Löschen-Sektion (`page.tsx:194-199`) ihre Dauerpräsenz.

**Der Studienzeitraum rückt in den Kopf.** Er ist die harte Grenze, gegen die `assertPhaseWithinStudyPeriod` jede Phase
prüft, und gehört beim Eintippen ins Blickfeld statt in eine ausgeklappte Kurstabelle. Bei abweichenden Zeiträumen der
zugeordneten Kurse wird je Kurs eine Zeile ausgegeben.

## Kursphasen-Sektion

```
Kursphasen
Semester  [1 ✓] [2 ✓] [3 •] [4 ✓] [5 –] [6 –]
          Semester 3 · 2 Kursphasen · jeder Kurs hat hier
          mindestens eine Kursphase

┈┈ Vor diesem Semester ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
WWI24A   Sem. 2 · Praxis    … – Fr 06.03.2027  → Sem. 2
WWI24B   Sem. 2 · Praxis    … – Fr 06.03.2027  → Sem. 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WWI24A   Theorie  Mo 09.03.2027 – Fr 19.06.2027 ▸ Bearbeiten
WWI24B   Theorie  Mo 09.03.2027 – Fr 19.06.2027 ▸ Bearbeiten
┈┈ Nach diesem Semester ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
WWI24A   Sem. 4 · Theorie  Mo 14.09.2027 – …    → Sem. 4
         Zwischen 19.06. und 14.09.2027 sind 86 Tage
         noch keiner Kursphase zugeordnet.

Nächste Kursphase anlegen
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[✓] Die Kursphasen wurden angelegt: WWI24A und WWI24B,
    Theorie vom 09.03. bis 19.06.2027.

Kurse       [x] WWI24A   [x] WWI24B
Semester    [ Semester 3        ▾ ]
Phasentyp   [ Praxis            ▾ ]
Startdatum  [ 22.06.2027          ]  Dienstag
Enddatum    [ ▮                   ]

            [ Anlegen und nächste erfassen ]
```

### Randkontext

Die Liste zeigt zusätzlich zum gewählten Semester je Kurs die letzte Kursphase davor und die erste danach, optisch und
per Überschrift abgesetzt und nicht bearbeitbar, jeweils mit Sprunglink in das zugehörige Semester. Heute filtert
`page.tsx:84` hart auf das gewählte Semester und blendet damit genau die Information aus, die zum Weiterplanen nötig
ist.

Existieren Kursphasen vor und nach dem gewählten Semester, wird die dazwischen unverplante Tagesspanne beziffert. Beim
Nachjustieren ist das die aussagekräftigste Zahl der Seite.

### Erfassungsrhythmus

Nach erfolgreichem Anlegen bleibt das Formular stehen, die Seite scrollt nicht an den Anfang, und die Felder sind für
die nächste Kursphase vorbelegt:

| Feld | Verhalten nach dem Speichern |
| --- | --- |
| Kurse | unverändert |
| Semester | unverändert (das geöffnete Semester) |
| Phasentyp | gekippt gegenüber der Vorgängerphase |
| Startdatum | Enddatum der Vorgängerphase plus ein Tag |
| Enddatum | immer geleert |

Den Fokus erhält das erste leere Pflichtfeld: bei eindeutiger Vorbelegung das Enddatum, sonst das Startdatum.

**Vorgängerphase** ist je Kurs die Kursphase mit dem spätesten Enddatum unter allen Kursphasen mit einer
Semesternummer kleiner oder gleich dem gewählten Semester. Damit greift die Vorbelegung sowohl beim Fortschreiben
innerhalb eines Semesters als auch beim Übergang aus dem Vorsemester.

**Vorbelegt wird nur bei Eindeutigkeit.** Das Formular hat ein Startdatum für alle ausgewählten Kurse, weil
`createDraftPhases` je Kurs eine eigenständige Phase mit gleichen Angaben anlegt. Enden die Vorgängerphasen der
ausgewählten Kurse an verschiedenen Tagen, bleibt Startdatum leer und ein Hinweis nennt die abweichenden Daten je
Kurs. Dasselbe gilt für den Phasentyp. Eine falsche Vorbelegung, die nur für einen Kurs stimmt, wäre teurer als ein
leeres Feld.

**Die Vorbelegung rechnet der Server.** Die Action liefert sie im Erfolgsstate mit, statt sie im Formular zu
ermitteln. Damit liegt die Anschlusslogik als reine Funktion in `lib/domain/` und ist testbar.

### Darstellung der Kalendertage

In Listen mit vorangestelltem Wochentag: `Mo 09.03.2027 – Fr 19.06.2027`. Ein `<input type="date">` zeigt selbst das
Gebietsschema des Browsers; dort steht der Wochentag als Hinweistext neben dem Feld und aktualisiert sich beim Tippen.
Da Blöcke praktisch immer montags beginnen und freitags enden, deckt der Wochentag Zahlendreher sofort auf.

Die heutige Ausgabe roher ISO-Werte (`page.tsx:152`, `page.tsx:23-25`) entfällt.

### Semester-Navigation

Aus der Linkliste mit ausformuliertem Status je Semester (`page.tsx:131-138`) wird eine Leiste mit Kurzstatus:
„vollständig", „1 Kurs ohne Kursphase", „Fehler: überlappende Kursphasen". Der ausführliche Satz aus
`semesterStatusText` bleibt, aber nur für das geöffnete Semester.

Der Semesterparameter bleibt in der URL, damit Deep-Links und Vor-/Zurück-Navigation denselben Zustand
wiederherstellen (`BARRIEREFREIHEIT.md`).

## Termine-Sektion

```
Prüfungsrelevante Termine

Fr 12.06.2026 · Prüfung
Klausur Programmieren II
WWI24A, WWI24B · Semester 2                ▸ Bearbeiten

Mo 22.06. – Fr 26.06.2026 · Präsentation · Vorläufig
Projektpräsentationen
WWI24A · Semester 2                        ▸ Bearbeiten

Mi 15.07.2026 · Abgabe
Projektarbeit
WWI24A, WWI24B · Semester noch nicht ableitbar
  Für den 15.07.2026 fehlt beiden Kursen eine Kursphase.
  Semester 3 anlegen →

Neuen Termin anlegen
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[✓] Der Termin „Klausur Programmieren II" wurde angelegt.

Titel        [ ▮                    ]
Beschreibung [                      ]
Kategorie    [ Prüfung           ▾ ]
Startdatum   [                      ]
Enddatum     [                      ]
[ ] Zeitangabe ist vorläufig
Kurse        [x] WWI24A  [x] WWI24B

             [ Anlegen und nächsten erfassen ]
```

**Felder werden nach dem Anlegen geleert.** Heute bleibt der getippte Titel stehen, weil `EventFields` auf
`defaultValue={values?.title ?? event?.title}` (`event-forms.tsx:24`) setzt und `values` nur im Fehlerfall gefüllt
wird. Beim Erfassen mehrerer Termine hintereinander führt das leicht zu Duplikaten. Künftig werden Titel, Beschreibung
und beide Daten geleert; Kategorie, Vorläufig-Haken und Kursauswahl bleiben stehen, weil aufeinanderfolgende Termine
meist dieselbe Kategorie und dieselben Kurse betreffen.

**Die Semesterangabe wird zusammengefasst.** `affectedCourseLabels` (`page.tsx:31-37`) erzeugt heute je Kurs einen
eigenen Satz, sodass der Hinweis „Semester noch nicht ableitbar — für den Starttag fehlt eine Kursphase" bei drei
Kursen dreimal nebeneinander steht. Künftig werden Kurse mit gleichem abgeleitetem Semester gebündelt
(„WWI24A, WWI24B · Semester 2"), und der Erklärsatz erscheint einmal darunter — mit Sprunglink in das Semester, in
dem die Kursphase fehlt.

**Kein Semesterfilter.** Die Terminliste bleibt chronologisch und ungefiltert (`data.ts:30`); das Semester steht in
jeder Zeile. `BARRIEREFREIHEIT.md` verlangt ausdrücklich, dass die Semesterzugehörigkeit benannt und nicht durch
räumliche Gruppierung impliziert wird.

## Listen statt Tabellen

Kursphasen und Termine stehen heute in `<table>`-Elementen mit horizontalem Scrollcontainer (`page.tsx:148`,
`page.tsx:168`), gefolgt von einer zweiten Darstellung derselben Daten als aufklappbare Editor-Karten
(`page.tsx:156`, `page.tsx:179`). Diese Doppelung entfällt: Jeder Eintrag erscheint einmal, mit eigenem
Bearbeiten-Aufklapper.

Beide Sektionen werden dabei zu Listen. Ein Formular in einer Tabellenzelle bräuchte `colspan`-Konstruktionen und wäre
bei den geforderten 320 CSS-Pixeln kaum bedienbar; beides sind ohnehin Listen von Einträgen und keine Matrizen. Echte
Tabellensemantik bleibt der öffentlichen `PlanMatrix` vorbehalten, für die `BARRIEREFREIHEIT.md` sie verlangt.

`CollapsibleEditor` und `ConfirmDeleteForm` (`components/editor-controls.tsx`) bleiben unverändert; sie sitzen künftig
im Listeneintrag statt darunter.

## Neue Domänenfunktionen

### `lib/domain/phase-sequence.ts`

Beide Funktionen arbeiten auf Kursphasen mit Kurskennung. Der dafür passende Typ `PlanPhase` liegt heute in
`app/intern/blockplaene/data.ts:9`; er wandert nach `lib/domain/publication.ts` neben `DraftPhase`, damit die
Domänenschicht nicht aus `app/` importiert.

```ts
export type NextPhaseDefaults = {
  courseIds: string[];
  semester: string;
  type: string;      // leer, wenn die Vorgängerphasen uneinheitlich sind
  startDate: string; // leer, wenn die Vorgängerphasen uneinheitlich enden
  endDate: "";
  /** Je Kurs das abweichende Enddatum, wenn keine eindeutige Vorbelegung möglich war. */
  ambiguousPredecessors: { code: string; endDate: string }[];
};

export function nextPhaseDefaults(input: {
  phases: PlanPhase[];
  courseIds: string[];
  semester: number;
}): NextPhaseDefaults;

export type PhaseNeighbour = {
  code: string;
  semester: number;
  type: PhaseType;
  startDate: string;
  endDate: string;
};

export type SemesterContext = {
  /** Je Kurs die letzte Kursphase mit kleinerer Semesternummer. */
  before: PhaseNeighbour[];
  /** Je Kurs die erste Kursphase mit größerer Semesternummer. */
  after: PhaseNeighbour[];
  /** Je Kurs die unverplante Spanne zwischen dem bisher Erfassten und dem Folgesemester. */
  unplanned: { code: string; from: string; to: string; days: number }[];
};

export function semesterContext(input: {
  courses: { id: string; code: string }[];
  phases: PlanPhase[];
  semester: number;
}): SemesterContext;
```

`unplanned` enthält einen Eintrag nur, wenn für den Kurs sowohl eine Kursphase mit Semesternummer kleiner oder gleich
der gewählten als auch eine mit größerer existiert und dazwischen mindestens ein Tag unbelegt ist. `from` ist das
Enddatum der früheren, `to` das Startdatum der späteren Kursphase; `days` zählt die Tage echt dazwischen.

### `lib/domain/calendar-format.ts`

```ts
export function formatCalendarDay(day: string, options?: { weekday?: boolean }): string;
export function formatCalendarPeriod(startDate: string, endDate: string, options?: { weekday?: boolean }): string;
export function weekdayName(day: string): string;
export function daysBetween(from: string, to: string): number;
```

Kalendertage sind zeitzonenlos (`lib/domain/calendar-day.ts`), die Formatierung rechnet daher durchgehend in UTC.
`formatPeriod` aus `components/plan-matrix.tsx:8-13` wird hierher gezogen und von der öffentlichen Ansicht ohne
Wochentag, vom Editor mit Wochentag verwendet.

## Umstellung der Server Actions

Der Erfassungsrhythmus setzt voraus, dass Speichern keine Navigation auslöst. `createPhasesAction` (`actions.ts:172`),
`updatePhaseAction` (`actions.ts:185`), `deletePhaseAction` (`actions.ts:198`) und `deleteEventAction`
(`actions.ts:138`) enden heute mit `redirect` und erzeugen damit den Sprung an den Seitenanfang.
`createEventAction` (`actions.ts:112`) zeigt bereits das Zielmuster: State zurückgeben, `revalidatePath` aktualisiert
die Serverdaten ohne Navigation.

Alle vier Actions werden darauf umgestellt. Die Statusparameter `?kursphasen-angelegt=…`, `?kursphase-gespeichert=1`,
`?kursphase-geloescht=1` und `?termin-geloescht=1` entfallen samt ihrer Auswertung in `page.tsx:66-90`, damit nach
Neuladen oder Zurück-Navigation keine veraltete Erfolgsmeldung stehen bleibt.

Zwei Parameter bleiben: der Semesterparameter, und `?angelegt=1` aus `createBlockPlanFromCourseAction`
(`actions.ts:47`). Letzterer begleitet einen echten Routenwechsel aus der Kursverwaltung heraus und hat kein Formular,
in dem die Meldung sonst stehen könnte.

Der Zustandstyp wächst um zwei Felder:

```ts
export type PhaseFormState = EditorFormState<PhaseField, PhaseInput> & {
  next?: NextPhaseDefaults;
  /** Gesetzt, wenn eine Änderung die Kursphase in ein anderes Semester verschoben hat. */
  movedToSemester?: number;
  /** Wechselt bei jedem erfolgreichen Speichern und setzt die unkontrollierten Felder zurück. */
  token?: string;
};
```

`values` behält seine heutige Bedeutung „abgelehnte Eingabe wiederherstellen" (`actions.ts:15-19`).

`EventFormState` erhält dasselbe `token`, damit `CreateEventForm` seine Felder leeren kann.

Das `token` ist nötig, weil die Formulare unkontrollierte Felder mit `defaultValue` verwenden: Nach `revalidatePath`
liefert die Server-Komponente zwar neue Props, die gemounteten Felder behalten aber ihren alten Wert. Das Formular
wird deshalb über `key={state.token ?? "initial"}` neu gemountet. Als Token dient die ID der ersten neu angelegten
Kursphase beziehungsweise des neuen Termins.

## Komponentenstruktur

```
PhaseSection (Client)
├── Statusfläche (role="status")      Meldungen aller Kind-Aktionen
├── SemesterNav                       Links mit ?semester=
├── Randkontext „Vor diesem Semester"
├── PhaseEntry × n
│   └── CollapsibleEditor
│       ├── EditPhaseForm
│       └── DeletePhaseForm
├── Randkontext „Nach diesem Semester" samt unverplanter Spanne
└── CreatePhasesForm

EventSection (Client)
├── Statusfläche (role="status")
├── EventEntry × n
│   └── CollapsibleEditor
│       ├── EditEventForm
│       └── DeleteEventForm
└── CreateEventForm
```

Die gemeinsame Statusfläche auf Sektionsebene ist keine Kosmetik, sondern folgt aus dem Wegfall der Redirects: Beim
Verschieben in ein anderes Semester oder beim Löschen verschwindet der Editor samt seinem Zustand — genau dies
begründet heute den `redirect` (`actions.ts:154-157`). Die Kindformulare melden ihre Erfolgsmeldung deshalb per
Callback nach oben, wo sie das Unmounten überdauert.

Beim Semesterwechsel lautet die Meldung „Die Kursphase wurde nach Semester 4 verschoben" mit Sprunglink dorthin,
statt dass der Eintrag kommentarlos aus der Liste verschwindet.

`PhaseSection` und `EventSection` erhalten ihre Daten als serialisierbare Props von der Server-Komponente.

## Barrierefreiheit

Maßgeblich ist `docs/BARRIEREFREIHEIT.md`; die folgenden Punkte ergeben sich zusätzlich aus diesem Umbau.

- Die Statusfläche je Sektion ist `role="status"`, steht am Sektionskopf und wird vom Tastaturfokus nicht verdeckt.
- Nach dem Anlegen erhält das erste leere Pflichtfeld des Formulars den Fokus — bei eindeutiger Vorbelegung das
  Enddatum, sonst das Startdatum.
- Der Randkontext ist per Überschrift benannt („Vor diesem Semester", „Nach diesem Semester"), nicht allein durch
  Trennlinien oder Einrückung.
- Der Kurzstatus je Semester steht im Linktext oder in einem programmatisch zugeordneten Text, nie nur als Farbe oder
  Symbol. `aria-current="page"` für das geöffnete Semester bleibt.
- Der Wochentag am Datumsfeld ist über `aria-describedby` mit dem Feld verknüpft.
- Die unverplante Tagesspanne wird als Satz ausgegeben, nicht als isolierte Zahl.
- Die Listen bleiben bei 320 CSS-Pixeln, 200 % Textvergrößerung und 400 % Zoom vollständig bedienbar.

## Tests

Neu, mit vitest gegen die reinen Domänenfunktionen:

- `test/domain/phase-sequence.test.ts`
  - `nextPhaseDefaults`: eindeutige Vorbelegung; Typwechsel Theorie ↔ Praxis; uneinheitliche Enddaten führen zu leerem
    Startdatum und gefülltem `ambiguousPredecessors`; kein Vorgänger vorhanden; Vorgänger im Vorsemester; Vorgänger im
    gewählten Semester hat Vorrang vor dem des Vorsemesters.
  - `semesterContext`: Nachbarn je Kurs; erstes und letztes Semester ohne Nachbar auf einer Seite; unverplante Spanne
    korrekt bei Lücke, kein Eintrag bei lückenlosem Anschluss; Kurse mit abweichenden Terminen.
- `test/domain/calendar-format.test.ts`: Wochentag über Zeitzonengrenzen, gleicher Start- und Endtag,
  `daysBetween` bei direktem Anschluss (0) und über Monatsgrenzen.

Bestehende Tests in `test/domain/semester-overview.test.ts`, `test/services/phase-admin.test.ts` und
`test/services/event-admin.test.ts` bleiben unverändert gültig — an der fachlichen Logik der Services ändert sich
nichts.

## Bewusst nicht enthalten

- **Mehrzeilen-Erfassung und Verlaufsraster** über alle Semester. Beide wurden verworfen: Sie bräuchten eine zweite
  Oberfläche neben dem Einzel-Bearbeiten und wären bei 320 CSS-Pixeln schwer zugänglich zu halten.
- **Drag-and-drop-Sortierung** von Kursphasen. `BARRIEREFREIHEIT.md` verlangt gleichwertige Schaltflächen; die
  Sortierung ergibt sich ohnehin aus den Daten.
- **Änderungen am Datenmodell.** Der Umbau betrifft Darstellung, Formularverhalten und die Rückgabewerte der Actions.
  Services, Strukturregeln und Schema bleiben unberührt.
