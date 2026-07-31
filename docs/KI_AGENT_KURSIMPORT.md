# Auftrag für KI-Agents: Kurse aus PDFs als Planungsstand importieren

Dieses Dokument ist ein Auftragstext, kein Bestandteil der Anwendung. Der Import aus PDFs ist ausdrücklich [nicht Teil des MVP](MVP-SPEZIFIKATION.md); die Ersterfassung über die Anwendung erfolgt manuell. Der Auftrag dient allein der einmaligen Übernahme bestehender Blockplan-PDFs in eine leere Datenbank.

Er ist absichtlich eigenständig und wiederholt deshalb die fachlichen Regeln, statt zu verweisen: Er kann zusammen mit einem oder mehreren Blockplan-PDFs an einen KI-Agenten gegeben werden, der weder dieses Projekt noch dessen Quellcode kennt. Maßgeblich bleiben [`FACHLICHE_REGELN.md`](FACHLICHE_REGELN.md) und [`../CONTEXT.md`](../CONTEXT.md); ändern sich die Regeln dort, ist der Auftragstext nachzuziehen.

Der Agent erzeugt ausschließlich nicht veröffentlichte Kurse mit ihrem **Planungsstand** — Kursverlauf und prüfungsrelevante Termine. Er darf keinen Veröffentlichungszeitpunkt setzen und keine Tabellen oder Stammdaten verändern.

„Vorlage“ meint in diesem Repository stets den bestehenden Kurs, aus dem eine [Übernahme](../CONTEXT.md) kopiert. Dieses Dokument verwendet den Begriff deshalb nicht für sich selbst.

## Eingaben für den Auftrag

Vor dem Prompt müssen die folgenden technischen Zielwerte gesetzt werden. Sie können nicht verlässlich aus einem PDF abgeleitet werden.

```yaml
ziel:
  # Studiengangskürzel -> ID und Anzahl Semester. Die ID lautet stets `program-` plus
  # das kleingeschriebene Kürzel; die Anzahl Semester steht in `SEED-DATEN.md`.
  programs:
    TIF: { id: "program-tif", semesters: 6 }
    WWI: { id: "program-wwi", semesters: 6 }
  # Erforderlich: die Kennung des internen Kontos, das als zuletzt ändernd hinterlegt wird.
  # Sie ist eine UUID und muss aus der Datenbank abgelesen werden.
  updated_by_account_id: "6f5b2e0c-1d3a-4f7b-9c8e-2a4d6b8f0c13"
  updated_at: "2026-07-29T10:00:00.000Z"
  # Eindeutiger, nur für diesen Import verwendeter Präfix.
  id_prefix: "import-2026-10-szi-01"
```

Der Bereich wird nicht gesondert angegeben: Er ergibt sich aus dem Studiengang des Kurses.

Die PDFs selbst sind die Quelle für Kurse, Daten, Theorie- und Praxisphasen und prüfungsrelevante Termine. Fehlt eine der nötigen Angaben oder ist sie mehrdeutig, darf der Agent keine Annahme treffen.

## Auftragstext

Ersetze den Konfigurationsblock durch die tatsächlichen Werte, füge die betreffenden PDFs an und übergib anschließend den gesamten folgenden Text als Prompt.

````text
Du bist ein Datenimport-Agent. Erzeuge aus den angehängten Blockplan-PDFs ein SQLite-SQL-Skript für die darin beschriebenen Kurse mit ihrem vollständigen Planungsstand.

## Zielkonfiguration

```yaml
ziel:
  programs:
    "{{STUDIENGANGSKUERZEL_1}}": { id: "{{PROGRAM_ID_1}}", semesters: {{6_ODER_7}} }
  updated_by_account_id: "{{ACCOUNT_ID}}"
  updated_at: "{{ISO_8601_UTC_TIMESTAMP}}"
  id_prefix: "{{EINDEUTIGER_IMPORT_PREFIX}}"
```

## Auftrag

1. Lies alle angehängten PDFs vollständig.
2. Extrahiere je Kurs die Kurskennung, das Studiengangskürzel, Studienbeginn und Studienende, jede Theorie- und Praxisphase sowie jeden prüfungsrelevanten Termin.
3. Erzeuge ausschließlich nicht veröffentlichte Kurse. `published_at` muss `NULL` sein.
4. Antworte nur mit den zwei unten beschriebenen Abschnitten: zuerst dem SQL-Skript, danach dem Prüfbericht. Erkläre nichts außerhalb dieser Abschnitte.

