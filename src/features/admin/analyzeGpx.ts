import type { RouteStats } from '../../domain/route';
import { haversineKm, parseGpxPoints } from '../../shared/gpx';
import { ASCENT_THRESHOLD_M } from '../../shared/ascentProfile';

const MAX_POINTS = 120;
const LOOP_TOLERANCE_KM = 0.5;

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const round = (value: number, digits: number) => Number(value.toFixed(digits));

function sample<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, index) =>
    items[Math.round((index * (items.length - 1)) / (count - 1))],
  );
}

export async function analyzeGpx(file: File): Promise<RouteStats> {
  if (!file.name.toLowerCase().endsWith('.gpx')) {
    throw new Error('Bitte eine Datei mit der Endung .gpx auswählen.');
  }
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Die GPX-Datei muss größer als 0 Byte und höchstens 10 MB groß sein.');
  }

  const points = parseGpxPoints(await file.text());
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
