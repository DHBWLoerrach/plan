# Der Kurs ist der Bearbeitungsgegenstand, der Vergleich nur eine Vorschau

Kursverlauf und prüfungsrelevante Termine werden auf einer Seite je Kurs bearbeitet. Diese Seite hat genau einen Gegenstand: den Kurs, dessen Kennung sie trägt. Die Kurse desselben Jahrgangs stehen daneben, aber ausschließlich zum Lesen — auch dann, wenn das Konto sie bearbeiten dürfte. Der Umfang dieses Vergleichs — die Parallelkurse des Studiengangs, alle Kurse des Bereichs, der ganze Jahrgang oder keiner — wird bei jedem Aufruf gewählt und steht in der Adresse.

Bisher war die einzige Stelle, an der Kursphasen und Termine überhaupt bearbeitet wurden, ein interner Zuschnitt: eine in der Kursliste angekreuzte Kursmenge, deren übereinstimmende Angaben zu einer Zeile zusammengefasst und gemeinsam geändert oder gelöscht wurden. Wer einen Kurs verantwortet, musste ihn also zuerst als Menge auswählen, um an ihn heranzukommen, und arbeitete anschließend an Zeilen, die mehreren Kursen zugleich gehörten. Die Studiengangsleitung verantwortet aber den einzelnen Kurs; der Blick auf die anderen ist Vergleich, nicht Gegenstand.

## Übertragung statt gemeinsamer Bearbeitung

Das kursübergreifende Planen bleibt möglich, wechselt aber die Richtung: Beim Anlegen einer Kursphase oder eines Termins können Kurse des Vergleichs benannt werden, bei denen dieselbe Angabe zusätzlich entsteht. Sie entsteht dort eigenständig ([ADR 0006](0006-kursphasen-ohne-gemeinsame-identitaet.md)); eine spätere Änderung wirkt nur auf den Kurs, an dem sie vorgenommen wird. Ändern und Löschen kennen deshalb keine Übertragung — es gibt nichts zu ändern, was mehreren Kursen gemeinsam gehörte.

Ziel einer Phasenübertragung können nur nicht veröffentlichte Kurse aus den eigenen Bereichen sein, die in Semesterzahl und Studienzeitraum mit dem bearbeiteten Kurs übereinstimmen. Angeboten wird ein Ziel also nur dann, wenn jede für diesen Kurs gültige Kursphase auch dort gültig ist: Welche Daten gleich eingegeben werden, steht beim Anbieten des Ziels noch nicht fest, und ein abgewiesenes Ziel reißt die gesamte Transaktion mit — den bearbeiteten Kurs eingeschlossen. Die Bedingung liegt deshalb auf den Kursen und nicht auf der Eingabe. Die Semesterzahl schränkt bereits die Übernahme aus einer Vorlage ein; der Studienzeitraum kommt hinzu, weil ein Vergleich über den eigenen Studiengang hinaus Kurse gleicher Länge, aber anderer Lage enthalten kann. Reicht eine Übertragung dennoch in einen fremden Bereich, scheitert sie vollständig, statt den eigenen Kurs allein zu schreiben ([ADR 0011](0011-systemweite-leseeinsicht-in-kurse.md)).

Termine kennen keine solche Einschränkung, weil sie an keiner Semesterstruktur hängen; sie werden für jeden bearbeitbaren Kurs des Vergleichs angeboten. Liegt ein Termin außerhalb des Studienzeitraums seines Kurses, ist das wie bei jeder anderen Erfassung ein offener Punkt der Vollständigkeitsprüfung und verhindert die Veröffentlichung ([ADR 0012](0012-veroeffentlichung-als-sichtbarkeit-des-kurses.md)).

Beide Bedingungen sind Regeln und nicht bloß die Auswahl, die das Formular anbietet: Sie werden beim Speichern erneut gegen den bearbeiteten Kurs geprüft, weil die Serveraktion auch ohne das Formular erreichbar ist. Insbesondere die Jahrgangsgrenze trägt sich nicht von selbst — die Studienzeiträume zweier aufeinanderfolgender Jahrgänge überlappen sich um zwei Jahre, sodass ein für beide gültiges Datum jede kursweise Prüfung der Fachlogik bestehen würde. Ein abgewiesenes Ziel lässt die gesamte Erfassung scheitern, statt stillschweigend weniger Kurse zu erreichen, als es benannt hat. Eine Rechteausweitung war das nie: Geschrieben wird ohnehin nur in den eigenen Bereichen ([ADR 0011](0011-systemweite-leseeinsicht-in-kurse.md)).

## Verworfene Alternativen

**Den Zuschnitt-Editor daneben bestehen lassen.** Hätte den vollen Funktionsumfang erhalten, aber zwei Bearbeitungswege für dieselben Daten mit unterschiedlichen Berechtigungs- und Bestätigungsregeln — und die zusammengefasste Zeile hätte weiterhin behauptet, es gäbe ein Objekt über mehreren Kursen.

**Mehrfachpflege ersatzlos streichen.** Wäre der schlankste Code gewesen, hätte aber das kursübergreifende Planen des Studienzentrums IT-Management und Informatik ([ADR 0010](0010-kurs-als-planungs-und-veroeffentlichungseinheit.md)) auf das Abtippen je Kurs zurückgeworfen. Die Übertragung kostet ein Auswahlfeld und erhält den Fall.

**Den Vergleich als gespeicherte Auswahl.** Hätte eine Entität ohne fachlichen Gehalt eingeführt, die zu pflegen und aufzuräumen wäre. Der Umfang ist aus Studiengang, Bereich und Jahrgang des Kurses jederzeit herleitbar; die Adresse genügt, um eine Ansicht zu teilen.

## Konsequenzen

