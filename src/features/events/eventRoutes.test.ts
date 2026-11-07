import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Tour } from '../../domain/tour';
import { eventRouteAt, eventRouteCount, routeDragOffset, swipedRouteIndex } from './eventRoutes';

const routeStats = {
  distanceKm: 20, ascentM: 300, isLoop: false,
  path: [], geoPath: [], profile: [],
};
const event: Tour = {
  id: '2028-07-01-abc123', title: 'Event', teaser: 'Beschreibung',
  meetingTime: '10:00', meetingPlace: 'Start', stations: ['A'],
  organizerId: 'owner', requiredPersonalFields: ['email'],
  gpx: 'https://example.test/first.gpx', gpxKey: 'first.gpx',
  additionalRoutes: [{
    gpx: 'https://example.test/second.gpx', gpxKey: 'second.gpx',
    routeStats, stations: ['B'], durationMin: 120,
  }],
};

test('switches route-specific fields without changing event identity or consent', () => {
  assert.equal(eventRouteCount(event), 2);
  assert.equal(eventRouteAt(event, 0), event);
  const second = eventRouteAt(event, 1);
  assert.equal(second.gpxKey, 'second.gpx');
  assert.equal(second.routeStats, routeStats);
  assert.equal(second.durationMin, 120);
  assert.deepEqual(second.stations, ['B']);
  assert.equal(second.id, event.id);
  assert.equal(second.title, event.title);
  assert.equal(second.organizerId, event.organizerId);
  assert.deepEqual(second.requiredPersonalFields, event.requiredPersonalFields);
  assert.equal(eventRouteAt(event, 3), event);
  assert.equal(eventRouteCount({ ...event, gpx: undefined, additionalRoutes: [] }), 1);
});

test('only horizontal swipes within route bounds change selection', () => {
  assert.equal(swipedRouteIndex(0, 3, -80, 10), 1);
  assert.equal(swipedRouteIndex(1, 3, 80, 10), 0);
  assert.equal(swipedRouteIndex(0, 3, 80, 0), null);
  assert.equal(swipedRouteIndex(2, 3, -80, 0), null);
  assert.equal(swipedRouteIndex(0, 3, -49, 0), null);
  assert.equal(swipedRouteIndex(0, 3, -80, 70), null);
  assert.equal(swipedRouteIndex(0, 1, -80, 0), null);
});

test('drag follows the finger without moving beyond available routes or card width', () => {
  assert.equal(routeDragOffset(1, 3, -75, 280), -75);
  assert.equal(routeDragOffset(1, 3, 80, 280), 80);
  assert.equal(routeDragOffset(0, 3, 80, 280), 0);
  assert.equal(routeDragOffset(2, 3, -80, 280), 0);
  assert.equal(routeDragOffset(0, 1, -80, 280), 0);
  assert.equal(routeDragOffset(1, 3, -400, 280), -280);
});
