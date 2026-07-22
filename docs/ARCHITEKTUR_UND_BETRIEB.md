# Architektur und Betrieb

## Anwendung und Datenhaltung

Das MVP ist ein modularer Next.js-Monolith in einem Docker-Container. Öffentliche Ansichten, interner Editor, Fachlogik, lokale Anmeldung und Datenzugriff sind eine Anwendung, aber klar getrennte Module. Das MVP stellt keine öffentliche REST-API bereit; eine spätere API verwendet dieselbe Fachlogik und greift nie unmittelbar auf die Datenbank zu.

Drizzle ORM, versionierte SQL-Migrationen und der serverseitige `better-sqlite3`-Treiber kapseln SQLite. Die Anwendung läuft vorerst in genau einer Instanz. Ein Umstieg auf PostgreSQL wird erst bei mehreren Instanzen, deutlich mehr gleichzeitigen Schreibvorgängen oder beim Ausbau zur Vorlesungsplanung relevant.

Jede schreibende Fachoperation erhält einen serverseitigen `AuthorizationContext` aus Konto, Rollen und Bereichen und prüft die Berechtigung selbst. Routen und Oberfläche ergänzen diese Prüfung, sind aber keine alleinige Sicherheitsgrenze. Der interne Editor verwendet Server Actions; sie rufen ausschließlich die Fachlogik auf. Route Handlers sind späteren REST-Endpunkten oder technischen Integrationen vorbehalten.

Die Fachvalidierung liegt in einer gemeinsamen serverseitigen Regelbibliothek. Der Editor nutzt sie für direkte Rückmeldung; eine Veröffentlichung validiert zwingend nochmals und liefert strukturierte Fehler für Felder und Fehlerübersicht.

Ein Blockplan hat genau einen bearbeitbaren Entwurf und höchstens eine veröffentlichte Fassung. Die öffentliche Ansicht liest ausschließlich die veröffentlichte Fassung. Veröffentlichung, Austausch der Fassung und Audit-Eintrag erfolgen in einer SQLite-Transaktion. Danach entsteht wieder ein bearbeitbarer Entwurf; abgelöste Fassungen sind nicht wiederherstellbar.

## Authentifizierung und Sitzungen

Für die Übergangszeit bis Keycloak/OIDC dient Better Auth mit Drizzle-/SQLite-Adapter. Selbstregistrierung ist deaktiviert. Better Auth verwendet einen eigenen Argon2id-Passwort-Hasher, datenbankgestützte Sitzungen ohne Cookie-Cache und deaktiviertes IP-Tracking.

- Passwörter haben mindestens 15 Zeichen; mindestens 64 Zeichen sind erlaubt. Passwortmanager und Einfügen sind zulässig. Es gibt keine Zeichenklassen- oder Wechselpflicht, aber eine lokale Sperrliste häufiger bzw. kompromittierter Werte.
- Fehlgeschlagene Anmeldungen werden rate-limitiert, aber Konten nicht dauerhaft gesperrt.
- Aktivierungs- und Reset-Tokens sind zufällig, einmalig, serverseitig gehasht und 72 Stunden gültig. Eine Neuausstellung macht vorherige Tokens desselben Kontos ungültig.
- Sitzungen enden nach zwei Stunden Inaktivität oder beim Schließen des Browsers. Logout, Deaktivierung sowie Änderungen an Rolle oder Bereichszuordnung machen sie sofort ungültig.
- Cookies sind nicht persistent, zufällig und serverseitig prüfbar; sie nutzen HTTPS, `HttpOnly`, `Secure` sowie `SameSite=Lax` oder `SameSite=Strict`. Anmeldetokens liegen nie im Browser-Speicher.

## Betrieb, Backups und Datenschutz

Die Anwendung wird auf vorhandenen DHBW-VPS als zusätzlicher Docker-Container hinter der bestehenden Traefik-Instanz betrieben. Die SQLite-Datei liegt auf einem persistenten Volume bzw. Host-Mount außerhalb des beschreibbaren Container-Dateisystems.

Das App-Team der DHBW Lörrach verantwortet Domain, TLS, Deployment, Container- und Systemupdates, Monitoring und die Erstreaktion bei Störungen. Der Mindestbetrieb besteht aus Container-Healthcheck, HTTP-Erreichbarkeitsprüfung, zentralen Fehlerlogs sowie einem dokumentierten Update- und Eskalationsweg.

SQLite-Datenbank und Anwendungs-Konfiguration werden täglich konsistent auf ein vom VPS getrenntes DHBW-Backupziel gesichert und mindestens 30 Tage aufbewahrt. Vor dem Go-live und danach mindestens jährlich findet ein dokumentierter Wiederherstellungstest statt. Die Verantwortung für Backup, Wiederherstellung und Ziel wird vor dem Deployment benannt.

Die Anwendung verarbeitet nur dienstliche E-Mail-Adressen, Rollen und Bereichszuordnungen, Kontostatus, Passwort-Hashes, Aktivierungs-/Reset-Tokens und Auditdaten (Konto-ID, Zeitpunkt, Aktion). Sie verarbeitet keine Studierendendaten, keine Nutzungsanalyse und keine anwendungseigene IP-Protokollierung. Deaktivierte lokale Konten bleiben zwölf Monate reaktivierbar; danach werden nicht mehr benötigte Kontodaten anonymisiert oder gelöscht. Auditdaten bleiben ohne angezeigte dienstliche E-Mail-Adresse.

Vor Go-live wird der zentrale Datenschutzbeauftragte der DHBW, Prof. Dr. Tobias Straub (`straub@dhbw.de`, `datenschutz@dhbw.de`), zu Informationspflichten und der Frage einer Datenschutz-Folgenabschätzung einbezogen.

Beim ersten Deployment liegen `BOOTSTRAP_ADMIN_EMAIL` und `BOOTSTRAP_ADMIN_SECRET` einmalig in einer nur für das App-Team lesbaren `.env`-Datei auf dem VPS, außerhalb von Repository und Container-Image. Die Anwendung verwendet sie nur, solange kein Systemadministrationskonto existiert. Nach der ersten Aktivierung werden sie entfernt und nie in Logs oder Klartext-Backups gespeichert.

## Tests

Es gibt keine separate Test- oder Staging-Anwendung. Migrationen werden mit Testdaten geprüft; produktive Daten und Konten bleiben davon ausgeschlossen.

Vitest prüft Fachvalidierung, Rechte, Veröffentlichungslogik, Migrationen und Transaktionen gegen temporäres SQLite. Playwright deckt die entscheidenden Browserabläufe ab: Aktivierung, Bearbeitung, Veröffentlichung, Zurücknahme, Bereichsrechte sowie öffentliche und tastaturbedienbare Darstellung. Vor jedem Deployment müssen Typprüfung, Linting, Tests und Produktions-Build erfolgreich sein.

## Quellen

- [DHBW Datenschutz](https://www.dhbw.de/datenschutz)
- [DSGVO, Artikel 5](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679)
- [BfDI: Datenschutz-Folgenabschätzung](https://www.bfdi.bund.de/DE/Fachthemen/Inhalte/Technik/Datenschutz-Folgenabschätzungen.html)
- [NIST SP 800-63B: Passwörter](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [NIST SP 800-63B: Sitzungen](https://pages.nist.gov/800-63-4/sp800-63b/session/)