## Verbindliches Zieldatenmodell (SQLite)

Stammdaten existieren bereits und dürfen nicht verändert werden:

```sql
areas(
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  normalized_name TEXT NOT NULL UNIQUE CHECK (length(trim(normalized_name)) > 0)
)
programs(
  id TEXT PRIMARY KEY NOT NULL,
  area_id TEXT NOT NULL REFERENCES areas(id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  abbreviation TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(abbreviation)) BETWEEN 1 AND 20),
  semesters INTEGER NOT NULL CHECK (semesters IN (6, 7))
)
```

Dasselbe gilt für `users`, die Tabelle der internen Konten. Aus ihr wird nur `id` gebraucht, und zwar als der eine Wert `ziel.updated_by_account_id`. Die Fremdschlüssel sind beim Einspielen aktiv, deshalb muss dieses Konto bereits bestehen.

Folgende Tabellen dürfen befüllt werden:

```sql
courses(
  id TEXT PRIMARY KEY NOT NULL,
  program_id TEXT NOT NULL REFERENCES programs(id),
  code TEXT NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 32),
  normalized_code TEXT NOT NULL UNIQUE CHECK (length(trim(normalized_code)) > 0),
  study_start TEXT NOT NULL CHECK (date(study_start) IS NOT NULL AND date(study_start) = study_start),
  study_end TEXT NOT NULL CHECK (date(study_end) IS NOT NULL AND date(study_end) = study_end),
  published_at TEXT,
  updated_at TEXT NOT NULL,
  updated_by_account_id TEXT NOT NULL REFERENCES users(id),
  CHECK (study_start < study_end)
)

course_phases(
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL CHECK (typeof(semester) = 'integer' AND semester BETWEEN 1 AND 7),
  phase_type TEXT NOT NULL CHECK (phase_type IN ('THEORY', 'PRACTICE')),
  start_date TEXT NOT NULL CHECK (date(start_date) IS NOT NULL AND date(start_date) = start_date),
  end_date TEXT NOT NULL CHECK (date(end_date) IS NOT NULL AND date(end_date) = end_date),
  CHECK (start_date <= end_date)
)

course_events(
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 1 AND length(title) <= 160),
  description TEXT CHECK (description IS NULL OR (length(trim(description)) >= 1 AND length(description) <= 2000)),
  category TEXT NOT NULL CHECK (category IN ('REGISTRATION', 'SUBMISSION', 'PRESENTATION', 'EXAM', 'OTHER')),
  start_date TEXT NOT NULL CHECK (date(start_date) IS NOT NULL AND date(start_date) = start_date),
  end_date TEXT CHECK (end_date IS NULL OR (date(end_date) IS NOT NULL AND date(end_date) = end_date)),
  provisional INTEGER NOT NULL DEFAULT 0 CHECK (provisional IN (0, 1)),
  CHECK (end_date IS NULL OR start_date <= end_date)
)
```

Jede Kursphase und jeder Termin gehört genau einem Kurs. Es gibt keine Tabelle, die Kurse zu einer gemeinsamen Planungseinheit bündelt.

## Fachliche Regeln

