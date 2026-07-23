# Architektur und Betrieb

## Anwendung und Datenhaltung

Das MVP ist ein modularer Next.js-Monolith in einem Docker-Container. Öffentliche Ansichten, interner Editor, Fachlogik, lokale Anmeldung und Datenzugriff sind eine Anwendung, aber klar getrennte Module. Das MVP stellt keine öffentliche REST-API bereit; eine spätere API verwendet dieselbe Fachlogik und greift nie unmittelbar auf die Datenbank zu.

Drizzle ORM, versionierte SQL-Migrationen und der serverseitige `better-sqlite3`-Treiber kapseln SQLite. Die Anwendung läuft vorerst in genau einer Instanz. Ein Umstieg auf PostgreSQL wird erst bei mehreren Instanzen, deutlich mehr gleichzeitigen Schreibvorgängen oder beim Ausbau zur Vorlesungsplanung relevant.

Die produktive Datenbank verwendet `PRAGMA journal_mode=WAL` und verifiziert diesen persistenten Modus beim Anwendungsstart. Jede geöffnete Verbindung aktiviert `PRAGMA foreign_keys=ON` und `PRAGMA busy_timeout=5000`. WAL erlaubt parallele Lesezugriffe, serialisiert Schreibvorgänge jedoch weiterhin; deshalb bleiben Schreibtransaktionen kurz. Ein nach Ablauf des Timeouts verbleibendes `SQLITE_BUSY` wird als vorübergehender, strukturierter Konflikt behandelt und nicht unbegrenzt wiederholt.

Blockpläne, Kurse und weitere langlebige Entitäten erhalten unveränderliche, nicht aus Bezeichnungen abgeleitete IDs. Die Datenbank aktiviert Fremdschlüssel und eindeutige Constraints. Referenzierte oder bereits veröffentlichte Stammdaten werden nicht kaskadierend gelöscht; die Anwendungslogik setzt die in der MVP-Spezifikation beschriebenen Löschschutz- und Deaktivierungsregeln durch.

Fachliche Datumswerte werden als ISO-Kalendertage `YYYY-MM-DD` ohne UTC-Konvertierung gespeichert. Eine optionale Uhrzeit wird zusammen mit dem zugehörigen Kalendertag und der IANA-Zeitzone `Europe/Berlin` interpretiert. Vergleiche für Lückenlosigkeit, Monatsgrenzen und Studienzeiträume erfolgen auf Kalendertagen, nicht auf UTC-Zeitstempeln.

Jede schreibende Fachoperation erhält einen serverseitigen `AuthorizationContext` aus Konto, Rollen und Bereichen und prüft die Berechtigung selbst. Routen und Oberfläche ergänzen diese Prüfung, sind aber keine alleinige Sicherheitsgrenze. Der interne Editor verwendet Server Actions; sie rufen ausschließlich die Fachlogik auf. Route Handlers sind späteren REST-Endpunkten oder technischen Integrationen vorbehalten.

Die Fachvalidierung liegt in einer gemeinsamen serverseitigen Regelbibliothek. Jede Regel ist dort als Strukturregel oder Veröffentlichungsregel im Sinne von `CONTEXT.md` gekennzeichnet: Strukturregeln werden bei jedem Schreibvorgang durchgesetzt, Veröffentlichungsregeln zusätzlich beim Veröffentlichen. Der Editor nutzt dieselbe Bibliothek für direkte Rückmeldung; eine Veröffentlichung validiert zwingend nochmals und liefert strukturierte Fehler für Felder und Fehlerübersicht.

Ein Blockplan hat genau einen bearbeitbaren Entwurf und höchstens eine veröffentlichte Fassung. Blockphasen, Kursphasen und prüfungsrelevante Termine gehören je einer Fassung; Identität, Bereich, Jahrgang, Bezeichnung und Kurszuordnungen hängen am Blockplan selbst und sind nicht versioniert. Die öffentliche Ansicht liest ausschließlich die veröffentlichte Fassung. Veröffentlichung, Austausch der Fassung und Audit-Eintrag erfolgen in einer SQLite-Transaktion. Danach entsteht wieder ein bearbeitbarer Entwurf; abgelöste Fassungen sind nicht wiederherstellbar.

Jeder Entwurf besitzt einen monoton steigenden Versionszähler. Jede Mutation enthält die erwartete Version und erhöht sie atomar; stimmt sie nicht mehr mit der gespeicherten Version überein, antwortet die Fachlogik mit einem strukturierten Bearbeitungskonflikt und schreibt keine Daten. Die Oberfläche lädt anschließend die aktuelle Fassung und unterstützt die Person dabei, ihre Änderung erneut einzubringen.

