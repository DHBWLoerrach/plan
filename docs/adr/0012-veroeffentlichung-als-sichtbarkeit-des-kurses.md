# Veröffentlichung ist die Sichtbarkeit des aktuellen Kurses

Ein Kurs besitzt genau einen aktuellen Datenstand aus Kursangaben, Kursphasen und prüfungsrelevanten Terminen. Ein optionaler Veröffentlichungszeitpunkt am Kurs entscheidet, ob externe Nutzende diesen Datenstand sehen. Es gibt keine eigenständige veröffentlichte Fassung, keine Snapshot-Tabellen und keine Revisionshistorie.

Die erste Veröffentlichung prüft den vollständigen Kurs und setzt seinen Veröffentlichungszeitpunkt. Eine Zurücknahme entfernt ausschließlich diesen Zeitpunkt; die Kursdaten bleiben unverändert erhalten. „Noch nie veröffentlicht“ und „zurückgenommen“ sind deshalb derselbe fachliche Zustand „nicht veröffentlicht“.

## Änderungen an veröffentlichten Kursen

Änderungen an einem veröffentlichten Kurs zeigt die Oberfläche vor dem Speichern mit ihren betroffenen Angaben und ihrer öffentlichen Wirkung. Erst nach einer ausdrücklichen Bestätigung wird gespeichert. Die Fachlogik prüft innerhalb derselben Datenbanktransaktion den vollständigen resultierenden Kurs erneut; bei einem Verstoß wird die gesamte Änderung zurückgerollt. Eine erfolgreiche Änderung ist unmittelbar öffentlich sichtbar.

Das Verschieben einer Phasengrenze ändert bei einem veröffentlichten Kurs die angrenzende Phase in derselben Transaktion mit. Einzelne Phasen können einem veröffentlichten, lückenlosen Verlauf weder hinzugefügt noch daraus gelöscht werden. Solche Strukturänderungen erfordern zunächst eine Zurücknahme.

## Konsequenzen

Öffentliche Seiten, Filter und API lesen dieselben Kurs-, Phasen- und Terminzeilen wie der interne Editor und beschränken sie auf Kurse mit Veröffentlichungszeitpunkt. Änderungen an Kurskennung, Studiengangszuordnung, Bereichsbezeichnung oder Studiengangskürzel wirken sofort auf öffentliche Inhalte und Adressen. Eine reine Änderung der Studiengangsbezeichnung ändert dagegen nur den Anzeigenamen: Studiengangszuschnitte und der Studiengangsfilter verwenden das systemweit eindeutige Kürzel. Die Eindeutigkeit der aktuellen Kurskennung und des aktuellen Studiengangskürzels genügt deshalb für die öffentliche Adressierung; besondere Reservierungen historischer Snapshot-Bezeichner entfallen.

Das Modell erlaubt keine verdeckte Vorbereitung mehrerer Korrekturen, während ein älterer Stand öffentlich bleibt. Das ist beabsichtigt: Nach der initialen Planung treten fast ausschließlich einzelne Terminänderungen und seltene Phasenverschiebungen auf. Für diesen Betrieb wäre ein permanenter zweiter Datenstand unverhältnismäßig.

Diese Entscheidung löst [ADR 0002](0002-veroeffentlichung-als-kopie.md), [ADR 0008](0008-zuruecknahme-loescht-veroeffentlichte-fassung.md) und [ADR 0009](0009-fassung-als-vollstaendiger-snapshot-ohne-kurszustand.md) ab und ändert die Veröffentlichungsfolgen aus [ADR 0010](0010-kurs-als-planungs-und-veroeffentlichungseinheit.md).
