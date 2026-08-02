# Architektur und Betriebsrahmen

Dieses Dokument hält nur Systemgrenzen und betriebliche Annahmen fest, die nicht zuverlässig aus
dem Repository ausführbar hervorgehen. Der aktuelle technische Ist-Stand steht in Code,
Konfiguration, Datenbankschema und Tests. Begründungen grundlegender Entscheidungen stehen in den
[`ADR`](adr/), konkrete Betriebsbefehle im [Betriebshandbuch](BETRIEBSHANDBUCH.md).

## Systemgrenze

Die Anwendung wird als eine Next.js-Anwendung mit einer persistenten SQLite-Datenbank betrieben.
Öffentliche Seiten und die schreibgeschützte öffentliche API sind ohne Anmeldung erreichbar;
Planung und Administration liegen hinter der internen Anmeldung. Die API besitzt mit
[`OEFFENTLICHE_API.md`](OEFFENTLICHE_API.md) einen eigenen externen Vertrag.

Für die SQLite-Datei darf es nur eine schreibende Anwendungsinstanz geben. Horizontale Skalierung
oder mehrere nebenläufig schreibende Container erfordern deshalb zuvor eine neue Datenbank- und
Bereitstellungsentscheidung. Die Anwendung versendet keine E-Mails und betreibt keinen eigenen
Scheduler.

Die vorgesehene produktive Basis-URL ist
`https://plan.apps.szi.dhbw-loerrach.de`. TLS-Terminierung, HSTS und die Weiterleitung an den
Anwendungscontainer übernimmt Traefik. Der Container ist nicht unmittelbar öffentlich erreichbar.
Traefik überschreibt eingehende Forwarding-Header oder seine Adressen werden über
`TRUSTED_PROXY_IPS` eng begrenzt. Die konkrete Container-, Proxy- und Healthcheck-Konfiguration
liegt außerhalb dieses Repositorys und muss vor dem Go-live bereitgestellt und geprüft werden.

## Betrieb, Backups und Datenschutz

Das Betriebsteam stellt ein persistentes Volume für die SQLite-Datei bereit. Ein externer Host-Cron
oder systemd-Timer stößt täglich die im [Betriebshandbuch](BETRIEBSHANDBUCH.md) beschriebene,
integritätsgeprüfte Sicherung an. Der Snapshot wird verschlüsselt an ein vom Anwendungsserver
getrenntes DHBW-Backupziel übertragen und dort 30 Tage aufbewahrt. Konfiguration und benötigte
langlebige Geheimnisse werden getrennt verschlüsselt gesichert.

Bei erfolgreicher täglicher Sicherung beträgt der maximale planmäßige Datenverlust 24 Stunden; ein
formales RPO, RTO oder Verfügbarkeits-SLA wird nicht zugesagt. Vor dem Go-live werden Verantwortung,
Backupziel und Eskalationsweg benannt und eine Wiederherstellung erfolgreich erprobt. Migrationen
und Wiederherstellungen erfolgen bei gestoppter Anwendung nach dem Betriebshandbuch. Erreichbarkeit,
Fehler und auffällige Antwortzeiten werden mit den vorhandenen Betriebswerkzeugen überwacht;
wiederkehrende `SQLITE_BUSY`-Fehler lösen eine Neubewertung der Architektur aus.

Die Anwendung verarbeitet dienstliche E-Mail-Adressen, Rollen und Bereichszuordnungen,
Kontostatus, Passwort-Hashes, gehashte Passwortlink-Tokens, Sitzungen sowie Konto-ID und Zeitpunkt
der letzten Änderung eines Kurses. Sitzungsdatensätze können IP-Adresse und User-Agent bis zu ihrem
Ablauf oder Widerruf enthalten. Für das Rate-Limit können IP-Adressen zusätzlich flüchtig
verarbeitet werden. Die Anwendung verarbeitet keine Studierendendaten und führt keine
Nutzungsanalyse. Für gesperrte Konten gibt es keinen automatischen Anonymisierungs- oder
Löschlauf; eine Aufbewahrungsregel muss vor einem Regelbetrieb mit der zuständigen DHBW-Stelle
festgelegt werden.

## Rechtliche Pflichtinformationen

Impressum, Datenschutzhinweise und Erklärung zur Barrierefreiheit müssen aus allen öffentlichen
und internen Ansichten leicht erreichbar sein. Vor dem Go-live bestätigt das App-Team mit der
zuständigen DHBW-Stelle, ob die zentralen DHBW-Seiten die Anwendung vollständig abdecken.
Andernfalls erhält die Anwendung ergänzende Hinweise.

Die Datenschutzhinweise müssen insbesondere lokale Kontoverwaltung, technisch notwendige
Sitzungscookies, Passwortlinks, Rollen- und Bereichszuordnungen, die Zuordnung der letzten
Kursänderung zu einem internen Konto, die Verarbeitung von IP-Adresse und User-Agent, Zwecke,
Rechtsgrundlagen, Empfänger, Speicherfristen, Betroffenenrechte und Kontaktstellen beschreiben.
Ein bloßer Verweis auf allgemeine DHBW-Hinweise genügt nur, wenn diese Verarbeitungen dort
tatsächlich erfasst sind.
