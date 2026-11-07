import { haversineKm, type GpxPoint } from './gpx';

export const ASCENT_THRESHOLD_M = 3;

interface AscentPoint {
  distanceKm: number;
  elevation: number | null;
  referenceElevation: number;
  ascentM: number;
}

export interface AscentProfile {
  points: AscentPoint[];
  distanceKm: number;
  ascentM: number;
}

export function createAscentProfile(points: GpxPoint[]): AscentProfile {
  if (points.length < 2 || !points.some((point) => point.ele !== null)) {
    throw new Error('Die GPX-Datei enthält kein auswertbares Höhenprofil.');
  }

  let distanceKm = 0;
  let ascentM = 0;
  const firstElevation = points.find((point) => point.ele !== null)?.ele;
  if (firstElevation == null) throw new Error('Die GPX-Datei enthält keine Höhenangaben.');
  let referenceElevation = firstElevation;
  const profile: AscentPoint[] = [{
    distanceKm, elevation: points[0].ele, referenceElevation, ascentM,
  }];
  for (let index = 1; index < points.length; index++) {
    distanceKm += haversineKm(points[index - 1], points[index]);
    const elevation = points[index].ele;
    if (elevation !== null) {
      if (elevation - referenceElevation >= ASCENT_THRESHOLD_M) {
        ascentM += elevation - referenceElevation;
        referenceElevation = elevation;
      } else if (referenceElevation - elevation >= ASCENT_THRESHOLD_M) {
        referenceElevation = elevation;
      }
    }
    profile.push({ distanceKm, elevation, referenceElevation, ascentM });
  }
  return { points: profile, distanceKm, ascentM: Math.round(ascentM) };
}

export function getAscentUntilDistance(profile: AscentProfile, distanceKm: number, displayedDistanceKm: number) {
  if (distanceKm <= 0 || displayedDistanceKm <= 0) return 0;
  if (distanceKm >= displayedDistanceKm) return profile.ascentM;

  const target = (distanceKm / displayedDistanceKm) * profile.distanceKm;
  let left = 0;
  let right = profile.points.length - 1;
  while (left < right) {
    const middle = Math.ceil((left + right) / 2);
    if (profile.points[middle].distanceKm <= target) left = middle;
    else right = middle - 1;
  }

  const previous = profile.points[left];
  const next = profile.points[left + 1];
  let ascent = previous.ascentM;
  if (next && previous.elevation !== null && next.elevation !== null && next.distanceKm > previous.distanceKm) {
    const fraction = (target - previous.distanceKm) / (next.distanceKm - previous.distanceKm);
    const elevation = previous.elevation + (next.elevation - previous.elevation) * fraction;
    if (elevation - previous.referenceElevation >= ASCENT_THRESHOLD_M) {
      ascent += elevation - previous.referenceElevation;
    }
  }
  return Math.round(ascent);
}
