# Vorlage für KI-Agents: Blockpläne aus PDFs als SQL-Entwurf importieren

Diese Vorlage ist absichtlich eigenständig. Sie kann zusammen mit einem oder mehreren Blockplan-PDFs an einen KI-Agenten gegeben werden, der weder dieses Projekt noch dessen Quellcode kennt.

Der Agent erzeugt ausschließlich einen **Blockplan-Entwurf**. Er darf keine Veröffentlichung erzeugen und keine Tabellen oder Stammdaten verändern.

## Eingaben für den Auftrag

Vor dem Prompt müssen die folgenden technischen Zielwerte gesetzt werden. Sie können nicht verlässlich aus einem PDF abgeleitet werden.

```yaml
ziel:
  area_id: "area-01"
  # Zuordnung aus dem bestehenden System: Studiengangskürzel -> ID und Studiendauer
  programs:
    TIF: { id: "program-01", semesters: 6 }
    WWI: { id: "program-02", semesters: 6 }
  # NULL ist zulässig, wenn kein bearbeitendes Konto hinterlegt werden soll.
  draft_updated_by_account_id: null
  draft_updated_at: "2026-07-27T10:00:00.000Z"
  # Eindeutiger, nur für diesen Import verwendeter Präfix.
  id_prefix: "import-2026-10-szi-01"
```

Die PDFs selbst sind die Quelle für Kurse, Daten, Theorie-/Praxisphasen und prüfungsrelevante Termine. Fehlt eine der nötigen Angaben oder ist sie mehrdeutig, darf der Agent keine Annahme treffen.

## Prompt-Vorlage

Ersetze den Konfigurationsblock durch die tatsächlichen Werte, füge die betreffenden PDFs an und übergib anschließend den gesamten folgenden Prompt.

````text
Du bist ein Datenimport-Agent. Erzeuge aus den angehängten Blockplan-PDFs ein SQLite-SQL-Skript für genau einen vollständigen Blockplan-Entwurf.

## Zielkonfiguration

```yaml
ziel:
  area_id: "{{AREA_ID}}"
  programs:
    "{{STUDIENGANGSKUERZEL_1}}": { id: "{{PROGRAM_ID_1}}", semesters: {{6_ODER_7}} }
  draft_updated_by_account_id: {{ACCOUNT_ID_ODER_NULL}}
  draft_updated_at: "{{ISO_8601_UTC_TIMESTAMP}}"
  id_prefix: "{{EINDEUTIGER_IMPORT_PREFIX}}"
```

## Auftrag

1. Lies alle angehängten PDFs vollständig. Sie beschreiben zusammen genau einen Blockplan.
2. Extrahiere Kurskennungen, Studiengangskürzel, Studienbeginn und Studienende, jede Theorie- und Praxisphase sowie jeden prüfungsrelevanten Termin.
3. Erzeuge ausschließlich Daten für einen **Entwurf**. Es dürfen keine Zeilen in `published_versions`, `published_course_snapshots`, `published_phases`, `published_events` oder `published_event_courses` entstehen.
4. Antworte nur mit den zwei unten beschriebenen Abschnitten: zuerst dem SQL-Skript, danach dem Prüfbericht. Erkläre nichts außerhalb dieser Abschnitte.

## Verbindliches Zieldatenmodell (SQLite)

Stammdaten existieren bereits und dürfen nicht verändert werden:

```sql
areas(id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE)
programs(
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES areas(id),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL UNIQUE,
  semesters INTEGER NOT NULL CHECK (semesters IN (6, 7))
)
```

Folgende Tabellen dürfen befüllt werden:

```sql
block_plans(
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES areas(id),
  name TEXT,
  normalized_name TEXT,
  has_ever_been_published INTEGER NOT NULL DEFAULT 0,
  draft_updated_at TEXT NOT NULL,
  draft_updated_by_account_id TEXT REFERENCES user(id)
)

courses(
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id),
  block_plan_id TEXT REFERENCES block_plans(id),
  code TEXT NOT NULL,
  normalized_code TEXT NOT NULL UNIQUE,
  study_start TEXT NOT NULL,
  study_end TEXT NOT NULL,
  CHECK (study_start < study_end)
)

draft_phases(
  id TEXT PRIMARY KEY,
  block_plan_id TEXT NOT NULL REFERENCES block_plans(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id),
  semester INTEGER NOT NULL,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('THEORY', 'PRACTICE')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  CHECK (start_date <= end_date)
)

draft_events(
  id TEXT PRIMARY KEY,
  block_plan_id TEXT NOT NULL REFERENCES block_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('REGISTRATION', 'SUBMISSION', 'PRESENTATION', 'EXAM', 'OTHER')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  provisional INTEGER NOT NULL DEFAULT 0,
  CHECK (end_date IS NULL OR start_date <= end_date)
)

draft_event_courses(
  event_id TEXT NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id),
  PRIMARY KEY (event_id, course_id)
)
```

