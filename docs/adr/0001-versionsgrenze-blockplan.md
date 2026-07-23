# Versionsgrenze: Kurszuordnungen gehören zum Blockplan, nicht zur Fassung

Ein Blockplan existiert gleichzeitig als Entwurf und als höchstens eine veröffentlichte Fassung, also braucht jede Angabe eine Zuordnung zu einer der beiden Ebenen. Identität, Bereich, aktuelle Bezeichnung und aktuelle Kurszuordnungen hängen am Blockplan selbst, ebenso der aus den Kursen abgeleitete Jahrgang. Kursphasen und prüfungsrelevante Termine gehören einer Fassung; die veröffentlichte Fassung speichert zusätzlich die bei ihrer Freigabe geltenden öffentlichen Anzeigenamen von Blockplan, Bereich und Studiengängen als Snapshots.

## Verworfene Alternative

Auch die Kurszuordnung zu versionieren hätte die öffentliche Ansicht automatisch sauber gehalten. Dafür wäre aus „ein Kurs ist höchstens einem Blockplan zugeordnet“ ein „…je Fassung“ geworden — mit dem möglichen Zustand, dass ein Kurs im Entwurf zu Plan A und veröffentlicht zu Plan B gehört. Das ist weder erklärbar noch auflösbar, und die Zuordnungsprüfung hätte gegen zwei Wahrheiten laufen müssen.

## Konsequenzen

Ein Kurs kann zugeordnet und damit für andere Blockpläne gesperrt sein, obwohl öffentlich nichts davon sichtbar ist. Das ist gewollt — die Sperre spiegelt die Planungsabsicht. Öffentliche Matrix, Listen, Filter und der abgeleitete öffentliche Name berücksichtigen ausschließlich Kurse mit Kursphasen in der veröffentlichten Fassung.

Eine Änderung von Bezeichnungen oder Kurszuordnungen wirkt intern sofort, öffentlich aber erst mit der nächsten Veröffentlichung. Damit verändert sich öffentlich sichtbarer Inhalt ausschließlich durch Veröffentlichen oder Zurücknehmen; die stabile URL bleibt davon unabhängig. Öffentliche Listen und Filter lesen deshalb ebenfalls ausschließlich die Snapshots der veröffentlichten Fassung.

Nach der ersten Veröffentlichung eines Kurses ist seine Blockplanzuordnung dauerhaft. Dadurch kann die Kursmenge eines veröffentlichten Blockplans nur wachsen, und jede spätere Fassung enthält weiterhin vollständige Kursphasen aller bereits veröffentlichten Kurse. Ein gesondertes persistentes Merkmal für diesen Zustand ist nicht nötig; er bleibt aus der veröffentlichten oder zurückgenommenen Fassung ableitbar.
