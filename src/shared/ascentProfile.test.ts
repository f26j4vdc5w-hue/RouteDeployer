import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createAscentProfile, getAscentUntilDistance } from './ascentProfile';
import { haversineKm, type GpxPoint } from './gpx';

function pointsFromFixture(file: string): GpxPoint[] {
  const xml = readFileSync(file, 'utf8');
  return Array.from(xml.matchAll(/<(trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/\1>/g), (match) => ({
    lat: Number(/lat="([^"]+)"/.exec(match[2])?.[1]),
    lon: Number(/lon="([^"]+)"/.exec(match[2])?.[1]),
    ele: /<ele>([^<]+)<\/ele>/.test(match[3]) ? Number(/<ele>([^<]+)<\/ele>/.exec(match[3])?.[1]) : null,
  }));
}

function gpxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? gpxFiles(path) : entry.name.endsWith('.gpx') ? [path] : [];
  });
}

function originalAscent(points: GpxPoint[]) {
  const firstElevation = points.find((point) => point.ele !== null)?.ele;
  assert.ok(firstElevation != null, 'GPX route must contain elevation data');
  let reference: number = firstElevation;
  let ascent = 0;
  for (const point of points.slice(1)) {
    if (point.ele === null) continue;
    if (point.ele - reference >= 3) {
      ascent += point.ele - reference;
      reference = point.ele;
    } else if (reference - point.ele >= 3) {
      reference = point.ele;
    }
  }
  return Math.round(ascent);
}

test('full GPX points produce correct intermediate ascent and no end jump', () => {
  const key = '2026/camp/01-puig-de-la-llorenca-alt-de-bernia.gpx';
  const points = pointsFromFixture(`public/routes/${key}`);
  const profile = createAscentProfile(points);
  const totalAscent = 1897;
  const displayedRouteDistance = 124.2;
  assert.equal(profile.ascentM, totalAscent);

  const index = Math.floor(points.length * 0.8);
  let distance = 0;
  let ascent = 0;
  let reference = points[0].ele!;
  for (let i = 1; i <= index; i++) {
    distance += haversineKm(points[i - 1], points[i]);
    const elevation = points[i].ele;
    if (elevation === null) continue;
    if (elevation - reference >= 3) {
      ascent += elevation - reference;
      reference = elevation;
    } else if (reference - elevation >= 3) {
      reference = elevation;
    }
  }
  const displayedDistance = (distance / profile.distanceKm) * displayedRouteDistance;
  assert.equal(getAscentUntilDistance(profile, displayedDistance, displayedRouteDistance), Math.round(ascent));
  assert.ok(totalAscent - getAscentUntilDistance(profile, displayedRouteDistance * 0.99999, displayedRouteDistance) <= 3);
  assert.equal(getAscentUntilDistance(profile, displayedRouteDistance, displayedRouteDistance), totalAscent);
});

test('all GPX routes retain their original total ascent', () => {
  const files = gpxFiles('public/routes');
  assert.ok(files.length > 0);
  for (const file of files) {
    const points = pointsFromFixture(file);
    if (!points.some((point) => point.ele !== null)) continue;
    const profile = createAscentProfile(points);
    const expected = originalAscent(points);
    assert.equal(profile.ascentM, expected, file);
    const displayedDistance = Number(profile.distanceKm.toFixed(1));
    if (displayedDistance > 0) {
      assert.equal(getAscentUntilDistance(profile, displayedDistance, displayedDistance), expected, file);
    }
  }
});

test('interpolates ascent and handles flat, missing and repeated-distance points', () => {
  const points: GpxPoint[] = [
    { lat: 50, lon: 12, ele: 100 },
    { lat: 50, lon: 12.01, ele: 110 },
    { lat: 50, lon: 12.01, ele: null },
    { lat: 50, lon: 12.02, ele: 110 },
  ];
  const profile = createAscentProfile(points);
  assert.equal(getAscentUntilDistance(profile, 0, 10), 0);
  assert.equal(getAscentUntilDistance(profile, 2.5, 10), 5);
  assert.equal(getAscentUntilDistance(profile, 7.5, 10), 10);
  assert.equal(getAscentUntilDistance(profile, 10, 10), 10);
  assert.equal(getAscentUntilDistance(profile, 20, 10), 10);
  assert.throws(() => createAscentProfile(points.map((point) => ({ ...point, ele: null }))));
});
