# Betriebshandbuch

Ausführbare Betriebswege der Anwendung. Die begründenden Entscheidungen stehen in
[Architektur und Betrieb](ARCHITEKTUR_UND_BETRIEB.md); dieses Dokument beschreibt nur, welche
Befehle in welcher Reihenfolge auszuführen sind.

Alle Befehle laufen im Anwendungscontainer. Die Beispiele verwenden `docker compose exec app`;
mit `docker exec <container>` gilt dasselbe.

## Umgebung

| Variable | Zweck |
| --- | --- |
| `DATABASE_URL` | Pfad der SQLite-Datei auf dem persistenten Volume. |
| `BETTER_AUTH_URL` | Produktive Basis-URL. Sie ist zugleich die einzige Origin, der Better Auth vertraut — ohne Platzhalter. |
| `BETTER_AUTH_SECRET` | Mindestens 32 Zeichen. |
| `TRUSTED_PROXY_IPS` | Nur nötig, wenn Traefik `X-Forwarded-For` anhängt statt überschreibt: kommagetrennte Adressen oder CIDR-Bereiche der Proxys, so eng wie möglich. |

Die Anwendung setzt Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy` und
`Permissions-Policy` selbst; am Proxy ist dafür nichts zu konfigurieren. Was Traefik zu leisten hat,
steht in [Architektur und Betrieb](ARCHITEKTUR_UND_BETRIEB.md#betrieb-backups-und-datenschutz).

Server Actions vergleichen die Origin der Anfrage mit dem von Traefik gesetzten
`X-Forwarded-Host`. Weil Traefik ausschließlich die produktive Domäne auf den Container leitet, ist
das genau die produktive Origin; zusätzliche erlaubte Origins sind deshalb nicht konfiguriert und
dürfen es auch nicht werden — sie würden ausschließlich weitere Herkünfte zulassen.

## Tägliche Sicherung

Der Befehl erzeugt über die SQLite Online Backup API einen konsistenten Snapshot der laufenden
Anwendung, prüft ihn mit `PRAGMA integrity_check` und `PRAGMA foreign_key_check` und nennt den
Migrationsstand. Er überschreibt niemals eine vorhandene Zieldatei.

```bash
docker compose exec app npm run backup:db -- --to /backup/dhbw-mgmt-$(date +%F).sqlite
```

Schlägt die Prüfung fehl, bricht der Befehl mit Exit-Code 1 ab; die unbrauchbare Zieldatei bleibt
zur Diagnose liegen und muss vor einem erneuten Versuch entfernt werden.

Ein Host-Cron oder systemd-Timer ruft den Befehl täglich auf — die Anwendung besitzt keinen eigenen
Scheduler. Beispiel für einen Host-Cron:

```cron
30 2 * * * cd /srv/dhbw-mgmt && docker compose exec -T app npm run backup:db -- --to /backup/dhbw-mgmt-$(date +\%F).sqlite >> /var/log/dhbw-mgmt-backup.log 2>&1
```

Der geprüfte Snapshot wird anschließend an das Backupziel übertragen; Verschlüsselung, Ziel und
Aufbewahrungsdauer regelt [Architektur und Betrieb](ARCHITEKTUR_UND_BETRIEB.md#betrieb-backups-und-datenschutz).

## Migration

Migrationen laufen nicht nebenbei: Die Anwendung wird dafür gestoppt.

1. **Anwendung stoppen.**
   ```bash
   docker compose stop app
   ```
2. **Sicherung erstellen** — mit demselben geprüften Verfahren wie täglich, datiert und getrennt
   abgelegt. Dazu die aktuelle Konfiguration sichern.
   ```bash
   docker compose run --rm app npm run backup:db -- --to /backup/vor-migration-$(date +%F).sqlite
   ```
3. **Migrationen ausführen.** Der Befehl wendet jede noch nicht eingespielte Migration in ihrer
   Versionsreihenfolge an, jede in einer eigenen Transaktion.
   ```bash
   docker compose run --rm app npm run migrate:db
   ```
4. **Neues Image starten und verifizieren:** Container-Healthcheck, HTTP-Erreichbarkeit, eine
   erneute Sicherung als Datenbankprüfung sowie ein fachlicher Smoke-Test (öffentliche Suche öffnen,
   einen veröffentlichten Blockplan aufrufen, intern anmelden).
5. **Dokumentieren:** Sicherungsdatei, Migrationsversion, Prüfergebnis und ein gegebenenfalls
   ausgeführter Rückweg.

Die produktive Anwendung migriert nicht selbst: Findet sie beim Start ausstehende Migrationen, bricht
sie mit deren Namen ab. Schritt 3 lässt sich also nicht versehentlich überspringen.

## Rückweg

Schlägt die Migration oder eine Prüfung fehl, wird nicht mit der neuen Version weitergearbeitet.

1. **Anwendung stoppen** — die Wiederherstellung erfolgt ausschließlich bei gestoppter Anwendung.
2. **Snapshot einspielen.** Der Befehl prüft den Snapshot vor dem Einspielen, lehnt Snapshots einer
   neueren Anwendungsversion ab, entfernt das nicht mehr passende Write-Ahead-Log und benennt die
   ersetzte Datenbank in `<datei>.ersetzt-<zeitpunkt>` um, statt sie zu löschen.
   ```bash
   docker compose run --rm app npm run restore:db -- --from /backup/vor-migration-2026-07-27.sqlite
   ```
3. **Passende Konfiguration wiederherstellen und das vorherige Container-Image starten.**
4. **Verifizieren** wie nach einer Migration.
5. **Dokumentieren**, dass und warum der Rückweg gegangen wurde.

Die ersetzte Datenbank bleibt liegen und wird erst nach einem verifizierten Betrieb entfernt.

## Erstes Deployment

1. Migrationen ausführen (`npm run migrate:db`) — ohne sie startet die Anwendung nicht. Bereiche und
   Studiengänge aus [`SEED-DATEN.md`](SEED-DATEN.md) legt der Anwendungsstart idempotent an.
2. Anwendung starten.
3. Erstes Systemadministrationskonto anlegen — der Passwortlink erscheint einmalig auf der
   Standardausgabe und wird sofort kopiert und manuell weitergegeben:
   ```bash
   docker compose exec app npm run bootstrap:admin -- --email <dienstliche-e-mail>
   ```

## Notfall: administrativer Zugang verloren

Setzt das Passwort eines bestehenden Systemadministrationskontos zurück, beendet dessen Sitzungen
und gibt einen neuen Passwortlink im Terminal aus. Unbekannte Adressen, Konten ohne
Systemadministration und gesperrte Konten weist der Befehl ab.

```bash
docker compose exec app npm run reset:admin-password -- --email <dienstliche-e-mail>
```
