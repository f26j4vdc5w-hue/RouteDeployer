import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createAscentProfile, getAscentUntilDistance } from './ascentProfile';
import type { GpxPoint } from './gpx';

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

test('full GPX points produce a monotonic ascent profile and no end jump', () => {
  const key = '2026/camp/01-puig-de-la-llorenca-alt-de-bernia.gpx';
  const points = pointsFromFixture(`public/routes/${key}`);
  const profile = createAscentProfile(points);
  const displayedRouteDistance = 124.2;
  assert.ok(profile.ascentM > 0);
  assert.equal(profile.points[0].ascentM, 0);
  assert.ok(profile.points.every((point, index) =>
    index === 0 || point.ascentM >= profile.points[index - 1].ascentM));
  assert.equal(getAscentUntilDistance(profile, displayedRouteDistance, displayedRouteDistance), profile.ascentM);
  assert.ok(
    getAscentUntilDistance(profile, displayedRouteDistance * 0.99999, displayedRouteDistance) <= profile.ascentM,
  );
});

test('all GPX routes produce finite smoothed totals and matching end values', () => {
  const files = gpxFiles('public/routes');
  assert.ok(files.length > 0);
  for (const file of files) {
    const points = pointsFromFixture(file);
    if (!points.some((point) => point.ele !== null)) continue;
    const profile = createAscentProfile(points);
    assert.ok(Number.isFinite(profile.ascentM) && profile.ascentM >= 0, file);
    assert.ok(profile.points.length >= 2, file);
    const displayedDistance = Number(profile.distanceKm.toFixed(1));
    if (displayedDistance > 0) {
      assert.equal(getAscentUntilDistance(profile, displayedDistance, displayedDistance), profile.ascentM, file);
    }
  }
});

test('interpolates ascent and handles flat, missing and repeated-distance points', () => {
  const points: GpxPoint[] = [
    { lat: 50, lon: 12, ele: 100 },
    { lat: 50, lon: 12.01, ele: 120 },
    { lat: 50, lon: 12.01, ele: null },
    { lat: 50, lon: 12.02, ele: 120 },
  ];
  const profile = createAscentProfile(points);
  assert.equal(getAscentUntilDistance(profile, 0, 10), 0);
  assert.ok(getAscentUntilDistance(profile, 2.5, 10) >= 0);
  assert.equal(getAscentUntilDistance(profile, 10, 10), profile.ascentM);
  assert.equal(getAscentUntilDistance(profile, 20, 10), profile.ascentM);
  assert.throws(() => createAscentProfile(points.map((point) => ({ ...point, ele: null }))));
});

test('median smoothing removes isolated spikes while preserving a sustained climb', () => {
  const points: GpxPoint[] = Array.from({ length: 300 }, (_, index) => {
    let ele = 100;
    if (index >= 50 && index <= 100) ele += ((index - 50) / 50) * 80;
    else if (index > 100 && index <= 160) ele += 80;
    else if (index > 160 && index <= 220) ele += ((220 - index) / 60) * 80;
    if (index === 25) ele = 220;
    return { lat: 50, lon: 12 + index * 0.0001, ele };
  });
  const profile = createAscentProfile(points);

  assert.ok(profile.ascentM >= 65 && profile.ascentM <= 95, `${profile.ascentM} m`);
  assert.equal(getAscentUntilDistance(profile, profile.distanceKm, profile.distanceKm), profile.ascentM);
});
