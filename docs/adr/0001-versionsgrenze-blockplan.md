# Versionsgrenze: Kurszuordnungen gehören zum Blockplan, nicht zur Fassung

Ein Blockplan existiert gleichzeitig als bearbeitbarer Entwurf und als höchstens eine veröffentlichte Fassung. Damit stellt sich für jede Angabe die Frage, ob sie je Fassung oder einmal am Blockplan geführt wird. Wir haben entschieden: Identität, Bereich, Jahrgang, Bezeichnung und die Zuordnung von Kursen hängen am Blockplan selbst und wirken sofort; nur Blockphasen, Kursphasen und prüfungsrelevante Termine gehören einer Fassung.

## Considered Options

Die naheliegende Alternative war, auch die Kurszuordnung zu versionieren. Sie hätte die öffentliche Ansicht automatisch sauber gehalten: Ein im Entwurf hinzugefügter Kurs wäre schlicht nicht Teil der veröffentlichten Fassung gewesen.

Dagegen sprach, dass die Regel „ein Kurs ist höchstens einem Blockplan zugeordnet“ zu „…höchstens einem Blockplan je Fassung“ hätte werden müssen. Damit wäre der Zustand möglich geworden, dass ein Kurs im Entwurf zu Plan A und in der veröffentlichten Fassung zu Plan B gehört. Dieser Zustand ist weder erklärbar noch sinnvoll auflösbar, und die Prüfung der Zuordnungsbedingungen (Bereich, Jahrgang) hätte gegen zwei unterschiedliche Wahrheiten laufen müssen.

## Consequences

Ein Kurs kann einem Blockplan zugeordnet sein, ohne in dessen veröffentlichter Fassung Kursphasen zu besitzen — und ist dadurch für andere Blockpläne gesperrt, obwohl öffentlich nichts davon zu sehen ist. Das ist gewollt: Die Sperre spiegelt die tatsächliche Planungsabsicht wider.

Damit die öffentliche Ansicht davon unberührt bleibt, gilt die ergänzende Regel, dass sie nur Kurse mit veröffentlichten Kursphasen zeigt. Ohne diese Regel erschiene ein neu zugeordneter Kurs als leere Spalte in der Planmatrix.

Eine Änderung der Bezeichnung wirkt sofort öffentlich, ohne Veröffentlichung. Das ist unkritisch, weil die öffentliche URL laut MVP-Spezifikation von der Bezeichnung unabhängig ist.
