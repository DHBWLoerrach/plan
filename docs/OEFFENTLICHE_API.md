# Öffentliche API

Die öffentliche API liefert ausschließlich Daten veröffentlichter Kurse. Sie ist schreibgeschützt, benötigt keine Anmeldung und erlaubt browserseitige Aufrufe von anderen Origins. Interne Identifikatoren und prüfungsrelevante Termine gehören nicht zum Vertrag.

## Kursphasen abrufen

`GET /api/v1/courses/{kurskennung}/block-plan`

Die Kurskennung wird am Anfang und Ende getrimmt und ohne Beachtung der Groß-/Kleinschreibung exakt mit der aktuellen Kurskennung verglichen. Sie ist URL-kodiert zu übergeben. Der Endpunkt setzt `Cache-Control: no-store`; Clients erhalten nach einer Veröffentlichung, Korrektur oder Zurücknahme unmittelbar den aktuellen öffentlichen Kurs. `Access-Control-Allow-Origin: *` erlaubt lesenden Browser-Clients den Zugriff ohne Zugangsdaten.

Eine erfolgreiche Antwort (`200 OK`) enthält genau den angefragten Kurs und dessen Phasen, nach Semester sowie innerhalb eines Semesters chronologisch geordnet. `semesters` enthält jeden Wert von `1` bis zur Semesterzahl des aktuellen Studiengangs.

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
| `200` | Kursdaten | Der aktuelle veröffentlichte Kurs zur systemweit eindeutigen Kennung. |
| `404` | `{"error":"not_found"}` | Die Kennung ist unbekannt oder der Kurs ist nicht veröffentlicht. Diese Fälle sind absichtlich nicht unterscheidbar. |