## Fachliche Regeln

- Nutze ISO-Daten im Format `YYYY-MM-DD`. Start- und Enddaten sind jeweils einschließlich.
- Ein Kurs muss vollständig einem Studiengang aus `ziel.programs` zugeordnet werden. Fehlt die Zuordnung, melde den Fehler statt SQL zu erzeugen.
- Alle Kurse dieses Blockplans müssen zum vorgegebenen `area_id`, zum selben Startjahr und zu Studiengängen mit derselben Semesteranzahl gehören.
- Ein Kurs hat mindestens eine Phase in jedem Semester. Bei einem sechssemestrigen Studiengang sind nur die Semester 1 bis 6 erlaubt; bei sieben Semestern nur 1 bis 7.
- Die Phasen eines Kurses müssen vom Studienbeginn bis zum Studienende lückenlos und ohne Überlappung reichen. Auf eine Phase, die am Tag `D` endet, muss die nächste am Folgetag beginnen.
- Die Semester dürfen entlang der Zeitachse nicht abfallen. Alle Phasen desselben Semesters müssen zusammenhängend sein.
- Verwende für Phasentypen ausschließlich `THEORY` und `PRACTICE`.
- Jeder Termin benötigt mindestens einen betroffenen Kurs. Verknüpfe ihn deshalb über `draft_event_courses` mit allen im PDF genannten Kursen.
- Ein Termin darf nur Kurse dieses Blockplans betreffen und muss vollständig innerhalb des Studienzeitraums jedes betroffenen Kurses liegen.
- Ordne Kategorien zwingend wie folgt zu: Anmeldung → `REGISTRATION`, Abgabe → `SUBMISSION`, Präsentation/Kolloquium → `PRESENTATION`, Prüfung/Klausur → `EXAM`, sonstige prüfungsrelevante Termine → `OTHER`.
- `provisional` ist `1` nur, wenn der Termin im PDF ausdrücklich als vorläufig markiert ist, andernfalls `0`.
- Verwende keine erfundenen Daten, Termine, Beschreibungen, Kurse oder Phasen. Lass `description` als `NULL`, wenn keine sinnvolle Beschreibung vorliegt.
- Setze `has_ever_been_published` immer auf `0`. Füge keine Veröffentlichungstabellen ein.
- Vergib nachvollziehbare, eindeutige Text-IDs ausschließlich aus `ziel.id_prefix`, zum Beispiel `{{ID_PREFIX}}-plan`, `{{ID_PREFIX}}-course-tif26a`, `{{ID_PREFIX}}-phase-tif26a-01` und `{{ID_PREFIX}}-event-01`.
- Setze `normalized_code` auf die kleingeschriebene Kurskennung. Setze `normalized_name` auf die kleingeschriebene, getrimmte Blockplanbezeichnung mit einfachen Leerzeichen. Wenn der PDF keine echte Blockplanbezeichnung enthält, setze beide Namensspalten des Blockplans auf `NULL`.

## Erforderliches SQL-Format

Das SQL muss genau diese Struktur haben:

```sql
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

INSERT INTO block_plans (...) VALUES (...);
INSERT INTO courses (...) VALUES (...), (...);
INSERT INTO draft_phases (...) VALUES (...), (...);
INSERT INTO draft_events (...) VALUES (...), (...);
INSERT INTO draft_event_courses (...) VALUES (...), (...);

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
- Phasen: <Anzahl je Kurs und Abdeckung von Studienbeginn bis Studienende>
- Termine: <Anzahl und zugeordnete Kurskennungen>
- Ergebnis: `vollständig` oder `unvollständig`
- Offene Punkte: <keine oder präzise Liste>

Falls Informationen fehlen, mehrdeutig oder regelwidrig sind, gib unter `### SQL` keinen SQL-Code aus, sondern exakt `-- Kein Import: unvollständige oder widersprüchliche Quelldaten.`. Der Prüfbericht muss dann jeden Grund mit PDF-Seite und Fundstelle aufführen.
````

## Verwendungshinweise

- Ein Auftrag sollte genau einen Blockplan enthalten. Für weitere Pläne wird die Vorlage mit einem neuen `id_prefix` wiederholt.
- Die Konfiguration muss nur IDs liefern; die fachlichen Bezeichnungen werden aus den PDFs übernommen.
- Vor dem Einspielen sollte ein Mensch den Prüfbericht mit dem PDF vergleichen. Das Skript ist transaktional, daher wird bei einem SQL-Fehler nichts davon übernommen.