## Authentifizierung und Sitzungen

Für die Übergangszeit bis Keycloak/OIDC dient Better Auth mit Drizzle-/SQLite-Adapter. Selbstregistrierung ist deaktiviert. Better Auth verwendet einen eigenen Argon2id-Passwort-Hasher, datenbankgestützte Sitzungen ohne Cookie-Cache und deaktiviertes IP-Tracking.

- Passwörter haben mindestens 15 Zeichen; Eingaben mit mindestens 64 Zeichen müssen vollständig akzeptiert werden. Passwortmanager und Einfügen sind zulässig. Es gibt keine Zeichenklassen- oder Wechselpflicht, aber eine lokale Sperrliste häufiger bzw. kompromittierter Werte.
- Fehlgeschlagene Anmeldungen werden rate-limitiert, aber Konten nicht dauerhaft gesperrt.
- Aktivierungs- und Reset-Tokens sind zufällig, einmalig, serverseitig gehasht und 72 Stunden gültig. Eine Neuausstellung macht vorherige Tokens desselben Kontos ungültig.
- Sitzungen enden nach zwei Stunden Inaktivität oder beim Schließen des Browsers. Logout, Deaktivierung sowie Änderungen an Rolle oder Bereichszuordnung machen sie sofort ungültig.
- Cookies sind nicht persistent, zufällig und serverseitig prüfbar; sie nutzen HTTPS, `HttpOnly`, `Secure` sowie `SameSite=Lax` oder `SameSite=Strict`. Anmeldetokens liegen nie im Browser-Speicher.

## Betrieb, Backups und Datenschutz

Die Anwendung wird auf vorhandenen DHBW-VPS als zusätzlicher Docker-Container hinter der bestehenden Traefik-Instanz betrieben. Die SQLite-Datei liegt auf einem persistenten Volume bzw. Host-Mount außerhalb des beschreibbaren Container-Dateisystems.

Das App-Team der DHBW Lörrach verantwortet Domain, TLS, Deployment, Container- und Systemupdates, Monitoring und die Erstreaktion bei Störungen. Der Mindestbetrieb besteht aus Container-Healthcheck, HTTP-Erreichbarkeitsprüfung, zentralen Fehlerlogs sowie einem dokumentierten Update- und Eskalationsweg.

SQLite-Datenbank und Anwendungs-Konfiguration werden täglich konsistent auf ein vom VPS getrenntes DHBW-Backupziel gesichert und mindestens 30 Tage aufbewahrt. Vor dem Go-live und danach mindestens jährlich findet ein dokumentierter Wiederherstellungstest statt. Die Verantwortung für Backup, Wiederherstellung und Ziel wird vor dem Deployment benannt.

Die Anwendung verarbeitet nur dienstliche E-Mail-Adressen, Rollen und Bereichszuordnungen, Kontostatus, Passwort-Hashes, Aktivierungs-/Reset-Tokens und Auditdaten (Konto-ID, Zeitpunkt, Aktion und betroffene Entitäts-ID). Sie verarbeitet keine Studierendendaten, keine Nutzungsanalyse und keine anwendungseigene IP-Protokollierung. Deaktivierte lokale Konten bleiben zwölf Monate reaktivierbar; danach werden nicht mehr benötigte Kontodaten anonymisiert oder gelöscht. Auditdaten bleiben ohne angezeigte dienstliche E-Mail-Adresse.

Welche Ereignisse die Auditspur umfasst und wer sie einsehen darf, legt `CONTEXT.md` fest: Blockplan-Lebenszyklus, Kurs-Lebenszyklus einschließlich Zuordnen und Lösen, Deaktivierung und Reaktivierung von Bereichen und Studiengängen sowie sämtliche Kontoereignisse. Einzelne Speichervorgänge an einem Entwurf sind keine Auditereignisse; der Entwurf führt stattdessen eine überschreibbare Angabe „zuletzt geändert“ mit Zeitpunkt und Konto. Tokenwerte, Passwörter und sonstige Geheimnisse werden niemals protokolliert. Auditereignisse werden nur angefügt und nicht über die Administrationsoberfläche verändert oder gelöscht.

## Rechtliche Pflichtinformationen

Impressum, Datenschutzhinweise und Erklärung zur Barrierefreiheit sind aus allen öffentlichen und internen Ansichten leicht erreichbar. Vor Go-live bestätigt das App-Team mit der zuständigen DHBW-Stelle, ob die zentralen DHBW-Seiten die Anwendung vollständig abdecken. Andernfalls erhält die Anwendung ergänzende Hinweise.

