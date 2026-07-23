# Authentifizierung vom internen Konto trennen

Das interne Konto ist die dauerhafte fachliche Identität und wird über seine unveränderliche interne ID von Rollen, Bereichszuordnungen und Auditspur referenziert. Lokale E-Mail-/Passwort-Anmeldung und die spätere Keycloak-Identität sind austauschbare Anmeldeverfahren für dasselbe Konto; Keycloak wird über `issuer` und `subject`, niemals allein über die veränderliche E-Mail-Adresse, zugeordnet. Dadurch kann die lokale Authentifizierung entfernt werden, ohne Konten, Berechtigungen oder Auditbezüge zu migrieren.
