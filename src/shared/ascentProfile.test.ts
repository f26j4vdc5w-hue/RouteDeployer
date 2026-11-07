import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import routes from '../data/routes.generated.json';
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

test('full GPX points produce correct intermediate ascent and no end jump', () => {
  const key = '2026/camp/01-puig-de-la-llorenca-alt-de-bernia.gpx';
  const route = routes[key];
  const points = pointsFromFixture(`public/routes/${key}`);
  const profile = createAscentProfile(points);
  assert.equal(profile.ascentM, route.ascentM);

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
  const displayedDistance = (distance / profile.distanceKm) * route.distanceKm;
  assert.equal(getAscentUntilDistance(profile, displayedDistance, route.distanceKm), Math.round(ascent));
  assert.ok(route.ascentM - getAscentUntilDistance(profile, route.distanceKm * 0.99999, route.distanceKm) <= 3);
  assert.equal(getAscentUntilDistance(profile, route.distanceKm, route.distanceKm), route.ascentM);
});

test('all generated routes retain their original total ascent', () => {
  for (const [key, route] of Object.entries(routes)) {
    if (route.ascentM === null) continue;
    const profile = createAscentProfile(pointsFromFixture(`public/routes/${key}`));
    assert.equal(profile.ascentM, route.ascentM, key);
    assert.equal(getAscentUntilDistance(profile, route.distanceKm, route.distanceKm), route.ascentM, key);
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
