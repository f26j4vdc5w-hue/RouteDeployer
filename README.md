# KLLKTV Roadbook

Das Roadbook ist eine React-/Vite-Website mit getrenntem Frontend und Backend:

- **Frontend:** GitHub Pages
- **Backend:** Supabase für PostgreSQL, Anmeldung und GPX-Dateispeicher
- **Besucher:** können Touren, Karten und GPX-Downloads ohne Anmeldung ansehen.
- **Community-Mitglieder:** können nach E-Mail-Bestätigung und Admin-Freigabe Touren-Zusagen verwalten und sehen, wer teilnimmt.
- **Kollektion-Organisatoren:** können Touren in zugewiesenen Saison-Kollektionen verwalten, ohne Zugriff auf den Admin-Bereich zu erhalten.
- **Admin:** kann alle Touren verwalten, Kollektion-Organisatoren zuweisen, GPX-Dateien hochladen und Community-Mitgliedschaften freigeben.

Touren und GPX-Dateien werden zur Laufzeit aus Supabase geladen. GPX-Kennzahlen,
Kartenverlauf und Höhenprofil werden beim Upload berechnet.
Die Höhenmeter werden aus einem distanzbasiert geglätteten Höhenprofil berechnet;
bei der Interaktion wird dieselbe GPX-Berechnung für die Positionswerte verwendet.
Ein 450-m-Medianfilter auf 10-m-Stützstellen dämpft kurzfristige Höhenausschläge.

## Lokal starten

```sh
npm ci
```

Kopiere `.env.example` nach `.env.local` und trage dort die URL und den öffentlichen Publishable-/Anon-Key deines
Supabase-Projekts ein. Danach:

```sh
npm run dev
```

Produktionsbuild lokal prüfen:

```sh
npm run build
npm run preview
```

Ohne Supabase-Konfiguration zeigt die Website einen erklärenden Status statt
einer leeren oder veralteten Tourenansicht.

## Supabase einrichten