Die Datenschutzhinweise müssen insbesondere die lokale Kontoverwaltung, technisch notwendige Sitzungscookies, Aktivierungs- und Reset-Tokens, Rollen- und Bereichszuordnungen, Auditereignisse, Zwecke, Rechtsgrundlagen, Empfänger, Speicherfristen sowie Betroffenenrechte und Kontaktstellen beschreiben. Ein bloßer Verweis auf allgemeine DHBW-Hinweise genügt nur, wenn diese Verarbeitungen dort tatsächlich erfasst sind.

Beim ersten Deployment liegen `BOOTSTRAP_ADMIN_EMAIL` und `BOOTSTRAP_ADMIN_SECRET` einmalig in einer nur für das App-Team lesbaren `.env`-Datei auf dem VPS, außerhalb von Repository und Container-Image. `BOOTSTRAP_ADMIN_SECRET` ist ein kryptografisch zufälliges Einmal-Geheimnis, das ausschließlich die Erzeugung beziehungsweise Nutzung des ersten Aktivierungslinks autorisiert; es ist kein initiales oder dauerhaftes Passwort. Die Anwendung akzeptiert es nur, solange kein Systemadministrationskonto existiert. Nach der ersten Aktivierung wird es dauerhaft ungültig, beide Werte werden aus der `.env` entfernt und weder in Logs noch in Klartext-Backups gespeichert.

## Migration und Rückweg

Unmittelbar vor jeder produktiven Datenbankmigration versetzt das App-Team die Anwendung in einen Wartungszustand ohne Schreibzugriffe und erstellt eine konsistente, datierte Sicherung der SQLite-Datei sowie der zugehörigen Konfiguration. Danach werden die versionierten Migrationen ausgeführt und mit Healthcheck, Datenbankprüfung und einem fachlichen Smoke-Test verifiziert.

Schlägt die Migration oder Prüfung fehl, wird nicht mit der neuen Version weitergearbeitet: Das App-Team stellt die unmittelbar zuvor gesicherte SQLite-Datei und Konfiguration wieder her und startet das vorherige Container-Image. Backup, Migrationsversion, Prüfergebnis und ein gegebenenfalls ausgeführter Rückweg werden dokumentiert.

## Tests

Es gibt keine separate Test- oder Staging-Anwendung. Migrationen werden mit Testdaten geprüft; produktive Daten und Konten bleiben davon ausgeschlossen.

Vitest prüft Fachvalidierung, Rechte, vollständige Auditereignisse, Veröffentlichungslogik, optimistisches Locking, Referenzintegrität, Migrationen und Transaktionen gegen temporäres SQLite. Playwright deckt die entscheidenden Browserabläufe ab: Aktivierung, Bearbeitung einschließlich eines Versionskonflikts, Veröffentlichung, Zurücknahme, Bereichsrechte sowie öffentliche und tastaturbedienbare Darstellung. Vor jedem Deployment müssen Typprüfung, Linting, Tests und Produktions-Build erfolgreich sein.

Ein reproduzierbarer Lasttest bildet die in der MVP-Spezifikation festgelegten internen und öffentlichen Gleichzeitigkeits- und Antwortzeitannahmen ab. Er läuft lokal oder in einem ephemeren Container gegen eine synthetisch erzeugte Testdatenbank, niemals gegen die Produktivinstanz oder produktive Daten. Werden die festgelegten Grenzen im Betrieb regelmäßig überschritten, werden Datenbank- und Bereitstellungsarchitektur vor einer Funktionserweiterung neu bewertet.

## Quellen

- [DHBW Datenschutz](https://www.dhbw.de/datenschutz)
- [DSGVO, Artikel 5](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679)
- [BfDI: Datenschutz-Folgenabschätzung](https://www.bfdi.bund.de/DE/Fachthemen/Inhalte/Technik/Datenschutz-Folgenabschätzungen.html)
- [NIST SP 800-63B: Passwörter](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [NIST SP 800-63B: Sitzungen](https://pages.nist.gov/800-63-4/sp800-63b/session/)
- [SQLite: Write-Ahead Logging](https://www.sqlite.org/wal.html)
- [SQLite: PRAGMA `busy_timeout`](https://www.sqlite.org/pragma.html#pragma_busy_timeout)
- [DHBW-Impressum](https://www.dhbw.de/impressum/)
- [DSGVO, Artikel 13](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [Digitale-Dienste-Gesetz, § 5](https://www.gesetze-im-internet.de/ddg/__5.html)