- Nutze ISO-Daten im Format `YYYY-MM-DD`. Start- und Enddaten sind jeweils einschließlich.
- Jeder Kurs muss einem Studiengang aus `ziel.programs` zugeordnet werden. Fehlt die Zuordnung, melde den Fehler statt SQL zu erzeugen.
- Die Kursphasen eines Kurses müssen vom Studienbeginn bis zum Studienende lückenlos und ohne Überlappung reichen. Auf eine Kursphase, die am Tag `D` endet, muss die nächste am Folgetag beginnen.
- Jedes Semester von 1 bis zur Anzahl Semester des Studiengangs kommt mindestens einmal vor. Bei einem sechssemestrigen Studiengang sind nur die Semester 1 bis 6 erlaubt, bei sieben Semestern nur 1 bis 7.
- Die Semester dürfen entlang der Zeitachse nicht abfallen. Alle Kursphasen desselben Semesters müssen zusammenhängend sein.
- Verwende für Phasentypen ausschließlich `THEORY` und `PRACTICE`. Gleichartige Kursphasen dürfen unmittelbar aufeinander folgen.
- Ein Termin gehört genau einem Kurs. Nennt das PDF einen Termin für mehrere Kurse, lege ihn je betroffenem Kurs als eigene Zeile mit gleichen Angaben an; zwischen diesen Zeilen besteht danach keine Verbindung.
- Jeder Termin muss vollständig innerhalb des Studienzeitraums seines Kurses liegen.
- Ein Termin trägt kein eigenes Semester. Es wird aus der Kursphase abgeleitet, die sein Startdatum abdeckt.
- `end_date` bleibt `NULL`, wenn der Termin genau einen Kalendertag umfasst; nur ein mehrtägiger Termin trägt ein Enddatum. Wiederhole niemals das Startdatum als Enddatum.
- Ordne Kategorien zwingend wie folgt zu: Anmeldung → `REGISTRATION`, Abgabe → `SUBMISSION`, Präsentation/Kolloquium → `PRESENTATION`, Prüfung/Klausur → `EXAM`, sonstige prüfungsrelevante Termine → `OTHER`.
- `provisional` ist `1` nur, wenn der Termin im PDF ausdrücklich als vorläufig markiert ist, andernfalls `0`.
- Verwende keine erfundenen Daten, Termine, Beschreibungen, Kurse oder Kursphasen. Lass `description` als `NULL`, wenn keine sinnvolle Beschreibung vorliegt.
- Setze `published_at` immer auf `NULL`.
- Setze `updated_at` und `updated_by_account_id` bei jedem Kurs auf die Werte aus `ziel`.
- Übernimm Kurskennung und Termintitel getrimmt und ohne die Zeilenumbrüche und Mehrfach-Leerzeichen, die die Textentnahme aus einem PDF mitbringt: Folgen von Leerraum werden zu genau einem Leerzeichen. Dasselbe gilt für eine Beschreibung, sofern sie einzeilig ist.
- Setze `normalized_code` auf die getrimmte, kleingeschriebene Kurskennung. Sie ist systemweit eindeutig.
- Vergib nachvollziehbare, eindeutige Text-IDs ausschließlich aus `ziel.id_prefix`, zum Beispiel `{{ID_PREFIX}}-course-tif26a`, `{{ID_PREFIX}}-phase-tif26a-01` und `{{ID_PREFIX}}-event-tif26a-01`.

## Erforderliches SQL-Format

Das SQL muss genau diese Struktur haben:

```sql
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

INSERT INTO courses (...) VALUES (...), (...);
INSERT INTO course_phases (...) VALUES (...), (...);
INSERT INTO course_events (...) VALUES (...), (...);

COMMIT;
```

Verwende immer explizite Spaltenlisten. Schreibe SQL-Zeichenketten mit einfachen Anführungszeichen und maskiere enthaltene Apostrophe durch Verdopplung. Verwende keine `INSERT OR IGNORE`, keine `UPDATE`, kein `DELETE`, keine DDL-Anweisungen und keine Platzhalter.

## Ausgabeformat

### SQL
```sql
...vollständiges ausführbares Skript...
```

### Prüfbericht

- PDFs: <Dateinamen>
- Kurse: <Kurskennung → Studiengangskürzel → Studienzeitraum>
- Kursphasen: <Anzahl je Kurs und Abdeckung von Studienbeginn bis Studienende>
- Termine: <Anzahl je Kurs>
- Ergebnis: `vollständig` oder `unvollständig`
- Offene Punkte: <keine oder präzise Liste>

Falls Informationen fehlen, mehrdeutig oder regelwidrig sind, gib unter `### SQL` keinen SQL-Code aus, sondern exakt `-- Kein Import: unvollständige oder widersprüchliche Quelldaten.`. Der Prüfbericht muss dann jeden Grund mit PDF-Seite und Fundstelle aufführen.
````

## Verwendungshinweise

- Ein Auftrag sollte die Kurse genau eines Jahrgangs enthalten. Für weitere Jahrgänge wird der Auftrag mit einem neuen `id_prefix` wiederholt.
- Die Konfiguration muss nur IDs liefern; die fachlichen Bezeichnungen werden aus den PDFs übernommen.
- Der Import erzeugt ausschließlich Planungsstände. Veröffentlicht wird anschließend in der Anwendung, je Kurs einzeln — bis dahin ist jeder importierte Kurs dort als „in Arbeit“ gekennzeichnet.
- Vor dem Einspielen sollte ein Mensch den Prüfbericht mit dem PDF vergleichen. Das Skript ist transaktional, daher wird bei einem SQL-Fehler nichts davon übernommen.