Der Vergleich ist wie der öffentliche Zuschnitt an genau einen Jahrgang gebunden, aus demselben Grund: Die Planmatrix stellt Semester über eine gemeinsame Zeitachse gegenüber, und dasselbe Semester zweier Jahrgänge liegt Jahre auseinander ([ADR 0010](0010-kurs-als-planungs-und-veroeffentlichungseinheit.md)). Der Begriff „Zuschnitt“ bezeichnet fortan ausschließlich die öffentliche Ansicht.

Die Gegenüberstellung übereinstimmender Kursphasen und Termine bleibt, wandert aber vollständig in die Darstellung: Die Planmatrix des Vergleichs fasst gleiche Verläufe weiterhin zu einer Spalte zusammen, während der Planungsstand nur die Angaben des einen Kurses führt. Damit gibt es keine Bedienoberfläche mehr, die eine Änderung an mehreren Kursen zugleich vornimmt; die zusammenfassende Schreiblogik entfällt ersatzlos.

Die Spalte des Kurses, zu dem die Seite gehört, ist in der Planmatrix hervorgehoben und lässt sich nicht ausblenden — ein Vergleich ohne seinen Gegenstand vergliche nichts. Bei der Wahl „Jahrgang“ kann die Matrix über alle Bereiche hinweg sehr breit werden; sie bleibt über die Kursauswahl in ihrem Kopf beherrschbar, und der voreingestellte Umfang ist der Studiengang.

## Eine Adresse je Kurs

Wenn der Kurs der Gegenstand ist, hat er auch genau eine interne Adresse: `/intern/kurse/{id}`. Sie trägt alles, was den Kurs betrifft — Veröffentlichung, Kursverlauf, Termine, Kursangaben und Löschung; Vergleich und Vorlesungskalender sind Ansichten derselben Adresse. Die zuvor getrennte Planseite entfällt, und ein Kurs aus einem nicht zugeordneten Bereich wird nicht mehr umgeleitet: Er zeigt dieselbe Seite, nur ohne alles, was schreiben würde. Damit führt jede Zeile der Kursliste in einem Schritt ans Ziel, gleich ob der Kurs bearbeitet werden darf oder nicht.

## Planungsstand als eine Liste, Vergleich als eigene Ansicht

Die Kursseite hat drei Ansichten: den Planungsstand, den Vergleich und den Vorlesungskalender ([ADR 0015](0015-vorlesungskalender-als-externe-lesesicht.md)). Bearbeitet wird ausschließlich im Planungsstand; der Vergleich stellt die Kurse des Jahrgangs in Planmatrix und chronologischer Termintabelle nebeneinander und wird nur gelesen. Sein Umfang — Studiengang, Bereich oder Jahrgang — steht als `vergleich` in der Adresse; dass der Parameter vorhanden ist, unterscheidet die Ansicht vom Planungsstand.

Zunächst standen Vergleich und Bearbeitung auf derselben Seite: Überblick, Planmatrix mit allen Vergleichsspalten, chronologische Termintabelle und darunter die Formulare. Jede Kursphase stand damit dreimal und jeder Termin zweimal auf der Seite, und wer einen Kurs verantwortet, las bei jeder Korrektur den Plan der Nachbarkurse mit. Der Planungsstand zeigt deshalb nur noch den einen Kurs, als eine chronologische Liste: seine Semester, darin die Kursphasen, in jeder Kursphase die Termine, die in ihr beginnen, und zwischen zwei Kursphasen den Tag des Wechsels. Ein Termin steht so in der Phase, in die er fällt, statt in einer zweiten Tabelle nachgeschlagen zu werden. Jede Zeile ist zugleich der Einstieg in ihre Bearbeitung; das Formular öffnet unmittelbar unter ihr, und es ist immer höchstens eines offen. Über der Liste steht der Kursverlauf als Balkengrafik, darüber in einer Zeile der Veröffentlichungszustand mit dem Schritt, der ihn ändert. Kursangaben und Löschung ruhen am Ende der Seite hinter einer Zeile.

Die Parallelkurse des Studiengangs werden im Planungsstand nicht mehr gezeichnet, sondern nur dort genannt, wo sie abweichen: einmal zusammengefasst über der Liste und im betroffenen Semester mit ihren dortigen Kursphasen. Dass ein Parallelkurs übereinstimmt, wird ebenfalls gesagt — sein Fehlen wäre von einem nie verglichenen Kurs nicht zu unterscheiden. Sie bleiben die Ziele einer Übertragung.

## Der Wechsel als eine Angabe

Zwei aneinandergrenzende Kursphasen teilen eine Tatsache: den Tag, an dem der Kurs von der einen in die andere wechselt. Korrigiert wird in aller Regel dieser Tag — nicht das Ende der einen und der Beginn der anderen Phase als zwei Eingaben, zwischen denen eine Lücke oder Überschneidung entstehen kann. Der Planungsstand bietet den Wechsel deshalb als eine Datumsangabe an, und die Fachlogik schreibt beide Kursphasen gemeinsam, für nicht veröffentlichte Kurse ebenso wie für veröffentlichte. Grenzen zwei Kursphasen nicht aneinander, gibt es keinen solchen Tag; die Liste nennt stattdessen die Lücke oder Überschneidung, und korrigiert wird an den Kursphasen selbst, deren vollständiges Formular (Semester, Phasentyp, Zeitraum, Löschen) weiterhin an jeder Phasenzeile öffnet.

Aufgegeben ist damit, dass ein gespeicherter Eintrag sein Formular ohne JavaScript öffnet und dass ein geschlossenes Formular seine Eingaben behält: Das Formular gehört zu der Zeile, die gerade geöffnet ist. Für das Anlegen und die Kursangaben gilt beides weiterhin.
