---
status: superseded by ADR-0007
---

# Änderungswarnung statt Versionszähler für Entwürfe

Die Blockpläne eines Bereichs werden nur gelegentlich von zwei bis vier Personen bearbeitet, die sich unmittelbar abstimmen können. Deshalb schützt das MVP Entwürfe nicht mit einem allgemeinen Versionszähler und verhindert seltene Überschreibungen nicht ausnahmslos. Stattdessen führt jeder Entwurf Zeitpunkt und internes Konto seiner letzten Änderung. Erkennt eine granulare Speicheraktion einen neueren als den beim Laden gesehenen Stand, schreibt sie zunächst nichts und zeigt eine Änderungswarnung. Die Person darf genau ihre einzelne Operation für den angezeigten Stand bestätigen; eine weitere zwischenzeitliche Änderung löst erneut die Warnung aus.

## Verworfene Alternative

Ein monotoner Versionszähler für Blockplan und Kurs hätte jedes unbemerkte Überschreiben verhindert. Er hätte aber auch sachlich unabhängige Änderungen als Konflikt behandelt und für alle Bearbeitungswege eine Konfliktantwort, eine Gegenüberstellung und eine erneute Übernahme verlangt. Diese Komplexität ist für die kleine, selten gleichzeitig arbeitende Nutzergruppe nicht verhältnismäßig.

## Konsequenzen

Speicheraktionen bleiben granular und schreiben niemals einen vollständig im Browser gehaltenen Entwurf zurück. „Trotzdem speichern“ überstimmt ausschließlich die Änderungswarnung; Berechtigungen, Existenz- und Strukturprüfungen laufen erneut gegen den aktuellen Datenbankstand. Ein seltenes Überschreiben derselben Planangabe oder derselben Kursangabe wird bewusst akzeptiert. Kurszuordnungen bleiben durch Transaktionen, aktuelle Zustandsprüfungen und Datenbank-Constraints geschützt.

Veröffentlichen kann eine Warnung nicht überstimmen: Hat sich der Entwurf oder der gesehene Veröffentlichungszustand geändert, wird die aktuelle Vorschau geladen. Zurücknehmen adressiert die konkret angezeigte Fassungs-ID. Damit benötigen auch diese Vorgänge keinen allgemeinen Versionszähler.
