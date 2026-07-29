# Öffentliche API

Die öffentliche API liefert ausschließlich Daten veröffentlichter Kursfassungen. Sie ist schreibgeschützt, benötigt keine Anmeldung und erlaubt browserseitige Aufrufe von anderen Origins. Planungsstände, interne Identifikatoren und prüfungsrelevante Termine gehören nicht zum Vertrag.

## Kursphasen abrufen

`GET /api/v1/courses/{kurskennung}/block-plan`

Die Kurskennung wird am Anfang und Ende getrimmt und ohne Beachtung der Groß-/Kleinschreibung exakt mit den Snapshots veröffentlichter Fassungen verglichen. Sie ist URL-kodiert zu übergeben. Der Endpunkt setzt `Cache-Control: no-store`; Clients erhalten nach einer Veröffentlichung oder Zurücknahme daher unmittelbar die aktuelle öffentliche Fassung. `Access-Control-Allow-Origin: *` erlaubt lesenden Browser-Clients den Zugriff ohne Zugangsdaten.

Eine erfolgreiche Antwort (`200 OK`) enthält genau den angefragten Kurs und dessen Phasen, nach Semester sowie innerhalb eines Semesters chronologisch geordnet. Auch bei einer formal unvollständigen historischen Fassung enthält `semesters` jeden Wert von `1` bis zur veröffentlichten Semesterzahl.

```json
{
  "course": {
    "code": "TIF25A",
    "program": {
      "name": "Informatik",
      "abbreviation": "TIF"
    },
    "studyPeriod": {
      "startDate": "2025-10-01",
      "endDate": "2028-09-30"
    }
  },
  "semesters": [
    {
      "number": 1,
      "phases": [
        {
          "type": "THEORY",
          "startDate": "2025-10-01",
          "endDate": "2025-12-19"
        }
      ]
    }
  ]
}
```

`type` lautet `THEORY` oder `PRACTICE`; Datumswerte sind zeitzonenlose ISO-Kalendertage im Format `YYYY-MM-DD`.

| Status | Antwort | Bedeutung |
| --- | --- | --- |
| `200` | Kursdaten | Die veröffentlichte Fassung zur Kennung. Eine Kennung ist über alle veröffentlichten Fassungen hinweg eindeutig. |
| `404` | `{"error":"not_found"}` | Die Kennung ist unbekannt, nur im Planungsstand vorhanden oder ihre Veröffentlichung wurde zurückgenommen. Diese Fälle sind absichtlich nicht unterscheidbar. |
