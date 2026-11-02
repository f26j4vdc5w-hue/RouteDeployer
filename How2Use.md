# Touren im Roadbook verwalten

Touren werden nach der Einrichtung über den geschützten Admin-Bereich gepflegt.
Die alte statische Tourenliste im Repository dient nur noch als Ausgangsbestand
für den einmaligen Supabase-Import.

## Anmeldung

Öffne `/admin/` auf der veröffentlichten Website oder lokal unter
`http://localhost:5173/admin/` und melde dich mit dem Supabase-Admin-Benutzer an.
Es gibt keine öffentliche Registrierungsfunktion.

## Saison oder Kollektion anlegen

1. Wähle eine bestehende Saison oder lege unten im Saisonbereich eine neue an.
   Der Slug bestimmt den URL-Teil, etwa `s28`.
2. Lege für die gewählte Saison eine Kollektion an, zum Beispiel `after-work`.
3. Vergib die Beschriftungen am Anfang und Ende der Timeline.

Löschen einer Saison oder Kollektion entfernt auch die zugehörigen Touren.
Bestätige die Rückfrage daher nur, wenn der gesamte Bestand wirklich entfernt
werden soll.

## Tour anlegen oder bearbeiten

1. Wähle Saison und Kollektion aus.
2. Klicke **Neue Tour** oder **Bearbeiten**.
3. Fülle das Datum, den Titel, die Beschreibung, Treffpunkt und weitere Felder
   aus. Orte entlang der Strecke werden durch Kommas getrennt.
4. Optional: lade eine `.gpx`-Datei mit maximal 10 MB hoch. Die Website prüft
   die GPX-Punkte und berechnet Distanz, Höhenmeter, Kartenverlauf und
   Höhenprofil. Eine bestehende Datei bleibt erhalten, wenn keine neue Datei
   ausgewählt wird.
5. Für Variante B aktiviere **Alternative Route anbieten** und pflege deren
   Daten separat.
6. Speichere die Tour. Änderungen stehen anschließend direkt auf der
   öffentlichen Website bereit; ein neuer Frontend-Build ist nicht erforderlich.

Das Datum identifiziert eine Tour innerhalb ihrer Kollektion und kann nach dem
Anlegen nicht geändert werden. Um ein anderes Datum zu verwenden, lege eine
neue Tour an und lösche anschließend die alte.

## Einmaligen Import erneut ausführen

`npm run seed:supabase` ist nur für die erstmalige Übernahme der bisherigen
Touren und GPX-Dateien gedacht. Der Befehl aktualisiert Einträge mit denselben
Datums-IDs und kann dadurch Admin-Änderungen an diesen Touren überschreiben.
Neue Touren gehören in den Admin-Bereich, nicht in die statischen Dateien im
Repository.

## GPX-Fehler

- **Die Datei wird abgelehnt:** Prüfe die Endung `.gpx`, die maximale Größe von
  10 MB und gültiges XML.
- **Karte oder Höhenprofil fehlen:** Die Datei braucht mindestens zwei
  Trackpunkte (`trkpt`) oder Routenpunkte (`rtept`). Höhenmeter und Profil
  werden nur berechnet, wenn Höhenangaben (`ele`) vorhanden sind.
- **Upload oder Speichern schlägt fehl:** Prüfe die Verbindung und die
  Supabase-Policies. Nur Benutzer mit `app_metadata.role = "admin"` dürfen
  Änderungen speichern.
