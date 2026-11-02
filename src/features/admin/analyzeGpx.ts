import type { RouteStats } from '../../domain/route';

const MAX_POINTS = 120;
const ASCENT_THRESHOLD_M = 3;
const LOOP_TOLERANCE_KM = 0.5;

interface Point {
  lat: number;
  lon: number;
  ele: number | null;
}

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const round = (value: number, digits: number) => Number(value.toFixed(digits));

function haversineKm(a: Point, b: Point) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function sample<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, index) =>
    items[Math.round((index * (items.length - 1)) / (count - 1))],
  );
}

function parsePoints(xml: string): Point[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Die GPX-Datei enthält ungültiges XML.');
  }

  const points: Point[] = [];
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    if (element.localName !== 'trkpt' && element.localName !== 'rtept') continue;
    const lat = Number(element.getAttribute('lat'));
    const lon = Number(element.getAttribute('lon'));
    const elevation = Number(element.getElementsByTagNameNS('*', 'ele')[0]?.textContent);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) continue;
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) continue;
    points.push({ lat, lon, ele: Number.isFinite(elevation) ? elevation : null });
  }
  if (points.length < 2) {
    throw new Error('Die GPX-Datei muss mindestens zwei gültige Track- oder Routenpunkte enthalten.');
  }
  return points;
}

export async function analyzeGpx(file: File): Promise<RouteStats> {
  if (!file.name.toLowerCase().endsWith('.gpx')) {
    throw new Error('Bitte eine Datei mit der Endung .gpx auswählen.');
  }
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Die GPX-Datei muss größer als 0 Byte und höchstens 10 MB groß sein.');
  }

  const points = parsePoints(await file.text());
  let distanceKm = 0;
  let ascentM = 0;
  let referenceElevation = points.find((point) => point.ele !== null)?.ele ?? 0;
  const cumulative = [0];

  for (let index = 1; index < points.length; index++) {
    distanceKm += haversineKm(points[index - 1], points[index]);
    cumulative.push(distanceKm);
    const elevation = points[index].ele;
    if (elevation === null) continue;
    if (elevation - referenceElevation >= ASCENT_THRESHOLD_M) {
      ascentM += elevation - referenceElevation;
      referenceElevation = elevation;
    } else if (referenceElevation - elevation >= ASCENT_THRESHOLD_M) {
      referenceElevation = elevation;
    }
  }

  const hasElevation = points.some((point) => point.ele !== null);
  const profile = hasElevation
    ? sample(
        points.map((point, index) => [cumulative[index], point.ele ?? 0] as const),
        MAX_POINTS,
      ).map(([km, elevation]) => [round(km, 2), round(elevation, 1)] as [number, number])
    : [];
  const latitudeOrigin = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const projected = points.map((point) => ({
    x: point.lon * Math.cos(toRad(latitudeOrigin)),
    y: -point.lat,
  }));
  const minX = Math.min(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const span =
    Math.max(
      Math.max(...projected.map((point) => point.x)) - minX,
      Math.max(...projected.map((point) => point.y)) - minY,
    ) || 1;
  const path = sample(projected, MAX_POINTS).map(
    (point) => [round((point.x - minX) / span, 4), round((point.y - minY) / span, 4)] as [number, number],
  );

  return {
    distanceKm: round(distanceKm, 1),
    ascentM: hasElevation ? Math.round(ascentM) : null,
    isLoop: haversineKm(points[0], points.at(-1)!) <= LOOP_TOLERANCE_KM,
    path,
    geoPath: sample(points, MAX_POINTS).map(
      (point) => [round(point.lon, 6), round(point.lat, 6)] as [number, number],
    ),
    profile,
  };
}