1. Erstelle ein Supabase-Projekt.
2. Öffne in Supabase **SQL Editor** und führe
   [`supabase/migrations/202611020001_initial_schema.sql`](supabase/migrations/202611020001_initial_schema.sql)
   aus. Das legt Tabellen, den öffentlichen GPX-Bucket und Row-Level-Security-
   Regeln an. Öffentliche Schreibzugriffe sind nicht erlaubt. Führe für neue
   Projekte anschließend alle weiteren Migrationen in aufsteigender Reihenfolge
   aus (siehe [Datenbankmigrationen](#datenbankmigrationen)).
3. Kopiere die Projekt-URL und den Publishable-/Anon-Key in `.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=https://<projekt-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=<publishable-oder-anon-key>
   SUPABASE_SECRET_KEY=<secret-api-key>
   ```

   Der Secret API Key (alternativ der Legacy Service-Role-Key) wird nur für den
   einmaligen Datenimport lokal benötigt. **Niemals** mit `VITE_` benennen, in
   Git committen oder in GitHub Actions veröffentlichen.
4. Importiere die vorhandenen Touren und GPX-Dateien einmalig:

   ```sh
   npm run seed:supabase
   ```

   Der Import aktualisiert Touren mit derselben Datums-ID. Führe ihn nach
   Beginn der laufenden Pflege nicht erneut aus, wenn die Datenbankinhalte
   erhalten bleiben sollen.
5. Lege in Supabase unter **Authentication → Users** einen Benutzer an. Setze
   bei diesem Benutzer unter **App Metadata** die Rolle auf
   `{"role":"admin"}`.
6. Die Community-Migrationen
   [`202611020003`](supabase/migrations/202611020003_community_members_and_rsvps.sql)
   (Mitgliederprofile, Admin-Freigaben, Tour-Zusagen mit Row-Level Security) und
   [`202611020004`](supabase/migrations/202611020004_community_member_profile.sql)
   (Anzeigename, Adresse und Geburtsdatum im Profil) gehören zu den
   Migrationen aus Schritt 2.
   Die Migration [`202611090001`](supabase/migrations/202611090001_member_clothing_size_phone.sql)
   ergänzt Kleidergröße und Telefonnummer im Profil und bei Event-Pflichtangaben.
   Die Migration [`202611100001`](supabase/migrations/202611100001_event_end_date.sql)
   ergänzt ein optionales Enddatum für mehrtägige Events.
   Die Migration [`202611110001`](supabase/migrations/202611110001_event_additional_routes.sql)
   ermöglicht zusätzliche GPX-Routen pro Event. Die Zusage gilt für das gesamte Event.
   Die Migration [`202611120001`](supabase/migrations/202611120001_restore_event_chat_url_function.sql)
   stellt den geschützten Abruf von WhatsApp-Chat-Links wieder her, falls die
   Datenbankfunktion fehlt.
   Die Migration [`202611130001`](supabase/migrations/202611130001_camp_additional_routes.sql)
   erlaubt zusätzliche GPX-Routen für Camps und überführt bestehende Camp-
   Alternativen in die neue Routenliste.
   Die Migration [`202611140001`](supabase/migrations/202611140001_collection_organizers.sql)
   ermöglicht Admins, freigegebene Mitglieder als Organisatoren für einzelne
   Saison-Kollektionen einzusetzen.
7. Aktiviere danach in Supabase unter **Authentication → Settings** die
   Registrierung und die E-Mail-Bestätigung. Ergänze unter **URL Configuration**
   die aktuelle Website-URL und ihre Admin-URL sowie `http://localhost:5173/`
   in den erlaubten Redirect-URLs. Hinweise zum Domainwechsel stehen unter
   [Eigene Domain](#eigene-domain).
8. Registrierte Nutzer müssen ihre E-Mail bestätigen. Danach kann ein Admin
   ihren Antrag im Admin-Bereich unter **Community-Freigaben** freigeben oder
   ablehnen. Nur freigegebene Mitglieder können Zusagen sehen oder verwalten.
9. Melde dich auf der Website unter `/admin/` an. Bei GitHub-Pages-Projektseiten
   lautet der Pfad beispielsweise `/RouteDeployer/admin/`.

### Passkeys

Passkey-Anmeldung muss für das Supabase-Projekt aktiviert und für den Host der
Website konfiguriert sein. Sie benötigt HTTPS (lokal ist `localhost` möglich)
und einen unterstützten Browser. Angemeldete Nutzer können im Community-Konto
einen Passkey einrichten und sich danach über „Mit Passkey anmelden“ anmelden.
E-Mail/Passwort und Google bleiben verfügbar; die Community-Freigabe durch einen
Admin ist weiterhin erforderlich.

### Strava-Verbindung

1. Erstelle unter [Strava API Settings](https://www.strava.com/settings/api) eine
   Anwendung. Trage bei **Authorization Callback Domain** den Hostnamen der
   Website ohne Protokoll und Pfad ein (z. B. `example.github.io` oder
   `localhost`). Für lokale und produktive Hosts werden gegebenenfalls getrennte
   Strava-Anwendungen benötigt. Die tatsächliche Redirect-URL ist die Basis-URL
   der Website mit `?strava_callback=1`, z. B.
   `https://example.github.io/RouteDeployer/?strava_callback=1`.
2. Setze `VITE_STRAVA_CLIENT_ID` in `.env.local` bzw. in den GitHub-Repository-
   Variables für das Pages-Deployment auf die Client-ID der Strava-Anwendung. Diese ID ist öffentlich;
   das Client Secret darf **nicht** in eine `VITE_`-Variable oder ins Repository.
3. Wende die Migration `202611150001_strava_connection.sql` an und deploye die
   Edge Function mit `supabase functions deploy strava`. Konfiguriere deren
   Secrets mit `supabase secrets set` oder im Supabase-Dashboard:
   - `STRAVA_CLIENT_ID`: dieselbe Client-ID wie im Frontend.
   - `STRAVA_CLIENT_SECRET`: das Secret der Strava-Anwendung.
   - `STRAVA_APP_URL`: Basis-URL der Website, z. B.
     `https://example.github.io/RouteDeployer/` (für CORS).
   - `STRAVA_TOKEN_KEY`: ein zufälliger, Base64-kodierter 32-Byte-Schlüssel,
     z. B. erzeugt mit `openssl rand -base64 32`.

   Supabase stellt `SUPABASE_URL`, `SUPABASE_ANON_KEY` und
   `SUPABASE_SERVICE_ROLE_KEY` für Edge Functions bereit. Den Verschlüsselungs-
   schlüssel sicher sichern: Wird er geändert oder verloren, müssen Mitglieder
   ihre Verbindung erneut herstellen. Secrets niemals veröffentlichen.
4. Angemeldete Mitglieder können im Profil „Mit Strava verbinden“ wählen und
   müssen `activity:read_all` bestätigen; dieser Zugriff umfasst auch private
   Aktivitäten. Tokens werden serverseitig verschlüsselt gespeichert und bei
   Bedarf beim Öffnen des Profils erneuert. Bei widerrufenen oder ungültigen
   Tokens die Verbindung im Profil trennen und erneut herstellen. Das Trennen
   löscht die lokalen Tokens; die App-Berechtigung kann zusätzlich in den
   Strava-Einstellungen widerrufen werden.

Die Verbindung allein erstellt noch keine Bestenlisten und synchronisiert keine
Aktivitäten. Ein späterer Aktivitätsabruf muss Tokens serverseitig verwenden und
vorher bei Bedarf erneuern.

## Datenbankmigrationen

Das Repository ist über **Settings → Integrations → GitHub** mit dem Supabase-
Projekt verbunden (Working Directory `.`, Production-Branch `main`). Wird eine
neue Datei in [`supabase/migrations/`](supabase/migrations) nach `main`
gemergt, wendet Supabase sie automatisch auf die Produktionsdatenbank an.

- Neue Migrationen brauchen eine höhere Versionsnummer im bestehenden Schema,
  z. B. `202611030001_beschreibung.sql`. Bereits angewendete Migrationen werden
  nie nachträglich geändert.
- Die Migrationen `202611020001` bis `202611020004` wurden manuell eingespielt und
  in der Migrationshistorie als angewendet eingetragen.
- Preview-Datenbanken pro Pull Request (Branching) benötigen den
  kostenpflichtigen Pro-Plan und sind nicht aktiviert.

## Betrieb und Limits

Die kostenlose Supabase-Stufe kann Projekte nach Inaktivität pausieren. Für
einen dauerhaft erreichbaren Produktionsbetrieb beachte die [aktuellen Tarife
und Limits](https://supabase.com/pricing).

## Daten pflegen

Änderungen an Saisons und Kollektionen werden über den Admin-Bereich gespeichert.
Touren und GPX-Dateien können Admins sowie zugewiesene Kollektion-Organisatoren
verwalten und sind nach dem Speichern öffentlich sichtbar. GPX-Dateien sind auf
10 MB begrenzt. Die Datenbank prüft Schreibrechte unabhängig von der Oberfläche
über Row Level Security.

Eine Schritt-für-Schritt-Anleitung steht in [How2Use.md](How2Use.md).

Die Kartenansicht verwendet OpenStreetMap-Kacheln und benötigt eine
Internetverbindung. Für Touren innerhalb der nächsten sieben Tage lädt die
Seite eine Wettervorhersage von [Open-Meteo](https://open-meteo.com/).

## GitHub Pages bereitstellen

Der Workflow [Deploy to GitHub Pages](.github/workflows/deploy-pages.yml)
erstellt bei Pushes auf `main` oder `master` einen Produktionsbuild und
veröffentlicht `dist`.

1. Lege in den Repository-Einstellungen unter **Settings → Secrets and
   variables → Actions → Variables** die Variablen
   `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` an. Der Anon-Key ist ein
   öffentlicher Client-Key; die Sicherheit wird über RLS geregelt.
2. Aktiviere unter **Settings → Pages → Build and deployment → Source** die
   Option **GitHub Actions**.
3. Push auf `main` oder `master` (oder starte **Actions → Deploy to GitHub
   Pages → Run workflow**).

`pages: write` und `id-token: write` sind im Workflow bereits gesetzt.

### Eigene Domain

Der Build verwendet ohne weitere Einstellung den GitHub-Pages-Projektpfad
`/<Repositoryname>/`. Für eine eigene Domain wird die Actions-Variable
`PAGES_BASE_PATH` auf `/` gesetzt. Vor der Umschaltung:

1. In Supabase unter **Authentication → URL Configuration** die Redirect-URLs
   `https://kllktv.cc/` und `https://kllktv.cc/admin/` ergänzen. Bestehende
   Redirect-URLs für die alte Website und die lokale Entwicklung zunächst
   beibehalten. Die Site URL beim Umzug auf `https://kllktv.cc/` setzen.
2. Die Domain für das GitHub-Konto verifizieren und unter **Settings → Pages →
   Custom domain** `kllktv.cc` eintragen. Das Repository verwendet GitHub Actions;
   eine `CNAME`-Datei im Repository ist dafür nicht erforderlich.
3. Beim DNS-Anbieter die A-Einträge für `kllktv.cc` durch die vier aktuellen
   [GitHub-Pages-IP-Adressen](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain)
   ersetzen. Bestehende AAAA-Einträge ebenfalls prüfen; sie dürfen nicht auf
   einen anderen Host zeigen. Für `www.kllktv.cc` optional einen CNAME auf
   `f26j4vdc5w-hue.github.io` setzen. DNS-Einträge für den Mailversand nicht
   verändern.
4. Unter **Settings → Secrets and variables → Actions → Variables** die
   Repository-Variable `PAGES_BASE_PATH` mit dem Wert `/` anlegen und den
   Workflow **Deploy to GitHub Pages** auf `main` erneut ausführen. DNS-Prüfung
   und HTTPS-Zertifikat in den Pages-Einstellungen abwarten und anschließend
   **Enforce HTTPS** aktivieren.
5. In Supabase unter **Authentication → Passkeys** den Relying Party ID auf
   `kllktv.cc` und die erlaubte Origin auf `https://kllktv.cc` setzen. Passkeys
   sind an ihren bisherigen Relying Party ID gebunden: Nach dessen Änderung
   funktionieren bestehende Passkeys nicht mehr. Nutzer müssen sich zunächst
   anders anmelden und einen neuen Passkey registrieren.
6. Startseite, direkte Unterseiten, Admin-Bereich, Registrierung, Bestätigung,
   Passwort-Reset, Google-Anmeldung und Passkeys auf der neuen Domain testen.
   Alte Links und noch nicht verwendete Bestätigungslinks ebenfalls prüfen.

DNS-Änderungen und die Ausstellung des HTTPS-Zertifikats können Zeit benötigen.
Die Website kann während der Umschaltung vorübergehend nicht erreichbar sein.
