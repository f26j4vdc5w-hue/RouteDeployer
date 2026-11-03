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
   aus. Bei bestehenden Projekten führe nur Migrationen aus, die dort noch
   nicht angewendet wurden.
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
6. Führe für ein bestehendes Projekt nach den bisherigen Migrationen zusätzlich
   [`supabase/migrations/202611020003_community_members_and_rsvps.sql`](supabase/migrations/202611020003_community_members_and_rsvps.sql)
   im SQL Editor aus. Die Migration legt Mitgliederprofile, Admin-Freigaben
   und Tour-Zusagen mit Row-Level Security an. Führe anschließend auch
   [`supabase/migrations/202611020004_community_member_profile.sql`](supabase/migrations/202611020004_community_member_profile.sql)
   aus, damit Mitglieder Anzeigename, Adresse und Geburtsdatum in ihrem Profil
   bearbeiten können.
7. Aktiviere danach in Supabase unter **Authentication → Settings** die
   Registrierung und die E-Mail-Bestätigung. Ergänze unter **URL Configuration**
   `https://f26j4vdc5w-hue.github.io/RouteDeployer/` sowie
   `http://localhost:5173/` in den erlaubten Redirect-URLs.
8. Registrierte Nutzer müssen ihre E-Mail bestätigen. Danach kann ein Admin
   ihren Antrag im Admin-Bereich unter **Community-Freigaben** freigeben oder
   ablehnen. Nur freigegebene Mitglieder können Zusagen sehen oder verwalten.
9. Melde dich auf der Website unter `/admin/` an. Bei GitHub-Pages-Projektseiten
   lautet der Pfad beispielsweise `/RouteDeployer/admin/`.

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
