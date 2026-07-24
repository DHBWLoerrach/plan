# Internes Konto mit austauschbaren Anmeldeverfahren

Der Benutzer-Datensatz von Better Auth ist zugleich das interne Konto und damit die dauerhafte fachliche Identität. Seine unveränderliche ID wird von Rolle, Bereichszuordnungen und der Angabe zum zuletzt ändernden Konto eines Entwurfs referenziert. Eine zusätzliche interne Kontotabelle mit 1:1-Zuordnung existiert nicht.

Lokale E-Mail-/Passwort-Anmeldung und die spätere Keycloak-Identität sind austauschbare Anmeldeverfahren für dieses Konto. Authentifizierungsbezogene Datensätze verweisen auf dieselbe Benutzer-ID; Keycloak wird über `issuer` und `subject`, niemals allein über die veränderliche E-Mail-Adresse, zugeordnet. Dadurch können lokale Passwortdaten und Passwortlinks entfernt werden, ohne fachliche Referenzen zu migrieren.

Das von Better Auth verlangte Namensfeld besitzt im MVP keine fachliche Bedeutung. Es spiegelt die dienstliche E-Mail-Adresse, wird bei deren Änderung mitgeführt und nicht als Personen- oder Anzeigename verwendet.

Eine eigene interne Kontotabelle würde die Authentifizierungsbibliothek deutlicher vom Fachmodell abgrenzen. Sie würde im MVP jedoch für jedes Konto eine zweite Identität, eine dauerhafte 1:1-Zuordnung und zusätzliche Integritätsregeln schaffen, ohne einen aktuellen Anwendungsfall zu erfüllen.
