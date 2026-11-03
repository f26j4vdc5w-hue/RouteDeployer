# KLLKTV Roadbook

Das Roadbook ist eine React-/Vite-Website mit getrenntem Frontend und Backend:

- **Frontend:** GitHub Pages
- **Backend:** Supabase für PostgreSQL, Anmeldung und GPX-Dateispeicher
- **Besucher:** können Touren, Karten und GPX-Downloads ohne Anmeldung ansehen.
- **Community-Mitglieder:** können nach E-Mail-Bestätigung und Admin-Freigabe Touren-Zusagen verwalten und sehen, wer teilnimmt.
- **Admin:** kann Touren verwalten, GPX-Dateien hochladen und Community-Mitgliedschaften freigeben.

Touren und GPX-Dateien werden zur Laufzeit aus Supabase geladen. GPX-Kennzahlen,
Kartenverlauf und Höhenprofil werden beim Upload im Admin-Bereich berechnet.

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
7. Aktiviere danach in Supabase unter **Authentication → Settings** die
   Registrierung und die E-Mail-Bestätigung. Ergänze unter **URL Configuration**
   `https://f26j4vdc5w-hue.github.io/RouteDeployer/` sowie
   `http://localhost:5173/` in den erlaubten Redirect-URLs.
8. Registrierte Nutzer müssen ihre E-Mail bestätigen. Danach kann ein Admin
   ihren Antrag im Admin-Bereich unter **Community-Freigaben** freigeben oder
   ablehnen. Nur freigegebene Mitglieder können Zusagen sehen oder verwalten.
9. Melde dich auf der Website unter `/admin/` an. Bei GitHub-Pages-Projektseiten
   lautet der Pfad beispielsweise `/RouteDeployer/admin/`.

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

Änderungen an Touren, Saisons, Kollektionen und GPX-Dateien werden über den
Admin-Bereich gespeichert und sind nach dem Speichern öffentlich sichtbar.
GPX-Dateien sind auf 10 MB begrenzt. Die Datenbank prüft Schreibrechte
unabhängig von der Oberfläche über Row Level Security.

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
