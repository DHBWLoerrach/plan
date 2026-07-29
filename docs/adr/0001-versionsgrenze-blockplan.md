---
status: superseded by ADR-0010
---

# Versionsgrenze: Kurszuordnungen gehören zum Blockplan, nicht zur Fassung

Ein Blockplan existiert gleichzeitig als Entwurf und als höchstens eine veröffentlichte Fassung, also braucht jede Angabe eine Zuordnung zu einer der beiden Ebenen. Identität, Bereich, aktuelle Bezeichnung und aktuelle Kurszuordnungen hängen am Blockplan selbst, ebenso der aus den Kursen abgeleitete Jahrgang. Kursphasen und prüfungsrelevante Termine gehören einer Fassung; die veröffentlichte Fassung speichert zusätzlich die bei ihrer Freigabe geltenden öffentlichen Anzeigenamen und Kursangaben als Snapshots.

## Verworfene Alternative

Auch die aktuelle Kurszuordnung zu versionieren hätte aus „ein Kurs ist höchstens einem Blockplan zugeordnet“ ein „…je Fassung“ gemacht und damit mehrere konkurrierende Planungsabsichten zugelassen. Stattdessen bleibt die aktuelle Zuordnung eindeutig. Die öffentliche Einbeziehung eines Kurses ist keine zweite aktuelle Zuordnung, sondern Teil des unveränderlichen Snapshots; sie darf während einer Umplanung vorübergehend von der aktuellen Zuordnung abweichen. Eine Herkunfts-Kurs-ID darf jedoch gleichzeitig in höchstens einer veröffentlichten Fassung vorkommen.

## Konsequenzen

Ein Kurs kann zugeordnet und damit für andere Blockpläne gesperrt sein, obwohl öffentlich nichts davon sichtbar ist. Das ist gewollt — die Sperre spiegelt die Planungsabsicht. Öffentliche Matrix, Listen, Filter und der abgeleitete öffentliche Name berücksichtigen ausschließlich die Kurs-Snapshots der veröffentlichten Fassung.

Eine Änderung von Bezeichnungen oder Kurszuordnungen wirkt intern sofort, öffentlich aber erst mit der nächsten Veröffentlichung. Damit verändert sich öffentlich sichtbarer Inhalt ausschließlich durch Veröffentlichen oder Zurücknehmen; die stabile URL bleibt davon unabhängig. Öffentliche Listen und Filter lesen deshalb ebenfalls ausschließlich die Snapshots der veröffentlichten Fassung.

Kurse tragen keinen Veröffentlichungszustand; die veröffentlichte Fassung ist durch ihre Snapshots vollständig eigenständig (siehe [ADR 0009](0009-fassung-als-vollstaendiger-snapshot-ohne-kurszustand.md)). Ob ein Blockplan schon einmal veröffentlicht wurde, hält eine dauerhafte Markierung am Blockplan fest, weil eine zurückgenommene veröffentlichte Fassung nicht aufbewahrt wird.
