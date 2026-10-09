Lege die GPX-Dateien dieser Kollektion hier ab, eine pro Tour.

Der Wert von `gpx` in `src/data/seasons/2027/after-work/tours.ts` muss dem
relativen Pfad ab `public/routes/` entsprechen, z. B.
`2027/after-work/auerbach.gpx`.
Länge, Höhenmeter, Höhenprofil und Kartenverlauf werden beim Start/Build automatisch
aus allen GPX-Dateien berechnet (`npm run routes`).
