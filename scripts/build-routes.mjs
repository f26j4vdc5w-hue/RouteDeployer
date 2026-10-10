// Liest alle GPX-Dateien aus public/routes und berechnet Kennzahlen, Höhenprofil
// und einen normalisierten Kartenverlauf. Ergebnis: src/data/routes.generated.json
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ROUTES_DIR = 'public/routes';
const OUT_FILE = 'src/data/routes.generated.json';
const MAX_POINTS = 120;
const ASCENT_THRESHOLD_M = 3;
const LOOP_TOLERANCE_KM = 0.5;

const toRad = (deg) => (deg * Math.PI) / 180;

function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function parsePoints(xml) {
  const points = [];
  const re = /<(trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  for (const [, , attrs, body] of xml.matchAll(re)) {
    const lat = Number(/lat="([^"]+)"/.exec(attrs)?.[1]);
    const lon = Number(/lon="([^"]+)"/.exec(attrs)?.[1]);
    const ele = Number(/<ele>([^<]+)<\/ele>/.exec(body)?.[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null });
    }
  }
  return points;
}

function sample(items, count) {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) =>
    items[Math.round((i * (items.length - 1)) / (count - 1))],
  );
}

function analyze(points) {
  let distanceKm = 0;
  let ascentM = 0;
  let refEle = points.find((p) => p.ele !== null)?.ele ?? 0;
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(points[i - 1], points[i]);
    cumulative.push(distanceKm);
    const ele = points[i].ele;
    if (ele === null) continue;
    if (ele - refEle >= ASCENT_THRESHOLD_M) {
      ascentM += ele - refEle;
      refEle = ele;
    } else if (refEle - ele >= ASCENT_THRESHOLD_M) {
      refEle = ele;
    }
  }

  const hasElevation = points.some((p) => p.ele !== null);
  const profile = hasElevation
    ? sample(
        points.map((p, i) => [cumulative[i], p.ele ?? 0]),
        MAX_POINTS,
      ).map(([km, ele]) => [round(km, 2), round(ele, 1)])
    : [];

  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const projected = points.map((p) => ({
    x: p.lon * Math.cos(toRad(lat0)),
    y: -p.lat,
  }));
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const path = sample(projected, MAX_POINTS).map((p) => [
    round((p.x - minX) / span, 4),
    round((p.y - minY) / span, 4),
  ]);

  return {
    distanceKm: round(distanceKm, 1),
    ascentM: hasElevation ? Math.round(ascentM) : null,
    isLoop: haversineKm(points[0], points.at(-1)) <= LOOP_TOLERANCE_KM,
    path,
    geoPath: sample(points, MAX_POINTS).map((p) => [round(p.lon, 6), round(p.lat, 6)]),
    profile,
  };
}

const round = (value, digits) => Number(value.toFixed(digits));

async function findGpxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findGpxFiles(path);
      return entry.isFile() && entry.name.toLowerCase().endsWith('.gpx') ? [path] : [];
    }),
  );
  return files.flat().sort();
}

const files = await findGpxFiles(ROUTES_DIR);
const routes = {};
for (const file of files) {
  const key = relative(ROUTES_DIR, file).split(sep).join('/');
  const points = parsePoints(await readFile(file, 'utf8'));
  if (points.length < 2) {
    console.warn(`[routes] ${key}: keine Track-/Routenpunkte gefunden, übersprungen`);
    continue;
  }
  routes[key] = analyze(points);
}

await mkdir('src/data', { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(routes)}\n`);
console.log(`[routes] ${Object.keys(routes).length} GPX-Datei(en) verarbeitet`);
