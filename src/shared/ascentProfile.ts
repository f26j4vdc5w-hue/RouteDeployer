import { haversineKm, type GpxPoint } from './gpx';
import { createSmoothedAscentProfile } from './elevationSmoothing.mjs';

interface AscentPoint {
  distanceKm: number;
  elevation: number;
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

  const distancesM = [0];
  for (let index = 1; index < points.length; index++) {
    distancesM.push(distancesM[index - 1] + haversineKm(points[index - 1], points[index]) * 1000);
  }

  const smoothed = createSmoothedAscentProfile(distancesM, points.map((point) => point.ele));
  return {
    points: smoothed.points.map(({ distanceM, elevationM, ascentM }) => ({
      distanceKm: distanceM / 1000,
      elevation: elevationM,
      ascentM,
    })),
    distanceKm: smoothed.distanceM / 1000,
    ascentM: smoothed.ascentM,
  };
}

export function getAscentUntilDistance(
  profile: AscentProfile,
  distanceKm: number,
  displayedDistanceKm: number,
) {
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
  if (!next || next.distanceKm <= previous.distanceKm) return Math.round(previous.ascentM);
  const fraction = (target - previous.distanceKm) / (next.distanceKm - previous.distanceKm);
  const ascent = previous.ascentM + (next.ascentM - previous.ascentM) * fraction;
  return Math.min(profile.ascentM, Math.round(ascent));
}
