# How to use: Eine Route hinzufügen

Diese Anleitung beschreibt den aktuellen Ablauf, um eine Tour mit GPX-Route in
das Roadbook aufzunehmen. Für das Beispiel wird die Saison 2027 und die
Kollektion „After Work“ verwendet.

## Kurzüberblick

Eine neue Tour besteht aus zwei Teilen:

1. Der GPX-Datei unter `public/routes/<saison>/<kollektion>/`.
2. Einem Tour-Eintrag in der passenden Datei unter
   `src/data/seasons/<saison>/<kollektion>/tours.ts`.

Aus der GPX-Datei berechnet das Projekt Distanz, Höhenmeter, Höhenprofil und
Kartenverlauf. Die berechneten Daten in `src/data/routes.generated.json` werden
automatisch erzeugt und nicht von Hand bearbeitet.

## Schritt für Schritt: Tour in einer bestehenden Kollektion

### 1. GPX-Datei ablegen

Speichere die Route zum Beispiel hier:

```text
public/routes/2027/after-work/auerbach.gpx
```

Verwende für neue Dateien am besten einen aussagekräftigen, kleingeschriebenen
Dateinamen mit Bindestrichen und der Endung `.gpx`. Die GPX-Datei sollte
Trackpunkte (`<trkpt>`) oder Routenpunkte (`<rtept>`) enthalten. Für die
Berechnung von Höhenmetern und ein Höhenprofil sollten die Punkte auch
Höhenangaben (`<ele>`) enthalten.

### 2. Tour in der Tourenliste eintragen

Öffne `src/data/seasons/2027/after-work/tours.ts` und füge innerhalb des
`tours`-Arrays einen Eintrag hinzu:

```ts
{
  id: '2027-05-11',
  title: 'Auerbach-Runde',
  teaser: 'Über Nebenstraßen und ruhige Wege nach Auerbach und zurück.',
  ...MEETING,
  stations: ['Chemnitz', 'Auerbach', 'Chemnitz'],
  gpx: '2027/after-work/auerbach.gpx',
},
```

Passe die Beispielwerte an:

- `id`: Datum im Format `YYYY-MM-DD`. Es dient zugleich als eindeutige
  Tour-ID. Verwende es für keine andere Tour derselben Kollektion erneut.
- `title`: Name der Tour.
- `teaser`: Kurze Beschreibung, die in den Tourdetails angezeigt wird.
- `...MEETING`: Übernimmt die für die Kollektion festgelegte Treffzeit und den
  Treffpunkt. Du kannst stattdessen `meetingTime` und `meetingPlace` direkt im
  Eintrag angeben, wenn diese Tour davon abweicht.
- `stations`: Orte oder Zwischenziele in Streckenreihenfolge.
- `gpx`: Pfad zur Datei **relativ zu `public/routes/`**, ohne führenden Slash.
  Der Pfad muss exakt mit Saison, Kollektion und Dateiname übereinstimmen.

Die Touren werden in der Anwendung chronologisch sortiert; die Position des
Eintrags im Array bestimmt also nicht die Anzeige-Reihenfolge.

### 3. Optional: Alternativroute ergänzen

Eine Variante B gehört in dasselbe Tour-Objekt unter `alternative`. Sie hat
dieselben Routenfelder, aber **keine eigene `id`**:

```ts
{
  id: '2027-05-11',
  title: 'Auerbach-Runde',
  teaser: 'Über Nebenstraßen und ruhige Wege nach Auerbach und zurück.',
  ...MEETING,
  stations: ['Chemnitz', 'Auerbach', 'Chemnitz'],
  gpx: '2027/after-work/auerbach.gpx',
  alternative: {
    title: 'Auerbach-Runde kurz',
    teaser: 'Die kürzere Variante über weniger Zwischenziele.',
    ...MEETING,
    stations: ['Chemnitz', 'Auerbach', 'Chemnitz'],
    gpx: '2027/after-work/auerbach-kurz.gpx',
  },
},
```

Lege auch für die Alternative eine eigene GPX-Datei ab und verwende deren Pfad
im Feld `alternative.gpx`. Ohne GPX-Datei kann ein Tour-Eintrag zwar angezeigt
werden, aber Karte, Streckenwerte und GPX-Download stehen dann nicht zur
Verfügung.

### 4. Route berechnen und lokal prüfen

Im Projektverzeichnis:

```sh
npm run routes
npm run dev
```

`npm run routes` durchsucht `public/routes/` nach GPX-Dateien und aktualisiert
`src/data/routes.generated.json`. `npm run dev` führt diesen Schritt über
`predev` automatisch aus; die separate Ausführung eignet sich, um die
berechneten Daten gezielt vor dem Start zu aktualisieren.

Prüfe die Tour in der lokalen Anwendung: Datum, Titel, Treffpunkt, Stationen,
Karte, Streckenwerte und Download. Falls die Route oder ihre Werte fehlen,
kontrolliere zuerst den `gpx`-Pfad und ob die GPX-Datei Track- oder
Routenpunkte enthält.

### 5. Produktionsbuild und Veröffentlichung

Führe vor dem Veröffentlichen den Build aus:

```sh
npm run build
```

Der Build aktualisiert die Routendaten automatisch und prüft den TypeScript-Code.
Nach einem Push auf `main` oder `master` veröffentlicht der Workflow von GitHub
Actions die Anwendung auf GitHub Pages. Details zur einmaligen Einrichtung von
Pages stehen im `README.md`.

## Neue Saison oder Kollektion

Für eine weitere Tour innerhalb einer bereits eingebundenen Kollektion sind
nur die Schritte oben nötig. Eine **neue Saison oder Kollektion** muss
zusätzlich in der Anwendung registriert werden:

1. Erstelle den GPX-Ordner unter `public/routes/<jahr>/<kollektion>/` und die
   passende Tourendatei unter `src/data/seasons/<jahr>/<kollektion>/tours.ts`.
2. Registriere die Tourendatei und die Saison/Kollektion in
   `src/data/catalog.ts`.
3. Ergänze den URL-Pfad der Kollektion in `COLLECTION_PATHS` in
   `vite.config.ts`. Dadurch wird die Einstiegsseite für direkte Aufrufe und
   Reloads in den Build übernommen.
4. Führe `npm run build` aus und prüfe sowohl die Kollektion als auch ihren
   direkten URL-Aufruf.

## Typische Fehler

- **Route oder Kennzahlen fehlen:** Der `gpx`-Wert muss relativ zu
  `public/routes/` sein und auf den exakten Dateinamen zeigen.
- **Höhenmeter oder Höhenprofil fehlen:** Prüfe, ob die GPX-Punkte
  `<ele>`-Höhenangaben enthalten.
- **Alternative erscheint nicht:** Die Alternative muss als `alternative`
  im Tour-Eintrag verschachtelt sein und eine eigene gültige GPX-Datei
  referenzieren.
- **Tour wird nicht erwartet angezeigt:** Kontrolliere, dass das Datum als
  `YYYY-MM-DD` formatiert und der Tour-Eintrag in der richtigen
  Saison-/Kollektion-Datei eingetragen ist.
- **Änderung der GPX-Datei ist nicht sichtbar:** Starte `npm run routes` erneut
  oder starte den Dev-Server neu; `npm run build` führt die Berechnung ebenfalls
  aus.
