# KLLKTV Roadbook

Eine statische Roadbook-Seite für die Dienstagstouren. Die Touren werden aus
den GPX-Dateien unter `public/routes/<saison>/<kollektion>/` berechnet und als Download angeboten.

## Lokal starten

```sh
npm ci
npm run dev
```

Für einen Produktionsbuild:

```sh
npm run build
npm run preview
```

`npm run build` aktualisiert zuerst automatisch die Routendaten aus den GPX-Dateien.

## Touren und GPX-Dateien pflegen

1. Lege die GPX-Datei im passenden Saison-/Kollektion-Ordner ab, aktuell unter
   `public/routes/2027/after-work/`.
2. Trage die Tour in `src/data/seasons/2027/after-work/tours.ts` ein. Der Wert
   von `gpx` muss dem relativen Pfad ab `public/routes/` entsprechen, z. B.
   `2027/after-work/auerbach.gpx`.
   Eine zweite Route für denselben Termin wird als `alternative` am jeweiligen
   Tour-Eintrag gepflegt. Sie enthält dieselben Felder wie die Haupttour, ohne
   `id`, und wird über den Routenumschalter als Variante B angezeigt.
3. Erstelle einen Build oder führe `npm run routes` aus, um Distanz, Höhenmeter,
   Höhenprofil und Kartenverlauf neu zu berechnen.

Weitere Hinweise stehen in
[`public/routes/2027/after-work/README.txt`](public/routes/2027/after-work/README.txt).

## Auf GitHub Pages veröffentlichen

Der Workflow [Deploy to GitHub Pages](.github/workflows/deploy-pages.yml)
erstellt bei Pushes auf `main` oder `master` einen Produktionsbuild und
veröffentlicht `dist` auf GitHub Pages. Ein manueller Start ist im Reiter
**Actions** über **Deploy to GitHub Pages → Run workflow** möglich.

Aktiviere Pages einmalig in den Repository-Einstellungen:

1. Öffne **Settings → Pages**.
2. Wähle bei **Build and deployment → Source** die Option **GitHub Actions**.
3. Push auf `main` oder `master` (oder starte den Workflow manuell).
4. Öffne die veröffentlichte URL unter **Settings → Pages** oder im erfolgreichen
   Deployment des Workflows.

Der Workflow benötigt die Repository-Berechtigungen `pages: write` und
`id-token: write`, die bereits in der Workflow-Datei gesetzt sind.
